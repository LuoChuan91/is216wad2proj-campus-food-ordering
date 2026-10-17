import { describe, it, expect, vi } from 'vitest'
import { fetchQueue, ApiError } from '../waitTimeApi.js'

// A fake axios instance: get/post resolve to { data }, matching axios's shape.
function makeHttp({ orders = [], details = [] } = {}) {
  return {
    get: vi.fn().mockResolvedValue({ data: orders }),
    post: vi.fn().mockResolvedValue({ data: details }),
  }
}

describe('fetchQueue (axios)', () => {
  it('requires a storeId', async () => {
    await expect(fetchQueue()).rejects.toThrow(/storeId is required/)
  })

  it('calls orderAhead then itemCookingDetails and returns normalized data', async () => {
    const orders = [
      { id: 'o1', order_items: [{ id: 'i1', menu_item_id: 'burger', qty: 2 }] },
      { id: 'o2', order_items: [{ id: 'i2', menu_item_id: 'fries', qty: 1 }, { id: 'i3', menu_item_id: 'burger', qty: 1 }] },
    ]
    const details = [
      { id: 'burger', cook_time_sec: 60, max_at_once: 2 },
      { id: 'fries', cook_time_sec: 30, max_at_once: 4 },
    ]
    const http = makeHttp({ orders, details })

    const result = await fetchQueue('store-1', undefined, { http })

    // GET orderAhead with store_id and no order_id
    const [getUrl, getConfig] = http.get.mock.calls[0]
    expect(getUrl).toBe('/api/orders/orderAhead')
    expect(getConfig.params).toEqual({ store_id: 'store-1' })

    // POST itemCookingDetails with DEDUPED ids
    const [postUrl, postBody] = http.post.mock.calls[0]
    expect(postUrl).toBe('/api/menu/itemCookingDetails')
    expect(postBody.ids.sort()).toEqual(['burger', 'fries'])

    expect(result.orderItems).toHaveLength(3)
    expect(result.cookingDetails).toEqual(details)
  })

  it('passes order_id when provided', async () => {
    const http = makeHttp({ orders: [] })
    await fetchQueue('store-1', 'order-9', { http })
    expect(http.get.mock.calls[0][1].params).toEqual({ store_id: 'store-1', order_id: 'order-9' })
    // No cooking-details call when the queue is empty.
    expect(http.post).not.toHaveBeenCalled()
  })

  it('skips the cooking-details call when there are no items', async () => {
    const http = makeHttp({ orders: [] })
    const result = await fetchQueue('store-1', undefined, { http })
    expect(http.post).not.toHaveBeenCalled()
    expect(result.orderItems).toEqual([])
    expect(result.cookingDetails).toEqual([])
  })

  it('normalizes a 4xx server response into an ApiError with status', async () => {
    const err = Object.assign(new Error('Request failed'), {
      response: { status: 400, data: { error: 'store_id is required' } },
    })
    const http = { get: vi.fn().mockRejectedValue(err), post: vi.fn() }
    await expect(fetchQueue('store-1', undefined, { http })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'store_id is required',
    })
  })

  it('normalizes a 5xx into a generic retry message', async () => {
    const err = Object.assign(new Error('boom'), { response: { status: 500, data: {} } })
    const http = { get: vi.fn().mockRejectedValue(err), post: vi.fn() }
    const rejection = await fetchQueue('store-1', undefined, { http }).catch((e) => e)
    expect(rejection).toBeInstanceOf(ApiError)
    expect(rejection.status).toBe(500)
    expect(rejection.message).toMatch(/server had a problem/i)
  })

  it('normalizes a no-response network error (status null)', async () => {
    const err = Object.assign(new Error('Network Error'), { request: {} })
    const http = { get: vi.fn().mockRejectedValue(err), post: vi.fn() }
    const rejection = await fetchQueue('store-1', undefined, { http }).catch((e) => e)
    expect(rejection).toBeInstanceOf(ApiError)
    expect(rejection.status).toBeNull()
    expect(rejection.message).toMatch(/can't reach the server/i)
  })

  it('normalizes a failure on the cooking-details call', async () => {
    const orders = [{ id: 'o1', order_items: [{ menu_item_id: 'burger', qty: 1 }] }]
    const err = Object.assign(new Error('boom'), { response: { status: 500, data: {} } })
    const http = {
      get: vi.fn().mockResolvedValue({ data: orders }),
      post: vi.fn().mockRejectedValue(err),
    }
    const rejection = await fetchQueue('store-1', undefined, { http }).catch((e) => e)
    expect(rejection).toBeInstanceOf(ApiError)
    expect(rejection.status).toBe(500)
  })
})
