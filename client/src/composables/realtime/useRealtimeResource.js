// useRealtimeResource — the ONE shared realtime-primary / polling-fallback engine.
//
// Every realtime surface in the app (wait-time, merchant board, courier jobs,
// the per-user live sync, notifications, the shared store-wait cache) is the same
// machine with different wiring:
//   - subscribe to a Supabase broadcast channel; on a broadcast, (debounced)
//     either refetch data or hand the payload to a callback;
//   - when the channel is SUBSCRIBED, stop the fast poll (optionally run a slow
//     safety-net poll); when it's down / unavailable, poll as a fallback;
//   - keep the last good data and flag `stale` on a failed refetch; surface an
//     `error` only when the very first load fails with nothing to show;
//   - tear everything down on unmount / when the re-wire `key` changes / when an
//     `enabled` gate turns off.
//
// Consumers pass config and get back { data, loading, error, stale,
// liveConnected, refresh, start, stop }. Thin wrapper composables map `data` to
// their own public names (orders / deliveries / ...) so their public API is
// unchanged.
import { ref, watch, onMounted, onBeforeUnmount, toValue } from 'vue'
import defaultSupabase from '@/common/supabase.js'
import {
  DEBOUNCE_MS,
  CONNECTED_STATUS,
  DOWN_STATUSES,
} from './channels.js'

/**
 * @param {object} config
 * @param {() => string} config.channel        Reactive channel name (recomputed from keys).
 * @param {string} config.event                Broadcast event to listen for ('*' allowed).
 * @param {() => Promise<any>} [config.load]    The fetch (may throw). Omit in subscribe-only mode.
 * @param {(data:any) => void} [config.apply]   Write fetched data into caller refs. If omitted, data lands in the returned `data` ref.
 * @param {(message:any) => void} [config.onBroadcast] Subscribe-only handler: called with the raw broadcast instead of refetching. When set, no polling/data is used unless `load` is also given.
 * @param {import('vue').MaybeRefOrGetter<boolean>} [config.enabled=true] Gate.
 * @param {() => any} [config.key]              Reactive re-wire key; when it changes, reset + reload + resubscribe.
 * @param {number} [config.pollMs=0]            Fallback poll interval when realtime is down (0 = no poll).
 * @param {number} [config.safetyMs=0]          If > 0, two-speed mode: poll at safetyMs while SUBSCRIBED, pollMs while down.
 * @param {number} [config.debounceMs=DEBOUNCE_MS]
 * @param {object} [config.supabaseClient=defaultSupabase]
 * @param {string} [config.errorMessage]        Fallback message when the first load fails with no data.
 * @param {() => void} [config.onReset]         Called when the key/enabled change resets state (e.g. clear caller refs).
 * @param {boolean} [config.manageLifecycle=true] Register onMounted/onBeforeUnmount. When false the caller drives start()/stop().
 * @returns {{ data: import('vue').Ref<any>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, stale: import('vue').Ref<boolean>, liveConnected: import('vue').Ref<boolean>, refresh: () => Promise<void>, start: () => void, stop: () => void }}
 */
