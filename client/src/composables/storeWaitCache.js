// Module-level, ref-counted, realtime per-store wait cache.
//
// Why this exists: most wait-time surfaces are Vue components that just mount
// `useWaitTime` once (via WaitTimeEstimate.vue). But a few consumers are NOT
// components — notably MapView's venueTip, which builds Leaflet tooltip HTML
// imperatively — and a few want many stores at once (ExploreView's "best wait").
// For those, this cache runs ONE realtime subscription per store (shared across
// all callers) and exposes a reactive `{ seconds, ahead, liveConnected, loading,
// stale }` entry per store id.
//
// It is the SAME engine as useWaitTime (store:<id> / queue_change realtime channel
// with a polling fallback; fetchQueue -> estimateWaitTime), just shared and keyed
// by storeId with reference counting so it tears down when the last caller leaves.
//
// Callers:
//   const entry = acquireStoreWait(storeId)   // ref-count++, starts the engine
//   entry.seconds / entry.ahead / entry.liveConnected (reactive)
//   releaseStoreWait(storeId)                  // ref-count--, stops when it hits 0
import { reactive } from 'vue'
import { estimateWaitTime } from '@/utils/waitTime.js'
import { fetchQueue } from '@/utils/waitTimeApi.js'
import defaultSupabase from '@/common/supabase.js'
import { config as cfg } from '@/config/index.js'

const POLL_MS = 60000
const DEBOUNCE_MS = 300

// key "storeId|orderId" -> { refs, state, channel, timers, ... }. orderId is
// optional: omit it for a store-level "fresh order" estimate (badges, map tips),
// or pass it for a specific order's position in the queue (tracking, deliver).
const registry = new Map()

const keyOf = (storeId, orderId) => `${storeId}|${orderId || ''}`

function makeEntryState() {
  // Reactive so Vue consumers (and a watch in MapView) re-render on change.
  return reactive({ seconds: 0, ahead: 0, loading: true, stale: false, liveConnected: false })
}

function startEngine(storeId, orderId, rec, supabase) {
  const { state } = rec
  let hasData = false

  async function load() {
    try {
      const { orderItems, cookingDetails, ahead } = await fetchQueue(storeId, orderId || null)
      // TODO kicken slot and strategy to fix
      const result = estimateWaitTime(orderItems, cookingDetails, { stations: cfg.kitchenSlots ?? 2, strategy: 'scheduled' })
      if (rec.destroyed) return
      state.seconds = result.seconds
      state.ahead = Number(ahead) || 0
      state.loading = false
      state.stale = false
      hasData = true
    } catch {
      if (rec.destroyed) return
      state.loading = false
      if (hasData) state.stale = true
    }
  }
  rec.load = load

  function scheduleRefetch() {
    if (rec.refetchTimer) clearTimeout(rec.refetchTimer)
    rec.refetchTimer = setTimeout(load, DEBOUNCE_MS)
  }
  function startPolling() {
    stopPolling()
    rec.pollTimer = setInterval(load, POLL_MS)
  }
  function stopPolling() {
    if (rec.pollTimer) { clearInterval(rec.pollTimer); rec.pollTimer = null }
  }
  rec.stopPolling = stopPolling

  // Realtime-primary, polling-fallback (identical contract to useWaitTime).
  if (!supabase || typeof supabase.channel !== 'function') {
    startPolling()
  } else {
    try {
      rec.channel = supabase
        .channel(`store:${storeId}`)
        .on('broadcast', { event: 'queue_change' }, scheduleRefetch)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            state.liveConnected = true
            stopPolling()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            state.liveConnected = false
            startPolling()
          }
        })
    } catch {
      rec.channel = null
      state.liveConnected = false
      startPolling()
    }
  }

  load()
}

function teardownEngine(rec, supabase) {
  rec.destroyed = true
  if (rec.refetchTimer) clearTimeout(rec.refetchTimer)
  if (rec.pollTimer) clearInterval(rec.pollTimer)
  if (rec.channel && supabase?.removeChannel) {
    try { supabase.removeChannel(rec.channel) } catch { /* ignore */ }
  }
  rec.channel = null
}

/**
 * Acquire the live wait entry for a store (and optionally a specific order).
 * Starts the shared engine on first use. Omit orderId for a store-level estimate.
 * @param {string} storeId
 * @param {string|null} [orderId]
 * @param {object} [supabase] injectable client (tests)
 * @returns {{ seconds:number, ahead:number, loading:boolean, stale:boolean, liveConnected:boolean }}
 */
export function acquireStoreWait(storeId, orderId = null, supabase = defaultSupabase) {
  if (!storeId) return makeEntryState()
  const key = keyOf(storeId, orderId)
  let rec = registry.get(key)
  if (!rec) {
    rec = { refs: 0, state: makeEntryState(), channel: null, pollTimer: null, refetchTimer: null, destroyed: false }
    registry.set(key, rec)
    startEngine(storeId, orderId, rec, supabase)
  }
  rec.refs += 1
  return rec.state
}

/**
 * Release a previously acquired store wait entry. Tears the engine down when the
 * last caller releases it.
 */
export function releaseStoreWait(storeId, orderId = null, supabase = defaultSupabase) {
  const key = keyOf(storeId, orderId)
  const rec = registry.get(key)
  if (!rec) return
  rec.refs -= 1
  if (rec.refs <= 0) {
    teardownEngine(rec, supabase)
    registry.delete(key)
  }
}

/** Read the current cached entry without changing the ref count (may be undefined). */
export function peekStoreWait(storeId, orderId = null) {
  return registry.get(keyOf(storeId, orderId))?.state
}

// For tests / teardown.
export function _resetStoreWaitCache() {
  for (const [, rec] of registry) teardownEngine(rec, defaultSupabase)
  registry.clear()
}

// ---------------------------------------------------------------------------
// Component sugar: acquire on mount / setup, release on unmount. Returns the
// reactive entry ({ seconds, ahead, loading, stale, liveConnected }). storeId /
// orderId may be refs/getters; the wrapper re-acquires when they change.
import { watch, onBeforeUnmount, toValue } from 'vue'

export function useStoreWait(storeId, orderId = null) {
  let current = null // { storeId, orderId }
  const fallback = makeEntryState()
  const holder = reactive({ entry: fallback })

  function attach() {
    const sid = toValue(storeId)
    const oid = toValue(orderId)
    if (current && current.storeId === sid && current.orderId === oid) return
    if (current) releaseStoreWait(current.storeId, current.orderId)
    current = sid ? { storeId: sid, orderId: oid } : null
    holder.entry = sid ? acquireStoreWait(sid, oid) : fallback
  }

  const stop = watch(() => [toValue(storeId), toValue(orderId)], attach, { immediate: true })

  onBeforeUnmount(() => {
    stop()
    if (current) releaseStoreWait(current.storeId, current.orderId)
    current = null
  })

  return holder
}
