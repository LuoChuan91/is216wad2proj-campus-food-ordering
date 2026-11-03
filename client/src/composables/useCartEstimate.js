// Checkout cart estimate — the pre-order "when would this cart be ready?" number,
// computed entirely on the frontend. Same realtime engine as the rest of the
// wait-time system (store:<id> / queue_change, polling fallback) via the shared
// useRealtimeResource primitive, but instead of estimating the existing queue it
// runs the fresh-order probe (estimateNewOrderWait) to schedule the NOT-YET-PLACED
// cart behind that queue.
//
// Returns a reactive estimate: { seconds, ahead, readyAt } where readyAt is
// derived on the frontend as now + seconds, or null when the cart is empty / the
// store queue can't be loaded.
import { ref, computed, toValue } from 'vue'
import { estimateNewOrderWait } from '@/utils/waitTime.js'
import { api as defaultApi } from '@/services/api.js'
import { waitSettings } from '@/utils/waitSettings.js'
import { useRealtimeResource } from './realtime/useRealtimeResource.js'
import { channels, QUEUE_CHANGE, STORE_POLL_MS } from './realtime/channels.js'

const ms = (t) => (t ? Date.parse(t) : null)

export function useCartEstimate(storeId, cartLines, options = {}) {
  const {
    api = defaultApi,
    supabaseClient,
    stations = null,
    strategy = null,
    now = () => Date.now(),
  } = options

  const seconds = ref(0)
  const ahead = ref(0)
  const ready = ref(false) // true once we have a usable estimate

  // The fetch + fresh-order probe. Handles its own failure (ready=false) so the
  // primitive's generic error/stale path stays dormant (this surface exposes
  // neither — only { estimate, loading }).
  async function load() {
    const sid = toValue(storeId)
    const lines = toValue(cartLines) || []
    if (!sid || lines.length === 0) {
      ready.value = false
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

      const queueOrders = orders.map((o) => ({
        id: o.id,
        status: o.status === 'preparing' ? 'preparing' : 'placed',
        created_at: ms(o.created_at) || now(),
        preparing_at: ms(o.preparing_at) || ms(o.created_at) || now(),
        items: (o.order_items || []).map((oi) => ({ menu_item_id: oi.menu_item_id, qty: oi.qty })),
      }))
      const saved = waitSettings(sid)
      const r = estimateNewOrderWait(queueOrders, cartList, cookingDetails, {
        stations: toValue(stations) ?? saved.stations,
        strategy: toValue(strategy) ?? saved.strategy,
        now: now(),
      })
      seconds.value = r.seconds
      ahead.value = r.ahead
      ready.value = true
    } catch {
      ready.value = false
    }
  }

  const { loading } = useRealtimeResource({
    channel: () => channels.store(toValue(storeId)),
    event: QUEUE_CHANGE,
    pollMs: STORE_POLL_MS,
    supabaseClient,
    load,
    // No separate data to apply; load() writes seconds/ahead/ready directly.
    apply: () => {},
    // Re-run when the store, the cart contents, or the store's wait settings change.
    key: () => [
      toValue(storeId),
      (toValue(cartLines) || []).map((l) => `${l.menu_item_id}:${l.qty}`).join(','),
      JSON.stringify(waitSettings(toValue(storeId))),
    ],
  })

  const estimate = computed(() =>
    ready.value ? { seconds: seconds.value, ahead: ahead.value, readyAt: now() + seconds.value * 1000 } : null,
  )

  return { estimate, loading }
}
