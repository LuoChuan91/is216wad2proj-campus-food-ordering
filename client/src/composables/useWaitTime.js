// Live wait-time estimate (store:<id> / 'queue_change') over the realtime
// engine: fetches the queue, then applies the store's strategy to produce reactive
// `seconds` + `ahead`.
import { ref, watch, toValue } from 'vue'
import { estimateWaitTime } from '@/utils/waitTime.js'
import { fetchQueue } from '@/utils/waitTimeApi.js'
import { waitSettings } from '@/utils/waitSettings.js'
import { useRealtimeResource } from './realtime/useRealtimeResource.js'
import { channels, QUEUE_CHANGE, STORE_POLL_MS } from './realtime/channels.js'

/**
 * @param {import('vue').MaybeRefOrGetter<string>} storeId
 * @param {import('vue').MaybeRefOrGetter<string|null>} [orderId]
 * @param {{ strategy?: import('vue').MaybeRefOrGetter<string|null>, stations?: import('vue').MaybeRefOrGetter<number|null>, pollMs?: number, supabaseClient?: object }} [options]
 * @returns {{ seconds: import('vue').Ref<number>, ahead: import('vue').Ref<number>, loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>, stale: import('vue').Ref<boolean>,
 *   liveConnected: import('vue').Ref<boolean>, refresh: () => Promise<void> }}
 */
export function useWaitTime(storeId, orderId = null, options = {}) {
  const {
    strategy = null,
    stations = null,
    pollMs = STORE_POLL_MS,
    supabaseClient,
  } = options

  const seconds = ref(0)
  const ahead = ref(0)
  let lastQueue = null

  function settings() {
    const saved = waitSettings(toValue(storeId))
    return { strategy: toValue(strategy) ?? saved.strategy, stations: toValue(stations) ?? saved.stations }
  }

  function compute() {
    if (!lastQueue) return
    seconds.value = estimateWaitTime(lastQueue.orderItems, lastQueue.cookingDetails, settings()).seconds
  }

  const { loading, error, stale, liveConnected, refresh } = useRealtimeResource({
    channel: () => channels.store(toValue(storeId)),
    event: QUEUE_CHANGE,
    key: () => [toValue(storeId), toValue(orderId)],
    pollMs,
    supabaseClient,
    errorMessage: 'Wait time unavailable',
    load: () => fetchQueue(toValue(storeId), toValue(orderId)),
    apply: (queue) => {
      lastQueue = queue
      compute()
      ahead.value = Number(queue?.ahead) || 0
    },
    // On a store/order switch the primitive resets; drop the cached queue so a
    // stale number can't linger before the new fetch resolves.
    onReset: () => { lastQueue = null },
  })

  // Recompute when the resolved strategy/stations change.
  watch(() => JSON.stringify(settings()), () => { compute() })

  return { seconds, ahead, loading, error, stale, liveConnected, refresh }
}
