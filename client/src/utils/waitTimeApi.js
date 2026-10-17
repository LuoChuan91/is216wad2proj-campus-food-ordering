// Frontend data-access for the wait-time engine.
//
// Fetches everything estimateWaitTime() needs, through our Express API (NOT the
// browser Supabase client), because the API uses the secret key and can read
// every order in the store queue. The browser's own Supabase access is limited
// by RLS to the student's own orders, which is not enough for a queue estimate.
//
// Two API calls (via axios):
//   GET  /api/orders/orderAhead?store_id=&order_id=  -> queued orders, each with order_items(id, qty)
//   POST /api/menu/itemCookingDetails  { ids }       -> [{ id, cook_time_sec, max_at_once }]
//
// URLs are relative so Vite's dev proxy forwards /api to the Express server.
//
// Every axios call is wrapped so callers get a single, predictable ApiError with
// a user-friendly message and (when available) the HTTP status, instead of a raw
// axios error whose shape varies by failure mode.
import axios from 'axios'

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

// Turn any thrown axios error into an ApiError with a friendly message.
function toApiError(err, action) {
  // Server responded with a non-2xx status.
  if (err && err.response) {
    const status = err.response.status
    const serverMsg = err.response.data && err.response.data.error
    let message
    if (status >= 500) message = 'The server had a problem. Please try again.'
    else if (status === 404) message = `Could not find what we needed to ${action}.`
    else if (status >= 400) message = serverMsg || `Request to ${action} was rejected.`
    else message = serverMsg || `Failed to ${action}.`
    return new ApiError(message, { status, cause: err })
  }
  // Request was made but no response (network down, CORS, timeout).
  if (err && err.request) {
    return new ApiError("Can't reach the server. Check your connection.", { status: null, cause: err })
  }
  // Something else (bad setup, programming error).
  return new ApiError(`Failed to ${action}.`, { status: null, cause: err })
}

/**
 * Fetch the queue ahead and the cooking details for every dish in it.
 *
 * @param {string} storeId  required
 * @param {string} [orderId]  when given, only orders created at/before this order count
 * @param {{ http?: import('axios').AxiosInstance }} [deps]  injectable axios client for testing
 * @returns {Promise<{ orderItems: Array<{menu_item_id: string, qty: number}>, cookingDetails: Array<{id: string, cook_time_sec: number, max_at_once: number}> }>}
 * @throws {ApiError}
 */
export async function fetchQueue(storeId, orderId, deps = {}) {
  if (!storeId) throw new Error('fetchQueue: storeId is required')
  const http = deps.http || axios

  const params = { store_id: storeId }
  if (orderId) params.order_id = orderId

  // 1. Fetch the orders ahead in the queue.
  let orders
  try {
    const res = await http.get('/api/orders/orderAhead', { params })
    orders = res.data
  } catch (err) {
    throw toApiError(err, 'load the queue')
  }

  // Flatten order_items from every queued order into a single list.
  const orderItems = []
  for (const order of Array.isArray(orders) ? orders : []) {
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
      const res = await http.post('/api/menu/itemCookingDetails', { ids })
      cookingDetails = res.data
    } catch (err) {
      throw toApiError(err, 'load cooking times')
    }
  }

  return { orderItems, cookingDetails }
}
