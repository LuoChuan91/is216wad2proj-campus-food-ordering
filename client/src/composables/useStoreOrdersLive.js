// useStoreOrdersLive — live-update layer for the MERCHANT order dashboard.
//
// Scope: this is ONLY the realtime refresh layer. This composable subscribes to
// the merchant channel and, whenever the store's orders change, refreshes a
// reactive `orders` list by calling an INJECTED fetch function. The dashboard
// just mounts it and renders `orders`.
//
//   Channel: merchant-store:<storeId>   Event: 'order_change'
//   Fires on: order becoming paid / ready / cancelled (see
//   realtime_merchant_orders.sql). We deliberately do not act on a 'preparing'
//   transition — if a teammate adds a preparing tab, the DB can broadcast an
//   extra reason and this composable needs no change (it refetches on any
//   order_change).
//
// Behaviour mirrors useWaitTime: debounced refetch on broadcast, polling
// fallback when Realtime is down, keep-last-data + `stale` flag on a failed
// refresh, and full teardown on unmount / storeId change.
import { ref, watch, onMounted, onBeforeUnmount, toValue } from 'vue'
import defaultSupabase from '@/common/supabase.js'
import { api } from '@/services/api.js'

// Default fetch: the shared api layer (GET /orders?store_id=). Injectable so the
// dashboard can swap in its own fetch without touching the live-update logic.
async function defaultFetchOrders(storeId) {
  return api.storeOrders(storeId)
}

/**
 * @param {import('vue').MaybeRefOrGetter<string>} storeId
 * @param {{
 *   fetchOrders?: (storeId: string) => Promise<any>,
 *   pollMs?: number,
 *   supabaseClient?: object,
 * }} [options]
 * @returns {{ orders: import('vue').Ref<any[]>, loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>, stale: import('vue').Ref<boolean>,
 *   liveConnected: import('vue').Ref<boolean>, refresh: () => Promise<void> }}
 */
export function useStoreOrdersLive(storeId, options = {}) {
  const {
    fetchOrders = defaultFetchOrders,
    pollMs = 30000,
    supabaseClient = defaultSupabase,
  } = options

  const orders = ref([])
  const loading = ref(true)
  const error = ref(null)
  const stale = ref(false)
  const liveConnected = ref(false)
  const hasData = ref(false)

  let channel = null
  let pollTimer = null
  let refetchTimer = null
  let destroyed = false

  async function load() {
    try {
      const data = await fetchOrders(toValue(storeId))
      if (destroyed) return
      // Accept either a bare array or an { orders: [...] } envelope.
      orders.value = Array.isArray(data) ? data : (data?.orders ?? [])
      hasData.value = true
      error.value = null
      stale.value = false
    } catch (e) {
      console.warn('[useStoreOrdersLive] load failed:', e)
      if (destroyed) return
      if (hasData.value) {
        stale.value = true // keep the last good list, flag it as possibly out of date
      } else {
        error.value = e.message || 'Could not load orders'
      }
    } finally {
      if (!destroyed) loading.value = false
    }
  }

  // Debounce bursts of broadcasts (e.g. several orders paid at once) into one refetch.
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
        .channel(`merchant-store:${toValue(storeId)}`)
        .on('broadcast', { event: 'order_change' }, scheduleRefetch)
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
      console.warn('[useStoreOrdersLive] realtime subscribe failed, falling back to polling:', e)
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
        console.warn('[useStoreOrdersLive] realtime teardown failed:', e)
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

  // Re-wire when the dashboard switches to a different store.
  watch(
    () => toValue(storeId),
    () => {
      loading.value = true
      hasData.value = false
      error.value = null
      stale.value = false
      load()
      subscribe()
    }
  )

  return { orders, loading, error, stale, liveConnected, refresh }
}
