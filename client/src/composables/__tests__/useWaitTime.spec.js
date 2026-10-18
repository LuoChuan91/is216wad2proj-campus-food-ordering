import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

vi.mock('@/utils/waitTimeApi.js', () => ({ fetchQueue: vi.fn() }))
vi.mock('@/common/supabase.js', () => ({ default: {} }))

import { fetchQueue } from '@/utils/waitTimeApi.js'
import { useWaitTime } from '../useWaitTime.js'

// Fake client capturing the broadcast handler + subscribe status callback.
function makeFakeClient() {
  const state = { handler: null, statusCb: null, topic: null, removed: 0 }
  const channel = {
    on(_t, _o, handler) {
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

const QUEUE = {
  orderItems: [{ menu_item_id: 'burger', qty: 2 }],
  cookingDetails: [{ id: 'burger', cook_time_sec: 60, max_at_once: 2 }],
}

// Mount a host that exposes the composable's return for assertions.
function mountWith(args) {
  let api
  const Host = defineComponent({
    setup() {
      api = useWaitTime(args.storeId, args.orderId, args.options)
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get: () => api }
}

describe('useWaitTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchQueue.mockReset()
    fetchQueue.mockResolvedValue(QUEUE)
  })
  afterEach(() => vi.useRealTimers())

  it('loads on mount and exposes seconds', async () => {
    const { client } = makeFakeClient()
    const { get } = mountWith({ storeId: 'store-1', orderId: null, options: { supabaseClient: client } })
    expect(get().loading.value).toBe(true)
    await flushPromises()
    expect(fetchQueue).toHaveBeenCalledWith('store-1', null)
    expect(get().seconds.value).toBe(60) // 2 burgers, batch 2 -> 1 batch * 60
    expect(get().loading.value).toBe(false)
    expect(get().liveConnected.value).toBe(true)
    expect(client.channel).toHaveBeenCalledWith('store:store-1')
  })

  it('refetches on a broadcast (debounced)', async () => {
    const { client, state } = makeFakeClient()
    const { get } = mountWith({ storeId: 'store-1', orderId: null, options: { supabaseClient: client } })
    await flushPromises()
    fetchQueue.mockResolvedValue({
      orderItems: [{ menu_item_id: 'burger', qty: 6 }], // 3 batches * 60 = 180
      cookingDetails: QUEUE.cookingDetails,
    })
    state.handler({ event: 'queue_change', payload: {} })
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(get().seconds.value).toBe(180)
  })

  it('keeps last estimate and marks stale when a refetch fails', async () => {
    const { client, state } = makeFakeClient()
    const { get } = mountWith({ storeId: 'store-1', orderId: null, options: { supabaseClient: client } })
    await flushPromises()
    expect(get().seconds.value).toBe(60)
    fetchQueue.mockRejectedValue(new Error('boom'))
    state.handler({ event: 'queue_change', payload: {} })
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(get().seconds.value).toBe(60) // unchanged
    expect(get().stale.value).toBe(true)
    expect(get().error.value).toBeNull()
  })

  it('surfaces error when the first load fails and no estimate exists', async () => {
    fetchQueue.mockRejectedValue(new Error('Network down'))
    const { client } = makeFakeClient()
    const { get } = mountWith({ storeId: 'store-1', orderId: null, options: { supabaseClient: client } })
    await flushPromises()
    expect(get().error.value).toMatch(/network down/i)
  })

  it('falls back to polling when subscribe throws', async () => {
    const client = {
      channel: vi.fn(() => {
        throw new Error('rt down')
      }),
      removeChannel: vi.fn(),
    }
    const { get } = mountWith({ storeId: 'store-1', orderId: null, options: { supabaseClient: client, pollMs: 1000 } })
    await flushPromises()
    expect(get().seconds.value).toBe(60)
    expect(get().liveConnected.value).toBe(false)
    fetchQueue.mockClear()
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(fetchQueue).toHaveBeenCalled()
  })

  it('reacts to a changing storeId ref (re-subscribes)', async () => {
    const { client } = makeFakeClient()
    const storeId = ref('store-1')
    mountWith({ storeId, orderId: null, options: { supabaseClient: client } })
    await flushPromises()
    expect(client.channel).toHaveBeenLastCalledWith('store:store-1')
    storeId.value = 'store-2'
    await flushPromises()
    expect(client.removeChannel).toHaveBeenCalled()
    expect(client.channel).toHaveBeenLastCalledWith('store:store-2')
  })

  it('tears down channel + timers on unmount', async () => {
    const { client } = makeFakeClient()
    const { wrapper } = mountWith({ storeId: 'store-1', orderId: null, options: { supabaseClient: client } })
    await flushPromises()
    wrapper.unmount()
    expect(client.removeChannel).toHaveBeenCalled()
  })
})
