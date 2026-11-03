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
import { reactive, watch as watchSettings } from 'vue'
import { estimateWaitTime } from '@/utils/waitTime.js'
import { fetchQueue } from '@/utils/waitTimeApi.js'
import defaultSupabase from '@/common/supabase.js'
import { waitSettings } from '@/utils/waitSettings.js'
import { useRealtimeResource } from './realtime/useRealtimeResource.js'
import { channels, QUEUE_CHANGE, STORE_POLL_MS } from './realtime/channels.js'

// key "storeId|orderId" -> { refs, state, engine, ... }. orderId is optional:
// omit it for a store-level "fresh order" estimate (badges, map tips), or pass it
// for a specific order's position in the queue (tracking, deliver).
const registry = new Map()

const keyOf = (storeId, orderId) => `${storeId}|${orderId || ''}`

function makeEntryState() {
  // Reactive so Vue consumers (and a watch in MapView) re-render on change.
  return reactive({ seconds: 0, ahead: 0, loading: true, stale: false, liveConnected: false })
}

function startEngine(storeId, orderId, rec, supabase) {
  const { state } = rec
  let lastQueue = null

  function compute() {
    if (!lastQueue) return
    state.seconds = estimateWaitTime(lastQueue.orderItems, lastQueue.cookingDetails, waitSettings(storeId)).seconds
  }

  // The shared realtime engine owns the channel/poll/debounce/teardown; we drive
  // it manually (manageLifecycle:false) from the ref-counted acquire/release, and
  // mirror its flags into the reactive `state` entry the cache hands out.
  const engine = useRealtimeResource({
    channel: () => channels.store(storeId),
    event: QUEUE_CHANGE,
    pollMs: STORE_POLL_MS,
    supabaseClient: supabase,
    manageLifecycle: false,
    load: () => fetchQueue(storeId, orderId || null),
    apply: (queue) => {
      lastQueue = queue
      compute()
      state.ahead = Number(queue?.ahead) || 0
      state.loading = false
      state.stale = false
    },
    onStatus: (connected) => { state.liveConnected = connected },
  })
  rec.engine = engine

  // Mirror loading/stale from the engine refs into the reactive entry.
  rec.stopFlags = watchSettings(
    () => [engine.loading.value, engine.stale.value],
    ([loading, stale]) => { state.loading = loading; state.stale = stale },
  )

  // Recompute (no refetch) when the resolved strategy/stations change.
  rec.stopSettings = watchSettings(() => JSON.stringify(waitSettings(storeId)), () => {
    if (!rec.destroyed) compute()
  })

  engine.start()
}

function teardownEngine(rec) {
  rec.destroyed = true
  if (rec.stopSettings) rec.stopSettings()
  if (rec.stopFlags) rec.stopFlags()
  if (rec.engine) rec.engine.stop()
  rec.engine = null
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
    rec = { refs: 0, state: makeEntryState(), engine: null, destroyed: false }
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
    teardownEngine(rec)
    registry.delete(key)
  }
}

/** Read the current cached entry without changing the ref count (may be undefined). */
export function peekStoreWait(storeId, orderId = null) {
  return registry.get(keyOf(storeId, orderId))?.state
}

// For tests / teardown.
export function _resetStoreWaitCache() {
  for (const [, rec] of registry) teardownEngine(rec)
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
