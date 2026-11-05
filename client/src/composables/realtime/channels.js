// Realtime channel/event names, status sets and timing constants. 
// Channel/event names and Supabase broadcast:
//   - user:<id>            -> per-user
//   - store:<id>           -> queue_change
//   - merchant-store:<id>  -> order_change
//   - courier-jobs         -> delivery_change

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
