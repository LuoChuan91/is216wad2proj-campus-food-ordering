// useLiveSync — the app-level liveness coordinator.
//
// Makes Supabase realtime the PRIMARY trigger for refreshing the signed-in
// user's live data, with polling demoted to a FALLBACK:
//   - Subscribe to the user's own channel (user:<id>). Any event on it means
//     "your data changed" -> debounced refresh(). (Per decision 1a we reuse the
//     existing per-user channel rather than adding a new trigger.)
//   - While the channel is SUBSCRIBED (realtime healthy), run only a LONG
//     safety-net interval in case a broadcast is missed.
//   - While NOT subscribed (channel error/closed, or no Supabase client at all),
//     run the full fast poll so the app still updates.
//
// `refresh` is injected (the app passes useAppBootstrap's refresh = loadLive +
// announceChanges). `userId` is a ref/getter so the subscription follows sign-in.
import { ref, watch, onBeforeUnmount, toValue } from 'vue'
import defaultSupabase from '@/common/supabase.js'
import { config as cfg } from '@/config/index.js'

export function useLiveSync(userId, refresh, options = {}) {
  const {
    supabaseClient = defaultSupabase,
    pollMs = cfg.pollMs, // fast fallback poll when realtime is down
    safetyMs = 60000, // long safety-net poll when realtime is connected
    debounceMs = 300,
  } = options

  const liveConnected = ref(false)

  let channel = null
  let fastTimer = null
  let safetyTimer = null
  let refetchTimer = null
  let destroyed = false

  function clearFast() { if (fastTimer) { clearInterval(fastTimer); fastTimer = null } }
  function clearSafety() { if (safetyTimer) { clearInterval(safetyTimer); safetyTimer = null } }

  // FALLBACK polling: fast when realtime is down, slow safety-net when it's up.
  function startFastPoll() {
    clearFast(); clearSafety()
    if (pollMs > 0) fastTimer = setInterval(() => refresh(), pollMs)
  }
  function startSafetyPoll() {
    clearFast(); clearSafety()
    if (safetyMs > 0) safetyTimer = setInterval(() => refresh(), safetyMs)
  }

  function scheduleRefresh() {
    if (refetchTimer) clearTimeout(refetchTimer)
    refetchTimer = setTimeout(() => refresh(), debounceMs)
  }

  function teardownChannel() {
    if (channel && supabaseClient?.removeChannel) {
      try { supabaseClient.removeChannel(channel) } catch (e) { console.warn('[useLiveSync] teardown failed:', e) }
    }
    channel = null
    liveConnected.value = false
  }

  function subscribe(id) {
    teardownChannel()
    // No signed-in user -> nothing to sync; don't poll or subscribe.
    if (!id) {
      clearFast(); clearSafety()
      return
    }
    // Have a user but no usable realtime client -> permanent fast polling.
    if (!supabaseClient || typeof supabaseClient.channel !== 'function') {
      startFastPoll()
      return
    }
    try {
      channel = supabaseClient
        .channel(`user:${id}`)
        // Any event on the user's channel means "refetch my data".
        .on('broadcast', { event: '*' }, scheduleRefresh)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            liveConnected.value = true
            startSafetyPoll() // realtime healthy: only the long safety net
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            liveConnected.value = false
            startFastPoll() // realtime down: fall back to fast polling
          }
        })
    } catch (e) {
      console.warn('[useLiveSync] subscribe failed, falling back to polling:', e)
      channel = null
      liveConnected.value = false
      startFastPoll()
    }
  }

  // Follow the signed-in user; (re)subscribe whenever the id changes.
  const stopWatch = watch(() => toValue(userId), (id) => { if (!destroyed) subscribe(id) }, { immediate: true })

  onBeforeUnmount(() => {
    destroyed = true
    stopWatch()
    if (refetchTimer) clearTimeout(refetchTimer)
    clearFast(); clearSafety()
    teardownChannel()
  })

  function stop() {
    destroyed = true
    stopWatch()
    if (refetchTimer) clearTimeout(refetchTimer)
    clearFast(); clearSafety()
    teardownChannel()
  }

  return { liveConnected, stop }
}
