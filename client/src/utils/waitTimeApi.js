// Frontend data-access for the wait-time engine.
//
// Uses the shared services/api.js layer (one axios instance + interceptor), so
// the whole app has a SINGLE HTTP layer. The interceptor already unwraps the
// server's { error } into an Error with .status; here we re-wrap those into a
// normalized ApiError with a friendly, action-specific message for the UI.
//
// Two API calls:
//   api.ordersAhead(storeId, orderId) -> GET  /orders/orderAhead
//   api.itemCookingDetails(ids)       -> POST /menu/itemCookingDetails
import { api as defaultApi } from '@/services/api.js'

/**
 * A normalized error for any wait-time API failure.
 * `status` is the HTTP status when the server responded, or null for a
 * network/offline/timeout error. `cause` is the original error.
 */
export class ApiError extends Error {
  constructor(message, { status = null, cause = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.cause = cause
  }
}

// Turn a thrown error from the shared api (interceptor sets .status; 0 = no
// response) into an ApiError with a friendly, action-specific message.
function toApiError(err, action) {
  const status = err && typeof err.status === 'number' ? err.status : null
  let message
  if (status && status >= 500) message = 'The server had a problem. Please try again.'
  else if (status === 404) message = `Could not find what we needed to ${action}.`
  else if (!status) message = "Can't reach the server. Check your connection." // 0 or null
  else if (status >= 400) message = err.message || `Request to ${action} was rejected.`
  else message = err.message || `Failed to ${action}.`
  return new ApiError(message, { status, cause: err })
}

/**
 * Fetch the queue ahead and the cooking details for every dish in it.
 *
 * @param {string} storeId  required
 * @param {string} [orderId]  when given, only orders created at/before this order count
 * @param {{ api?: typeof defaultApi }} [deps]  injectable api layer for testing
 * @returns {Promise<{ orderItems: Array<{menu_item_id: string, qty: number}>, cookingDetails: Array<{id: string, cook_time_sec: number, max_at_once: number}>, ahead: number }>}
 * @throws {ApiError}
 */
export async function fetchQueue(storeId, orderId, deps = {}) {
  if (!storeId) throw new Error('fetchQueue: storeId is required')
  const api = deps.api || defaultApi

  // 1. Fetch the orders ahead in the queue. The server returns
  //    { orders, ahead }; tolerate a bare array for safety / older servers.
  let payload
  try {
    payload = await api.ordersAhead(storeId, orderId)
  } catch (err) {
    throw toApiError(err, 'load the queue')
  }

  const orders = Array.isArray(payload) ? payload : (payload?.orders ?? [])
  // Orders-ahead count: prefer the server's explicit count, else the array length.
  const ahead =
    payload && !Array.isArray(payload) && typeof payload.ahead === 'number'
      ? payload.ahead
      : orders.length

  // Flatten order_items from every queued order into a single list.
  const orderItems = []
  for (const order of orders) {
    for (const oi of order.order_items || []) {
      orderItems.push({ menu_item_id: oi.menu_item_id, qty: oi.qty })
    }
  }

  // Distinct menu item ids to look up cooking details for.
  const ids = [...new Set(orderItems.map((oi) => oi.menu_item_id).filter(Boolean))]

  // 2. Fetch cooking details for those dishes (skip when the queue is empty).
  let cookingDetails = []
  if (ids.length > 0) {
    try {
      cookingDetails = await api.itemCookingDetails(ids)
    } catch (err) {
      throw toApiError(err, 'load cooking times')
    }
  }

  return { orderItems, cookingDetails, ahead }
}
