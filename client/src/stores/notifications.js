// Notifications store.
//
// Holds the list of received notifications (for a notifications panel/history)
// and a separate queue of ACTIVE toasts (the ones currently popping up at the
// bottom-left). The realtime subscriber calls `receive(payload)`; the mapping in
// notificationMessages.js decides the text and whether it also becomes a toast.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toNotificationView } from '@/utils/notificationMessages.js'

let seq = 0
const nextId = () => `n${Date.now()}_${seq++}`

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref([]) // full history, newest first
  const toasts = ref([]) // currently visible toasts
  // Whether the Supabase realtime notification channel is currently connected.
  // When true, the poll-diff fallback (notifyBridge) suppresses status/delivery
  // events because realtime delivers them; when false, the bridge mirrors them so
  // nothing is lost. Set by useRealtimeNotifications.
  const realtimeConnected = ref(false)
  function setRealtimeConnected(v) { realtimeConnected.value = !!v }

  /**
   * Handle one raw realtime payload { kind, status, order_id, at }.
   * Returns the created notification, or null if the status is not one we show.
   */
  function receive(payload) {
    const view = toNotificationView(payload)
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
