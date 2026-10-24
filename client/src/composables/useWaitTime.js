// useWaitTime — the single source of truth for a live wait-time estimate.
//
// Owns everything behind a wait-time number: fetch the queue from the Express
// API, compute the estimate with the pluggable strategy, subscribe to Supabase
// Realtime for live refreshes, and fall back to polling when Realtime is down.
// Returns a REACTIVE number of seconds plus status flags, so different UIs can
// consume it:
//   - WaitTimeEstimate.vue formats `seconds` into a label.
//   - OrderTrackingView.vue turns `seconds` into an ETA clock time.
//
// NOTE ON SHARING: this composable returns per-call reactive state. Two callers
// with the same storeId each open their own channel. That is fine for our pages
// (a page uses it once). If several widgets on ONE page must share a single
// channel later, add a ref-counted module cache keyed by `store:order` here —
// consumers would not need to change.
import { ref, computed, watch, onMounted, onBeforeUnmount, toValue } from 'vue'
import { estimateWaitTime } from '@/utils/waitTime.js'
import { fetchQueue } from '@/utils/waitTimeApi.js'
import defaultSupabase from '@/common/supabase.js'

/**
 * @param {import('vue').MaybeRefOrGetter<string>} storeId
 * @param {import('vue').MaybeRefOrGetter<string|null>} [orderId]
 * @param {{
 *   strategy?: import('vue').MaybeRefOrGetter<string>,
 *   stations?: import('vue').MaybeRefOrGetter<number>,
 *   pollMs?: number,
 *   supabaseClient?: object,
 * }} [options]
 * @returns {{ seconds: import('vue').Ref<number>, loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>, stale: import('vue').Ref<boolean>,
 *   liveConnected: import('vue').Ref<boolean>, refresh: () => Promise<void> }}
 */
export function useWaitTime(storeId, orderId = null, options = {}) {
  const {
    // TODO strategy and station
    strategy = 'scheduled',
    stations = 2,
    pollMs = 60000,
    supabaseClient = defaultSupabase,
  } = options

  const seconds = ref(0)
  const ahead = ref(0)
  const loading = ref(true)
  const error = ref(null)
  const stale = ref(false)
  const liveConnected = ref(false)
  const hasEstimate = ref(false)

  let channel = null
  let pollTimer = null
  let refetchTimer = null
  let destroyed = false

  async function load() {
    try {
      const { orderItems, cookingDetails, ahead: aheadCount } = await fetchQueue(toValue(storeId), toValue(orderId))
      const result = estimateWaitTime(orderItems, cookingDetails, {
        strategy: toValue(strategy),
        stations: toValue(stations),
      })
      if (destroyed) return
      seconds.value = result.seconds
      ahead.value = Number(aheadCount) || 0
      hasEstimate.value = true
      error.value = null
      stale.value = false
    } catch (e) {
      console.warn('[useWaitTime] load failed:', e)
      if (destroyed) return
      if (hasEstimate.value) {
        stale.value = true // keep the last good number, flag it as possibly stale
      } else {
        error.value = e.message || 'Wait time unavailable'
      }
    } finally {
      if (!destroyed) loading.value = false
    }
  }

  // Debounce bursts of broadcasts into one refetch.
  function scheduleRefetch() {
    if (refetchTimer) clearTimeout(refetchTimer)
    refetchTimer = setTimeout(load, 300)
  }

  function startPolling() {
    stopPolling()
    if (pollMs > 0) pollTimer = setInterval(load, pollMs)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function subscribe() {
    teardownChannel()
    if (!supabaseClient || typeof supabaseClient.channel !== 'function') {
      startPolling()
      return
    }
    try {
      channel = supabaseClient
        .channel(`store:${toValue(storeId)}`)
        .on('broadcast', { event: 'queue_change' }, scheduleRefetch)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            liveConnected.value = true
            stopPolling()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            liveConnected.value = false
            startPolling()
          }
        })
    } catch (e) {
      console.warn('[useWaitTime] realtime subscribe failed, falling back to polling:', e)
      channel = null
      liveConnected.value = false
      startPolling()
    }
  }

  function teardownChannel() {
    if (channel && supabaseClient?.removeChannel) {
      try {
        supabaseClient.removeChannel(channel)
      } catch (e) {
        console.warn('[useWaitTime] realtime teardown failed:', e)
      }
    }
    channel = null
    liveConnected.value = false
  }

  async function refresh() {
    await load()
  }

  onMounted(() => {
    load()
    subscribe()
  })

  onBeforeUnmount(() => {
    destroyed = true
    if (refetchTimer) clearTimeout(refetchTimer)
    stopPolling()
    teardownChannel()
  })

  // Re-wire when the store or order being watched changes.
  watch(
    () => [toValue(storeId), toValue(orderId)],
    () => {
      loading.value = true
      hasEstimate.value = false
      error.value = null
      stale.value = false
      load()
      subscribe()
    }
  )

  return { seconds, ahead, loading, error, stale, liveConnected, refresh }
}
