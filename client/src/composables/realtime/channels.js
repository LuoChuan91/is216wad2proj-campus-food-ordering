// Single source of truth for the realtime layer's channel names, broadcast event
// names, status sets and timing constants.
//
// All realtime composables (useRealtimeResource and the thin wrappers that use
// it) read from here so the strings match the Postgres triggers exactly and the
// timing is standardised app-wide. The channel/event names below MUST stay in
// step with the SQL that broadcasts them:
//   - user:<id>            -> realtime_notifications.sql  (per-user notifications)
//                             + realtime_wait_time.sql / general per-user data
//   - store:<id>           -> realtime_wait_time.sql       (queue_change)
//   - merchant-store:<id>  -> realtime_merchant_orders.sql (order_change)
//   - courier-jobs         -> delivery trigger             (delivery_change)

// ---- timing (ms) ----------------------------------------------------------
// Debounce window that collapses a burst of broadcasts into a single refetch.
export const DEBOUNCE_MS = 300

// Long safety-net poll run WHILE realtime is connected (two-speed mode), in case
// a single broadcast is ever missed.
export const SAFETY_MS = 60000
// Per-surface fallback poll intervals (used only when realtime is down).
export const STORE_POLL_MS = 60000 // wait-time estimate
export const MERCHANT_POLL_MS = 30000 // merchant order board
export const COURIER_POLL_MS = 30000 // courier open-jobs list

// ---- subscribe() status handling -----------------------------------------
// Supabase channel status that means "realtime is healthy".
export const CONNECTED_STATUS = 'SUBSCRIBED'
// Statuses that mean "realtime is down -> fall back to polling".
export const DOWN_STATUSES = ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']

// ---- broadcast event names (match the SQL triggers) -----------------------
export const USER_EVENT = '*' // any event on the user channel = "your data changed"
export const QUEUE_CHANGE = 'queue_change'
export const ORDER_CHANGE = 'order_change'
export const DELIVERY_CHANGE = 'delivery_change'
export const NOTIFICATION = 'notification'

// ---- channel-name builders ------------------------------------------------
export const channels = {
  user: (id) => `user:${id}`,
  store: (id) => `store:${id}`,
  merchantStore: (id) => `merchant-store:${id}`,
  courierJobs: () => 'courier-jobs',
}
