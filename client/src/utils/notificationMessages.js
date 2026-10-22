// Pure mapping from a realtime notification payload to what the UI should show.
//
// The database broadcast sends { kind, status, order_id, at } on the user's
// channel. This module decides the human text, the Bootstrap colour variant, and
// crucially whether the notification should pop up as a TOAST or just be recorded
// in the notification list.
//
// Toast rules (from the spec):
//   order    ready      -> toast
//   order    completed  -> toast ("complete")
//   delivery accepted   -> toast ("delivery is ready")
//   delivery picked_up  -> toast ("order picked up")
// Everything else that we notify about is list-only (no toast):
//   order    paid       -> notify only ("order placed & paid")
//   delivery delivered  -> notify only ("delivery completed")

/**
 * @typedef {Object} NotificationPayload
 * @property {'order'|'delivery'} kind
 * @property {string} status
 * @property {string} [order_id]
 * @property {string} [at]
 */

/**
 * @typedef {Object} NotificationView
 * @property {string} title
 * @property {string} body
 * @property {'success'|'info'|'warning'|'danger'|'secondary'} variant
 * @property {boolean} toast   // should this pop up as a toast?
 */

// kind -> status -> view (title/body/variant/toast)
const MESSAGES = {
  order: {
    paid: { title: 'Order placed', body: 'Your order is paid and sent to the kitchen.', variant: 'secondary', toast: false },
    ready: { title: 'Order ready', body: 'Your order is ready for collection.', variant: 'success', toast: true },
    completed: { title: 'Order complete', body: 'Your order is complete. Enjoy!', variant: 'success', toast: true },
  },
  delivery: {
    accepted: { title: 'Delivery ready', body: 'A courier accepted your delivery.', variant: 'info', toast: true },
    picked_up: { title: 'Order picked up', body: 'Your order has been picked up by the courier.', variant: 'info', toast: true },
    delivered: { title: 'Delivery complete', body: 'Your order has been delivered.', variant: 'success', toast: false },
    // No courier took the job in time: the order switched to self-pickup and the
    // delivery fee was waived. Surfaced as a toast so the student notices the change.
    expired: { title: 'Switched to pickup', body: 'No courier took your order in time, so it switched to self-pickup and the delivery fee was waived.', variant: 'warning', toast: true },
  },
};

/**
 * Resolve a payload into a view. Returns null for statuses we do not surface
 * (so callers can simply skip them).
 * @param {NotificationPayload} payload
 * @returns {(NotificationView & NotificationPayload) | null}
 */
export function toNotificationView(payload) {
  if (!payload || !payload.kind || !payload.status) return null;
  const byStatus = MESSAGES[payload.kind];
  if (!byStatus) return null;
  const view = byStatus[payload.status];
  if (!view) return null;
  return { ...payload, ...view };
}

/** True when the payload should pop up as a toast. */
export function shouldToast(payload) {
  const view = toNotificationView(payload);
  return !!view && view.toast;
}

export { MESSAGES };