export function useRealtimeResource(config) {
  const {
    channel: channelName,
    event,
    load: loadFn = null,
    apply = null,
    onBroadcast = null,
    enabled = true,
    key = null,
    pollMs = 0,
    safetyMs = 0,
    debounceMs = DEBOUNCE_MS,
    supabaseClient = defaultSupabase,
    errorMessage = 'Something went wrong',
    onReset = null,
    manageLifecycle = true,
    loadOnStart = true, // data consumers load immediately; trigger mode (useLiveSync) does not
    onStatus = null, // optional (connected:boolean) => void, mirrors liveConnected changes
  } = config

  const data = ref(null)
  const loading = ref(true)
  const error = ref(null)
  const stale = ref(false)
  const liveConnected = ref(false)

  let hasData = false
  let destroyed = false
  let channel = null
  let pollTimer = null
  let safetyTimer = null
  let refetchTimer = null

  const isEnabled = () => toValue(enabled) !== false

  // ---- the fetch wrapper (data mode) --------------------------------------
  async function runLoad() {
    if (destroyed || !isEnabled() || !loadFn) return
    try {
      const result = await loadFn()
      if (destroyed) return
      if (apply) apply(result)
      else data.value = result
      hasData = true
      error.value = null
      stale.value = false
    } catch (e) {
      console.warn('[realtime] load failed:', e)
      if (destroyed) return
      if (hasData) {
        stale.value = true // keep the last good data, flag it as possibly stale
      } else {
        error.value = e.message || errorMessage
      }
    } finally {
      if (!destroyed) loading.value = false
    }
  }

  // On a broadcast: either hand the payload to a subscribe-only handler, or
  // (debounced) refetch.
  function handleBroadcast(message) {
    if (onBroadcast) {
      onBroadcast(message)
      return
    }
    if (refetchTimer) clearTimeout(refetchTimer)
    refetchTimer = setTimeout(runLoad, debounceMs)
  }

  // ---- polling (single- or two-speed) -------------------------------------
  function clearTimers() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    if (safetyTimer) { clearInterval(safetyTimer); safetyTimer = null }
  }
  function tick() {
    // The poll action is the same as a broadcast-driven refetch, minus the
    // debounce: refetch data, or (trigger mode) just call load/onBroadcast.
    if (onBroadcast && !loadFn) { onBroadcast(null); return }
    runLoad()
  }
  function startFastPoll() {
    clearTimers()
    if (pollMs > 0 && isEnabled()) pollTimer = setInterval(tick, pollMs)
  }
  function startSafetyPoll() {
    clearTimers()
    if (safetyMs > 0 && isEnabled()) safetyTimer = setInterval(tick, safetyMs)
  }
  function setConnected(v) {
    liveConnected.value = v
    if (onStatus) onStatus(v)
  }

  // When connected: two-speed mode runs the slow safety net; single-speed stops polling.
  function onConnected() {
    setConnected(true)
    if (safetyMs > 0) startSafetyPoll()
    else clearTimers()
  }
  function onDown() {
    setConnected(false)
    startFastPoll()
  }

  // ---- subscribe / teardown ------------------------------------------------
  function teardownChannel() {
    if (channel && supabaseClient?.removeChannel) {
      try { supabaseClient.removeChannel(channel) } catch (e) { console.warn('[realtime] teardown failed:', e) }
    }
    channel = null
    setConnected(false)
  }

  function subscribe() {
    teardownChannel()
    if (!isEnabled()) return

    const name = channelName()
    // No channel name (e.g. no signed-in user) -> don't poll or subscribe.
    if (name == null) { clearTimers(); return }

    // No usable realtime client -> permanent fallback polling.
    if (!supabaseClient || typeof supabaseClient.channel !== 'function') {
      startFastPoll()
      return
    }
    try {
      channel = supabaseClient
        .channel(name)
        .on('broadcast', { event }, handleBroadcast)
        .subscribe((status) => {
          if (status === CONNECTED_STATUS) onConnected()
          else if (DOWN_STATUSES.includes(status)) onDown()
        })
    } catch (e) {
      console.warn('[realtime] subscribe failed, falling back to polling:', e)
      channel = null
      setConnected(false)
      startFastPoll()
    }
  }

  // ---- public controls -----------------------------------------------------
  async function refresh() {
    await runLoad()
  }

  function start() {
    destroyed = false
    if (!isEnabled()) { loading.value = false; return }
    if (loadOnStart && channelName() != null) runLoad()
    subscribe()
  }

  function stop() {
    destroyed = true
    if (refetchTimer) clearTimeout(refetchTimer)
    clearTimers()
    teardownChannel()
  }

  // Reset to the pre-load state (used on key / enabled changes).
  function resetState() {
    loading.value = true
    hasData = false
    error.value = null
    stale.value = false
    if (onReset) onReset()
  }

  // ---- re-wire watches -----------------------------------------------------
  // Key change: reset + reload + resubscribe (store/order/user switch).
  if (key) {
    watch(
      () => {
        const k = key()
        return Array.isArray(k) ? k.map(String).join('|') : k
      },
      () => {
        if (destroyed) return
        resetState()
        if (loadOnStart && channelName() != null) runLoad()
        subscribe()
      },
    )
  }

  // Enabled gate: turning on starts fresh; turning off tears down + clears.
  if (enabled !== true) {
    watch(
      () => toValue(enabled),
      (on) => {
        if (destroyed) return
        if (on) {
          resetState()
          if (loadOnStart && channelName() != null) runLoad()
          subscribe()
        } else {
          clearTimers()
          teardownChannel()
          if (onReset) onReset()
          loading.value = false
        }
      },
    )
  }

  if (manageLifecycle) {
    onMounted(start)
    onBeforeUnmount(stop)
  }

  return { data, loading, error, stale, liveConnected, refresh, start, stop }
}
