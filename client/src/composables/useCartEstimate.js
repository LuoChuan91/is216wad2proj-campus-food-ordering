// Checkout cart estimate — the pre-order "when would this cart be ready?" number,
// computed entirely on the frontend (D1). Same realtime engine as the rest of the
// wait-time system (store:<id> / queue_change, polling fallback), but instead of
// estimating the existing queue it runs the ported fresh-order probe
// (estimateNewOrderWait) to schedule the NOT-YET-PLACED cart behind that queue.
//
// Returns a reactive estimate: { seconds, ahead, readyAt } where readyAt is
// derived on the frontend as now + seconds, or null when the cart is empty / the
// store queue can't be loaded.
import { ref, computed, watch, onBeforeUnmount, toValue } from 'vue'
import { estimateNewOrderWait } from '@/utils/waitTime.js'
import { api as defaultApi } from '@/services/api.js'
import defaultSupabase from '@/common/supabase.js'
import { config as cfg } from '@/config/index.js'

const POLL_MS = 60000
const DEBOUNCE_MS = 300
const ms = (t) => (t ? Date.parse(t) : null)

export function useCartEstimate(storeId, cartLines, options = {}) {
  const {
    api = defaultApi,
    supabaseClient = defaultSupabase,
    stations = cfg.kitchenSlots ?? 2,
    strategy = 'scheduled',
    now = () => Date.now(),
  } = options

  const seconds = ref(0)
  const ahead = ref(0)
  const ready = ref(false) // true once we have a usable estimate
  const loading = ref(true)

  let channel = null
  let pollTimer = null
  let refetchTimer = null
  let destroyed = false

  async function load() {
    const sid = toValue(storeId)
    const lines = toValue(cartLines) || []
    if (!sid || lines.length === 0) {
      ready.value = false
      loading.value = false
      return
    }
    try {
      // The raw store queue (orders with items + timestamps) for the scheduler.
      const payload = await api.ordersAhead(sid, null)
      const orders = Array.isArray(payload) ? payload : (payload?.orders ?? [])
      const cartList = lines.map((l) => ({ menu_item_id: l.menu_item_id, qty: l.qty }))
      // Distinct item ids across the queue AND the cart (the cart's dishes need
      // cooking details too, since the probe cooks them).
      const ids = [...new Set(
        orders.flatMap((o) => (o.order_items || []).map((oi) => oi.menu_item_id))
          .concat(cartList.map((l) => l.menu_item_id))
          .filter(Boolean),
      )]
      const cookingDetails = ids.length ? await api.itemCookingDetails(ids) : []
      if (destroyed) return

      const queueOrders = orders.map((o) => ({
        id: o.id,
        status: o.status === 'preparing' ? 'preparing' : 'placed',
        created_at: ms(o.created_at) || now(),
        preparing_at: ms(o.preparing_at) || ms(o.created_at) || now(),
        items: (o.order_items || []).map((oi) => ({ menu_item_id: oi.menu_item_id, qty: oi.qty })),
      }))
      // TODO strategy and stations
      const r = estimateNewOrderWait(queueOrders, cartList, cookingDetails, { stations, now: now(), strategy })
      seconds.value = r.seconds
      ahead.value = r.ahead
      ready.value = true
    } catch {
      if (!destroyed) ready.value = false
    } finally {
      if (!destroyed) loading.value = false
    }
  }

  function scheduleRefetch() {
    if (refetchTimer) clearTimeout(refetchTimer)
    refetchTimer = setTimeout(load, DEBOUNCE_MS)
  }
  function startPolling() { stopPolling(); pollTimer = setInterval(load, POLL_MS) }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }

  function teardownChannel() {
    if (channel && supabaseClient?.removeChannel) {
      try { supabaseClient.removeChannel(channel) } catch { /* ignore */ }
    }
    channel = null
  }

  function subscribe() {
    teardownChannel()
    const sid = toValue(storeId)
    if (!sid || !supabaseClient || typeof supabaseClient.channel !== 'function') {
      if (sid) startPolling()
      return
    }
    try {
      channel = supabaseClient
        .channel(`store:${sid}`)
        .on('broadcast', { event: 'queue_change' }, scheduleRefetch)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') stopPolling()
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startPolling()
        })
    } catch {
      channel = null
      startPolling()
    }
  }

  const estimate = computed(() => (ready.value ? { seconds: seconds.value, ahead: ahead.value, readyAt: now() + seconds.value * 1000 } : null))

  // Re-run when the store or the cart contents change.
  watch(
    () => [toValue(storeId), (toValue(cartLines) || []).map((l) => `${l.menu_item_id}:${l.qty}`).join(',')],
    () => { loading.value = true; load(); subscribe() },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    destroyed = true
    if (refetchTimer) clearTimeout(refetchTimer)
    stopPolling()
    teardownChannel()
  })

  return { estimate, loading }
}
