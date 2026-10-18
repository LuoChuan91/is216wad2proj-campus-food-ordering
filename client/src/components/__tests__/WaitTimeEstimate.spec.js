import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// Mock the data-access helper so the component never hits the network.
vi.mock('@/utils/waitTimeApi.js', () => ({
  fetchQueue: vi.fn(),
}))
// Mock the real browser client import so importing the component does not
// require VITE_SUPABASE_* env vars. We inject a fake client via props anyway.
vi.mock('@/common/supabase.js', () => ({ default: {} }))

import { fetchQueue } from '@/utils/waitTimeApi.js'
import WaitTimeEstimate from '../WaitTimeEstimate.vue'

// A fake Supabase client whose channel captures the broadcast handler so the
// test can fire a 'queue_change' event on demand.
function makeFakeClient() {
  const state = { handler: null, subscribeCb: null, removed: false, topic: null }
  const channel = {
    on(_type, _opts, handler) {
      state.handler = handler
      return channel
    },
    subscribe(cb) {
      state.subscribeCb = cb
      // Simulate a successful live connection.
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
      state.removed = true
    }),
  }
  return { client, state }
}

const queue = {
  orderItems: [{ menu_item_id: 'burger', qty: 2 }],
  cookingDetails: [{ id: 'burger', cook_time_sec: 60, max_at_once: 2 }],
}

describe('WaitTimeEstimate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchQueue.mockReset()
    fetchQueue.mockResolvedValue(queue)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches on mount and renders the formatted estimate', async () => {
    const { client } = makeFakeClient()
    const wrapper = mount(WaitTimeEstimate, {
      props: { storeId: 'store-1', supabaseClient: client },
    })
    // Loading state first.
    expect(wrapper.text()).toContain('Estimating wait')

    await flushPromises()
    // burger qty 2, batch 2 -> 1 batch * 60s = 60s -> "~1 min"
    expect(fetchQueue).toHaveBeenCalledWith('store-1', null)
    expect(wrapper.text()).toContain('~1 min')
    expect(client.channel).toHaveBeenCalledWith('store:store-1')
    expect(wrapper.text()).toContain('live')
  })

  it('refetches when a broadcast arrives', async () => {
    const { client, state } = makeFakeClient()
    const wrapper = mount(WaitTimeEstimate, {
      props: { storeId: 'store-1', supabaseClient: client },
    })
    await flushPromises()
    expect(fetchQueue).toHaveBeenCalledTimes(1)

    // New queue after the broadcast: more burgers -> longer wait.
    fetchQueue.mockResolvedValue({
      orderItems: [{ menu_item_id: 'burger', qty: 6 }], // ceil(6/2)=3 * 60 = 180 -> ~3 min
      cookingDetails: queue.cookingDetails,
    })

    // Fire the broadcast handler the component registered.
    state.handler({ event: 'queue_change', payload: { reason: 'order_created' } })
    // Debounced by 300ms inside the component.
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(fetchQueue).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('~3 min')
  })

  it('shows the error message when the first load fails and there is no estimate', async () => {
    fetchQueue.mockRejectedValue(new Error("Can't reach the server. Check your connection."))
    const { client } = makeFakeClient()
    const wrapper = mount(WaitTimeEstimate, {
      props: { storeId: 'store-1', supabaseClient: client },
    })
    await flushPromises()
    expect(wrapper.text()).toContain("Can't reach the server")
  })

  it('keeps the last estimate and marks it stale when a refetch fails', async () => {
    const { client, state } = makeFakeClient()
    const wrapper = mount(WaitTimeEstimate, {
      props: { storeId: 'store-1', supabaseClient: client },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('~1 min') // good first load

    // Next refetch (triggered by a broadcast) fails.
    fetchQueue.mockRejectedValue(new Error('boom'))
    state.handler({ event: 'queue_change', payload: {} })
    vi.advanceTimersByTime(300)
    await flushPromises()

    // Old estimate is still shown, plus a 'stale' badge; no error text.
    expect(wrapper.text()).toContain('~1 min')
    expect(wrapper.text()).toContain('stale')
    expect(wrapper.text()).not.toContain('unavailable')
  })

  it('passes orderId through to fetchQueue', async () => {
    const { client } = makeFakeClient()
    mount(WaitTimeEstimate, {
      props: { storeId: 'store-1', orderId: 'order-9', supabaseClient: client },
    })
    await flushPromises()
    expect(fetchQueue).toHaveBeenCalledWith('store-1', 'order-9')
  })

  it('removes the channel on unmount', async () => {
    const { client } = makeFakeClient()
    const wrapper = mount(WaitTimeEstimate, {
      props: { storeId: 'store-1', supabaseClient: client },
    })
    await flushPromises()
    wrapper.unmount()
    expect(client.removeChannel).toHaveBeenCalled()
  })

  it('falls back to polling when subscribe throws', async () => {
    // A client whose .channel() throws should not break the component.
    const client = {
      channel: vi.fn(() => {
        throw new Error('realtime down')
      }),
      removeChannel: vi.fn(),
    }
    const wrapper = mount(WaitTimeEstimate, {
      props: { storeId: 'store-1', supabaseClient: client, pollMs: 1000 },
    })
    await flushPromises()
    // Still rendered the estimate from the initial load.
    expect(wrapper.text()).toContain('~1 min')
    expect(wrapper.text()).not.toContain('live')

    // Polling fallback should refetch on its interval.
    fetchQueue.mockClear()
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(fetchQueue).toHaveBeenCalled()
    wrapper.unmount()
  })
})
