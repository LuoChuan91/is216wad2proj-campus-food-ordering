import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

// Mock the default supabase import so importing the module needs no env vars.
vi.mock('@/common/supabase.js', () => ({ default: {} }))

import { useStoreOrdersLive } from '../useStoreOrdersLive.js'

// Fake Supabase client capturing the broadcast handler + subscribe callback.
function makeFakeClient() {
  const state = { handler: null, statusCb: null, topic: null, removed: 0 }
  const channel = {
    on(_t, opts, handler) {
      state.event = opts?.event
      state.handler = handler
      return channel
    },
    subscribe(cb) {
      state.statusCb = cb
      cb && cb('SUBSCRIBED')
      return channel
    },
  }
  const client = {
    channel: vi.fn((topic) => {
      state.topic = topic
      return channel
    }),
    removeChannel: vi.fn(() => {
      state.removed++
    }),
  }
  return { client, state }
}

// Mount a host component so the composable's lifecycle hooks run.
function mountWith(args) {
  let api
  const Host = defineComponent({
    setup() {
      api = useStoreOrdersLive(args.storeId, args.options)
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get: () => api }
}

const ORDERS = [
  { id: 'o1', status: 'paid' },
  { id: 'o2', status: 'ready' },
]

describe('useStoreOrdersLive', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('loads orders on mount via the injected fetch and subscribes to the merchant channel', async () => {
    const { client, state } = makeFakeClient()
    const fetchOrders = vi.fn().mockResolvedValue(ORDERS)
    const { get } = mountWith({ storeId: 'store-1', options: { fetchOrders, supabaseClient: client } })
    expect(get().loading.value).toBe(true)
    await flushPromises()

    expect(fetchOrders).toHaveBeenCalledWith('store-1')
    expect(get().orders.value).toEqual(ORDERS)
    expect(get().loading.value).toBe(false)
    expect(get().liveConnected.value).toBe(true)
    expect(client.channel).toHaveBeenCalledWith('merchant-store:store-1')
    expect(state.event).toBe('order_change')
  })

  it('accepts an { orders: [...] } envelope as well as a bare array', async () => {
    const { client } = makeFakeClient()
    const fetchOrders = vi.fn().mockResolvedValue({ orders: ORDERS })
    const { get } = mountWith({ storeId: 'store-1', options: { fetchOrders, supabaseClient: client } })
    await flushPromises()
    expect(get().orders.value).toEqual(ORDERS)
  })

  it('refetches (debounced) when an order_change broadcast arrives', async () => {
    const { client, state } = makeFakeClient()
    const fetchOrders = vi.fn().mockResolvedValue(ORDERS)
    const { get } = mountWith({ storeId: 'store-1', options: { fetchOrders, supabaseClient: client } })
    await flushPromises()
    expect(fetchOrders).toHaveBeenCalledTimes(1)

    const next = [...ORDERS, { id: 'o3', status: 'paid' }]
    fetchOrders.mockResolvedValue(next)
    state.handler({ event: 'order_change', payload: { reason: 'order_paid' } })
    vi.advanceTimersByTime(300) // debounce window
    await flushPromises()

    expect(fetchOrders).toHaveBeenCalledTimes(2)
    expect(get().orders.value).toEqual(next)
  })

  it('keeps the last list and flags stale when a refetch fails', async () => {
    const { client, state } = makeFakeClient()
    const fetchOrders = vi.fn().mockResolvedValue(ORDERS)
    const { get } = mountWith({ storeId: 'store-1', options: { fetchOrders, supabaseClient: client } })
    await flushPromises()

    fetchOrders.mockRejectedValue(new Error('boom'))
    state.handler({ event: 'order_change', payload: {} })
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(get().orders.value).toEqual(ORDERS) // unchanged
    expect(get().stale.value).toBe(true)
    expect(get().error.value).toBeNull()
  })

  it('surfaces an error when the first load fails and there is no data yet', async () => {
    const { client } = makeFakeClient()
    const fetchOrders = vi.fn().mockRejectedValue(new Error('Network down'))
    const { get } = mountWith({ storeId: 'store-1', options: { fetchOrders, supabaseClient: client } })
    await flushPromises()
    expect(get().error.value).toMatch(/network down/i)
    expect(get().orders.value).toEqual([])
  })

  it('falls back to polling when subscribe throws', async () => {
    const client = {
      channel: vi.fn(() => {
        throw new Error('rt down')
      }),
      removeChannel: vi.fn(),
    }
    const fetchOrders = vi.fn().mockResolvedValue(ORDERS)
    const { get } = mountWith({ storeId: 'store-1', options: { fetchOrders, supabaseClient: client, pollMs: 1000 } })
    await flushPromises()
    expect(get().orders.value).toEqual(ORDERS)
    expect(get().liveConnected.value).toBe(false)

    fetchOrders.mockClear()
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(fetchOrders).toHaveBeenCalled() // polling kicked in
  })

  it('re-subscribes and refetches when storeId changes', async () => {
    const { client } = makeFakeClient()
    const fetchOrders = vi.fn().mockResolvedValue(ORDERS)
    const storeId = ref('store-1')
    mountWith({ storeId, options: { fetchOrders, supabaseClient: client } })
    await flushPromises()
    expect(client.channel).toHaveBeenLastCalledWith('merchant-store:store-1')

    storeId.value = 'store-2'
    await flushPromises()
    expect(client.removeChannel).toHaveBeenCalled()
    expect(client.channel).toHaveBeenLastCalledWith('merchant-store:store-2')
    expect(fetchOrders).toHaveBeenLastCalledWith('store-2')
  })

  it('tears down the channel + timers on unmount', async () => {
    const { client } = makeFakeClient()
    const fetchOrders = vi.fn().mockResolvedValue(ORDERS)
    const { wrapper } = mountWith({ storeId: 'store-1', options: { fetchOrders, supabaseClient: client } })
    await flushPromises()
    wrapper.unmount()
    expect(client.removeChannel).toHaveBeenCalled()
  })
})
