// Bridge between the app's notifications and Angel's notifications store.
//
// The app already works out WHEN something happened (useAppBootstrap polls the
// server and calls notify()). Angel's components (stores/notifications.js,
// NotificationPanel, NotificationToaster) already know how to SHOW it. This file
// connects the two.
//
// Her files are used exactly as they are - nothing here edits them.
import { useNotificationsStore } from '@/stores/notifications.js'

// The app's tones -> the Bootstrap variants her components expect.
const VARIANT = { ok: 'success', info: 'info', warn: 'warning', error: 'danger', brand: 'secondary' }

let seq = 0

// Copy one app notification into her store, both as history and as a pop-up.
// `meta` carries the order/delivery status when the notification is one of those
// events: her realtime channel already delivers those, so we skip them here to
// avoid showing the same event twice.
export function mirrorNotification(n, meta) {
  if (meta && meta.kind) return
  try {
    const store = useNotificationsStore()
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
