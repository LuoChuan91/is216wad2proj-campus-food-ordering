import { describe, it, expect, vi } from 'vitest'
import { fetchQueue, ApiError } from '../waitTimeApi.js'

// A fake api layer: methods resolve to DATA directly (the shared api interceptor
// already unwraps res.data), matching services/api.js. `ordersAhead` returns the
// { orders, ahead } envelope the server now sends.
function makeApi({ orders = [], ahead, details = [] } = {}) {
  return {
    ordersAhead: vi.fn().mockResolvedValue({ orders, ahead: ahead ?? orders.length }),
    itemCookingDetails: vi.fn().mockResolvedValue(details),
  }
}

// Build an error shaped like the shared api interceptor's rejection (.status set).
function apiError(status, message) {
  return Object.assign(new Error(message || `Server error (${status})`), { status })
}

describe('fetchQueue (shared api)', () => {
  it('requires a storeId', async () => {
    await expect(fetchQueue()).rejects.toThrow(/storeId is required/)
  })

  it('calls ordersAhead then itemCookingDetails and returns normalized data', async () => {
    const orders = [
      { id: 'o1', order_items: [{ id: 'i1', menu_item_id: 'burger', qty: 2 }] },
      { id: 'o2', order_items: [{ id: 'i2', menu_item_id: 'fries', qty: 1 }, { id: 'i3', menu_item_id: 'burger', qty: 1 }] },
    ]
    const details = [
      { id: 'burger', cook_time_sec: 60, max_at_once: 2 },
      { id: 'fries', cook_time_sec: 30, max_at_once: 4 },
    ]
    const api = makeApi({ orders, details })

    const result = await fetchQueue('store-1', undefined, { api })

    expect(api.ordersAhead).toHaveBeenCalledWith('store-1', undefined)
    // itemCookingDetails called with DEDUPED ids
    const sentIds = api.itemCookingDetails.mock.calls[0][0]
    expect(sentIds.slice().sort()).toEqual(['burger', 'fries'])

    expect(result.orderItems).toHaveLength(3)
    expect(result.cookingDetails).toEqual(details)
    expect(result.ahead).toBe(2) // two orders in the queue
  })

  it('surfaces the server-provided ahead count (envelope shape)', async () => {
    const api = {
      ordersAhead: vi.fn().mockResolvedValue({ orders: [{ id: 'o1', order_items: [] }], ahead: 7 }),
      itemCookingDetails: vi.fn(),
    }
    const result = await fetchQueue('store-1', undefined, { api })
    expect(result.ahead).toBe(7) // trusts the server count, not the array length
  })

  it('tolerates a bare array (older server) and falls back to array length for ahead', async () => {
    const api = {
      ordersAhead: vi.fn().mockResolvedValue([
        { id: 'o1', order_items: [{ menu_item_id: 'burger', qty: 1 }] },
      ]),
      itemCookingDetails: vi.fn().mockResolvedValue([{ id: 'burger', cook_time_sec: 60, max_at_once: 2 }]),
    }
    const result = await fetchQueue('store-1', undefined, { api })
    expect(result.orderItems).toHaveLength(1)
    expect(result.ahead).toBe(1)
  })

  it('passes order_id when provided', async () => {
    const api = makeApi({ orders: [] })
    await fetchQueue('store-1', 'order-9', { api })
    expect(api.ordersAhead).toHaveBeenCalledWith('store-1', 'order-9')
    // No cooking-details call when the queue is empty.
    expect(api.itemCookingDetails).not.toHaveBeenCalled()
  })

  it('skips the cooking-details call when there are no items', async () => {
    const api = makeApi({ orders: [] })
    const result = await fetchQueue('store-1', undefined, { api })
    expect(api.itemCookingDetails).not.toHaveBeenCalled()
    expect(result.orderItems).toEqual([])
    expect(result.cookingDetails).toEqual([])
  })

  it('normalizes a 4xx into an ApiError with status', async () => {
    const api = { ordersAhead: vi.fn().mockRejectedValue(apiError(400, 'store_id is required')), itemCookingDetails: vi.fn() }
    await expect(fetchQueue('store-1', undefined, { api })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'store_id is required',
    })
  })

  it('normalizes a 5xx into a generic retry message', async () => {
    const api = { ordersAhead: vi.fn().mockRejectedValue(apiError(500, 'boom')), itemCookingDetails: vi.fn() }
    const rejection = await fetchQueue('store-1', undefined, { api }).catch((e) => e)
    expect(rejection).toBeInstanceOf(ApiError)
    expect(rejection.status).toBe(500)
    expect(rejection.message).toMatch(/server had a problem/i)
  })

  it('normalizes a no-response network error (status 0) to a connection message', async () => {
    const api = { ordersAhead: vi.fn().mockRejectedValue(apiError(0, "Couldn't reach the server")), itemCookingDetails: vi.fn() }
    const rejection = await fetchQueue('store-1', undefined, { api }).catch((e) => e)
    expect(rejection).toBeInstanceOf(ApiError)
    expect(rejection.status).toBe(0)
    expect(rejection.message).toMatch(/can't reach the server/i)
  })

  it('normalizes a failure on the cooking-details call', async () => {
    const orders = [{ id: 'o1', order_items: [{ menu_item_id: 'burger', qty: 1 }] }]
    const api = {
      ordersAhead: vi.fn().mockResolvedValue(orders),
      itemCookingDetails: vi.fn().mockRejectedValue(apiError(500, 'boom')),
    }
    const rejection = await fetchQueue('store-1', undefined, { api }).catch((e) => e)
    expect(rejection).toBeInstanceOf(ApiError)
    expect(rejection.status).toBe(500)
  })
})
