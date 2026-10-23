// Notifications store.
//
// Holds the list of received notifications (for a notifications panel/history)
// and a separate queue of ACTIVE toasts (the ones currently popping up). The
// realtime subscriber calls `receive(payload)`; the text comes from the shared
// builder in notificationMessages.js (the same wording the poll-diff path uses),
// which decides the copy, colour, and whether it also becomes a toast.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { buildNotification } from '@/utils/notificationMessages.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { config as cfg } from '@/config/index.js'

let seq = 0
const nextId = () => `n${Date.now()}_${seq++}`

// Resolve the order-aware context a realtime payload needs so its message reads
// like the poll-diff one ("Collect order #E287 at Hawker Corner"). The realtime
// payload only carries { kind, status, order_id }; the stores fill in the rest.
// Tolerates missing stores/order (returns what it can) so very-early or orphaned
// events still produce a sensible generic line.
function resolveContext(payload) {
  const ctx = { deliveryWindowMin: cfg?.deliveryWindowMin }
  try {
    const orders = useOrdersStore()
    const catalog = useCatalogStore()
    const order = payload.order_id ? orders.order(payload.order_id) : null
    if (order) {
      ctx.order = order
      const store = catalog.store(order.store_id)
      if (store) ctx.storeName = store.name
      const d = order.delivery
      if (d) {
        if (d.courier_name) ctx.courierName = d.courier_name
        const drop = catalog.dropoff(d.destination_id)
        if (drop) ctx.dropoffName = drop.name
      }
    }
  } catch {
    // Stores not ready (e.g. a bare unit test): fall back to generic wording.
  }
  return ctx
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref([]) // full history, newest first
  const toasts = ref([]) // currently visible toasts
  // Whether the Supabase realtime notification channel is currently connected.
  // When true, the poll-diff fallback (ui.notify mirror) suppresses status/delivery
  // events because realtime delivers them; when false, the bridge mirrors them so
  // nothing is lost. Set by useRealtimeNotifications.
  const realtimeConnected = ref(false)
  function setRealtimeConnected(v) { realtimeConnected.value = !!v }

  /**
   * Handle one raw realtime payload { kind, status, order_id, at }.
   * Returns the created notification, or null if the status is not one we show.
   */
  function receive(payload) {
    const view = buildNotification(payload, resolveContext(payload))
    if (!view) return null

    const notification = {
      id: nextId(),
      kind: view.kind,
      status: view.status,
      orderId: view.order_id ?? null,
      title: view.title,
      body: view.body,
      variant: view.variant,
      at: view.at || new Date().toISOString(),
      read: false,
    }

    items.value.unshift(notification)
    if (view.toast) toasts.value.push(notification)
    return notification
  }

  /** Remove a toast once it has been shown/dismissed (keeps it in history). */
  function dismissToast(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  /** Mark a history item read. */
  function markRead(id) {
    const n = items.value.find((i) => i.id === id)
    if (n) n.read = true
  }

  function clear() {
    items.value = []
    toasts.value = []
  }

  return { items, toasts, realtimeConnected, setRealtimeConnected, receive, dismissToast, markRead, clear }
})
