// Bridge between the app's notifications and notifications store.
//
// The app already works out WHEN something happened (useAppBootstrap polls the
// server and calls notify()). Angel's components (stores/notifications.js,
// NotificationPanel, NotificationToaster) already know how to SHOW it. This file
// connects the two.
//
// Her files are used exactly as they are - nothing here edits them.
import { useNotificationsStore } from '@/stores/notifications.js'

// The app's tones -> the Bootstrap variants components expect.
const VARIANT = { ok: 'success', info: 'info', warn: 'warning', error: 'danger', brand: 'secondary' }

let seq = 0

// Copy one app notification into notification store, both as history and as a pop-up.
// `meta` carries the order/delivery status when the notification is one of those
// realtime-owned events. When the Supabase realtime channel is CONNECTED we skip
// those here (realtime already delivers them, so we avoid a duplicate). When it
// is DISCONNECTED (or Supabase isn't configured) we mirror them too, so these
// status events are never lost — this is the polling fallback.
export function mirrorNotification(n, meta) {
  try {
    const store = useNotificationsStore()
    // Realtime-owned event + realtime is live -> let the channel show it.
    if (meta && meta.kind && store.realtimeConnected) return
    const item = {
      id: `b${Date.now()}_${seq++}`,
      title: n.title,
      body: n.body,
      variant: VARIANT[n.tone] || 'secondary',
      at: new Date(n.created_at || Date.now()).toISOString(),
      read: false,
    }
    store.items.unshift(item)
    store.toasts.push(item)
  } catch (err) {
    // Pinia is not ready yet (very early start-up). Skip rather than break the app.
    console.warn('[notify-bridge] skipped:', err.message)
  }
}
