// Integration test for composables/useCartEstimate.js — the checkout
// "when would this cart be ready?" estimate. It fetches the store queue + cooking
// details and runs the fresh-order probe (estimateNewOrderWait). The api and
// supabase client are injected and `now` is pinned for a deterministic readyAt.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'

vi.mock('@/common/supabase.js', () => ({ default: {} }))
// waitSettings reads the catalog store; with no store seeded it falls back to
// the config defaults (stations 2, strategy 'scheduled'), which is fine here.

import { useCartEstimate } from '../useCartEstimate.js'

function makeFakeClient() {
  const state = { handler: null, topic: null }
  const channel = {
    on(_t, _o, handler) { state.handler = handler; return channel },
    subscribe(cb) { cb && cb('SUBSCRIBED'); return channel },
  }
  const client = {
    channel: vi.fn((topic) => { state.topic = topic; return channel }),
    removeChannel: vi.fn(),
  }
  return { client, state }
}

function mountWith(storeId, cartLines, options) {
  let api
  const Host = defineComponent({ setup() { api = useCartEstimate(storeId, cartLines, options); return () => h('div') } })
  const wrapper = mount(Host)
  return { wrapper, get: () => api }
}

const NOW = 0
// pasta: 300s, 4 at once. One pasta on an empty queue, 1 station -> 300s.
const COOK = [{ id: 'pasta', cook_time_sec: 300, max_at_once: 4 }]

describe('useCartEstimate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  function fakeApi({ orders = [], details = COOK } = {}) {
    return {
      ordersAhead: vi.fn().mockResolvedValue(orders),
      itemCookingDetails: vi.fn().mockResolvedValue(details),
    }
  }

  it('computes an estimate for a non-empty cart behind an empty queue', async () => {
    const { client } = makeFakeClient()
    const api = fakeApi({ orders: [] })
    const { get } = mountWith('store-1', [{ menu_item_id: 'pasta', qty: 1 }], {
      api, supabaseClient: client, stations: 1, now: () => NOW,
    })
    await flushPromises()
    expect(api.ordersAhead).toHaveBeenCalledWith('store-1', null)
    const est = get().estimate.value
    expect(est).not.toBeNull()
    expect(est.seconds).toBe(300)
    expect(est.ahead).toBe(0)
    expect(est.readyAt).toBe(NOW + 300 * 1000)
  })

  it('returns a null estimate for an empty cart (no server call needed)', async () => {
    const { client } = makeFakeClient()
    const api = fakeApi()
    const { get } = mountWith('store-1', [], { api, supabaseClient: client, now: () => NOW })
    await flushPromises()
    expect(get().estimate.value).toBeNull()
    expect(api.ordersAhead).not.toHaveBeenCalled()
  })

  it('schedules the cart behind an existing queue order', async () => {
    const { client } = makeFakeClient()
    const clock = Date.parse('2026-01-01T12:00:00Z')
    const api = fakeApi({
      // Created an hour before "now" so it sorts ahead of the probe (now+1).
      orders: [{ id: 'a', status: 'placed', created_at: '2026-01-01T11:00:00Z', order_items: [{ menu_item_id: 'pasta', qty: 1 }] }],
    })
    const { get } = mountWith('store-1', [{ menu_item_id: 'pasta', qty: 1 }], {
      api, supabaseClient: client, stations: 1, now: () => clock,
    })
    await flushPromises()
    const est = get().estimate.value
    expect(est.ahead).toBe(1)
    expect(est.seconds).toBe(600) // behind the 5-min order on a single line
  })

  it('recomputes when the cart contents change', async () => {
    const { client } = makeFakeClient()
    const api = fakeApi({ orders: [] })
    const cart = ref([{ menu_item_id: 'pasta', qty: 1 }])
    const { get } = mountWith('store-1', cart, { api, supabaseClient: client, stations: 1, now: () => NOW })
    await flushPromises()
    expect(get().estimate.value.seconds).toBe(300)

    cart.value = [{ menu_item_id: 'pasta', qty: 5 }] // ceil(5/4)=2 batches -> 600s
    await flushPromises()
    expect(get().estimate.value.seconds).toBe(600)
  })

  it('tears down the channel on unmount', async () => {
    const { client } = makeFakeClient()
    const api = fakeApi()
    const { wrapper } = mountWith('store-1', [{ menu_item_id: 'pasta', qty: 1 }], {
      api, supabaseClient: client, stations: 1, now: () => NOW,
    })
    await flushPromises()
    wrapper.unmount()
    expect(client.removeChannel).toHaveBeenCalled()
  })
})
