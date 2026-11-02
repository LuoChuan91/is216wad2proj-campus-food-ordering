// Single source of truth for notification text.
//
// Both notification paths funnel through here so the wording is identical:
//   - realtime  : the Supabase broadcast { kind, status, order_id } ->
//                 notifications.receive() resolves the order/store/dropoff from
//                 the stores and calls buildNotification().
//   - poll-diff : useAppBootstrap.announceChanges() already has the order and
//                 its lookups, so it calls buildNotification() directly.
//
// The wording below is the richer, order-aware copy that used to live inline in
// announceChanges() (e.g. "Collect order #E287 at Hawker Corner"). When the
// context (order/store/etc.) is missing we fall back to a short generic line so a
// very-early or orphaned event still reads sensibly.
//
// `toast` (pop-up vs list-only) policy — from the spec / realtime SQL:
//   order    paid       -> list only
//   order    ready      -> toast
//   order    completed  -> toast
//   delivery accepted   -> toast
//   delivery picked_up  -> toast
//   delivery delivered  -> list only
//   delivery expired    -> toast  (switched to pickup)

const TOAST = {
  order: { paid: false, ready: true, completed: true },
  delivery: { accepted: true, picked_up: true, delivered: false, expired: true },
};

import { wasSwitchedToPickup } from './pickupSwitch.js';

const first = (name) => (name || '').split(' ')[0];

/**
 * @typedef {Object} NotificationPayload
 * @property {'order'|'delivery'} kind
 * @property {string} status
 * @property {string} [order_id]
 * @property {string} [at]
 */

/**
 * @typedef {Object} NotificationContext
 * @property {object} [order]            the order row ({ code, type, delivery })
 * @property {string} [storeName]        the pickup store's name
 * @property {string} [dropoffName]      the delivery drop-off point's name
 * @property {string} [courierName]      the courier's display name
 * @property {number} [deliveryWindowMin] the delivery window in minutes
 */

/**
 * Build the view for one notification. Pure: all variable data comes in via ctx.
 * Returns null for statuses we do not surface.
 *
 * @param {NotificationPayload} payload
 * @param {NotificationContext} [ctx]
 * @returns {({ kind, status, order_id, at, title, body, variant, toast }) | null}
 */
export function buildNotification(payload, ctx = {}) {
  if (!payload || !payload.kind || !payload.status) return null;
  const toastByStatus = TOAST[payload.kind];
  if (!toastByStatus || !(payload.status in toastByStatus)) return null;

  const order = ctx.order || null;
  // Code: prefer the loaded order's code; otherwise derive it from order_id the
  // same way the server does (first 4 chars, upper-cased), so a brand-new order's
  // notification (fired by realtime before the order is in the store) still shows
  // a real code instead of "#—". When neither is available, we omit the fragment.
  const code = order?.code || (payload.order_id ? String(payload.order_id).slice(0, 4).toUpperCase() : null);
  const codeTag = code ? ` #${code}` : '';
  const store = ctx.storeName || 'the store';
  const drop = ctx.dropoffName || 'your drop-off point';
  const courier = first(ctx.courierName);
  const delivery = order?.delivery || null;

  let title;
  let body;
  let variant;

  if (payload.kind === 'order') {
    if (payload.status === 'paid') {
      // announceChanges surfaces the "cooking" line; keep that richer wording.
      title = `Order submitted`;
      body = `Your order reference is ${codeTag}`;
      variant = 'info';
    } else if (payload.status === 'ready') {
      title = 'Your food is ready';
      if (order && order.type !== 'pickup' && delivery && ctx.courierName) {
        body = `${courier} is picking it up now`;
      } else if (order && order.type !== 'pickup') {
        body = 'Waiting for a student courier to accept';
      } else {
        body = `Collect order${codeTag} at ${store}`;
      }
      variant = 'success';
    } else {
      // completed
      title = 'Order complete';
      body = code ? `Order #${code} is complete. Enjoy!` : 'Your order is complete. Enjoy!';
      variant = 'success';
    }
  } else {
    // delivery
    if (payload.status === 'accepted') {
      title = `${courier || 'A courier'} accepted your delivery`;
      body = `They'll bring it to ${drop}`;
      variant = 'info';
    } else if (payload.status === 'picked_up') {
      title = 'Your food is on the way';
      body = `${courier || 'The courier'} picked it up from ${store}`;
      variant = 'secondary';
    } else if (payload.status === 'delivered') {
      title = 'Delivered. Enjoy your meal!';
      body = `Dropped at ${drop}`;
      variant = 'success';
    } else {
      // expired -> switched to pickup (by the 10-minute rule, or by the student themselves)
      title = 'Switched to pickup';
      if (wasSwitchedToPickup(payload.order_id)) {
        body = `Collect it at ${store}. Delivery fee waived.`;
        variant = 'success';
      } else {
        const mins = ctx.deliveryWindowMin != null ? `${ctx.deliveryWindowMin} min` : 'time';
        body = `No courier took your order in ${mins}. Collect it at ${store}. Delivery fee waived.`;
        variant = 'warning';
      }
    }
  }

  return {
    ...payload,
    title,
    body,
    variant,
    toast: toastByStatus[payload.status],
  };
}

/** True when the payload should pop up as a toast. */
export function shouldToast(payload) {
  const by = TOAST[payload?.kind];
  return !!by && !!by[payload?.status];
}

export { TOAST };
