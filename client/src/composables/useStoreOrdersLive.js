// Live merchant order board (merchant-store:<storeId> / 'order_change') over the
// realtime engine, mapping the engine's `data` to the public `orders`.
import { ref, toValue } from 'vue'
import { api } from '@/services/api.js'
import { useRealtimeResource } from './realtime/useRealtimeResource.js'
import { channels, ORDER_CHANGE, MERCHANT_POLL_MS } from './realtime/channels.js'

// Default fetch: the shared api layer (GET /orders?store_id=). Injectable so the
// dashboard can swap in its own fetch without touching the live-update logic.
async function defaultFetchOrders(storeId) {
  return api.storeOrders(storeId)
}

/**
 * @param {import('vue').MaybeRefOrGetter<string>} storeId
 * @param {{ fetchOrders?: (storeId: string) => Promise<any>, pollMs?: number, supabaseClient?: object }} [options]
 * @returns {{ orders: import('vue').Ref<any[]>, loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>, stale: import('vue').Ref<boolean>,
 *   liveConnected: import('vue').Ref<boolean>, refresh: () => Promise<void> }}
 */
export function useStoreOrdersLive(storeId, options = {}) {
  const {
    fetchOrders = defaultFetchOrders,
    pollMs = MERCHANT_POLL_MS,
    supabaseClient,
  } = options

  const orders = ref([])

  const { loading, error, stale, liveConnected, refresh } = useRealtimeResource({
    channel: () => channels.merchantStore(toValue(storeId)),
    event: ORDER_CHANGE,
    key: () => toValue(storeId),
    pollMs,
    supabaseClient,
    errorMessage: 'Could not load orders',
    load: () => fetchOrders(toValue(storeId)),
    // Accept either a bare array or an { orders: [...] } envelope.
    apply: (res) => { orders.value = Array.isArray(res) ? res : (res?.orders ?? []) },
  })

  return { orders, loading, error, stale, liveConnected, refresh }
}
