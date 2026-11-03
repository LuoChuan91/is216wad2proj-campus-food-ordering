// useStoreOrdersLive — live-update layer for the MERCHANT order dashboard.
//
// Thin wrapper over the shared realtime engine (useRealtimeResource): it just
// wires the merchant channel + fetch and maps the engine's generic `data` to the
// public `orders`. All the subscribe/poll/teardown/debounce/keep-last-stale logic
// lives in the primitive.
//
//   Channel: merchant-store:<storeId>   Event: 'order_change'
//   Fires on: order becoming paid / ready / cancelled (see
//   realtime_merchant_orders.sql). We deliberately do not act on a 'preparing'
//   transition — it refetches on any order_change.
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
