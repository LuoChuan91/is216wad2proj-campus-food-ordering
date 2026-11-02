// Integration test for composables/useOpenDeliveries.js — the courier open-jobs
// live layer. Same realtime-primary / polling-fallback contract as the other
// live composables; here we also exercise the `enabled` toggle (courier's
// "Open to Jobs" switch). Fake timers + an injected fetch + a fake Supabase
// client keep it deterministic and offline.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

vi.mock('@/common/supabase.js', () => ({ default: {} }))
vi.mock('@/services/api.js', () => ({ api: { openJobs: vi.fn() } }))

import { useOpenDeliveriesLive } from '../useOpenDeliveries.js'

function makeFakeClient() {
  const state = { handler: null, statusCb: null, topic: null, event: null, removed: 0 }
  const channel = {
    on(_t, opts, handler) { state.event = opts?.event; state.handler = handler; return channel },
    subscribe(cb) { state.statusCb = cb; cb && cb('SUBSCRIBED'); return channel },
  }
  const client = {
    channel: vi.fn((topic) => { state.topic = topic; return channel }),
    removeChannel: vi.fn(() => { state.removed++ }),
  }
  return { client, state }
}

function mountWith(options) {
  let api
  const Host = defineComponent({ setup() { api = useOpenDeliveriesLive(options); return () => h('div') } })
  const wrapper = mount(Host)
  return { wrapper, get: () => api }
}

const JOBS = [{ id: 'j1', status: 'open' }, { id: 'j2', status: 'open' }]

describe('useOpenDeliveriesLive', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('loads jobs on mount and subscribes to the courier-jobs channel', async () => {
    const { client, state } = makeFakeClient()
    const fetchDeliveries = vi.fn().mockResolvedValue(JOBS)
    const { get } = mountWith({ fetchDeliveries, supabaseClient: client })
    await flushPromises()
    expect(fetchDeliveries).toHaveBeenCalled()
    expect(get().deliveries.value).toEqual(JOBS)
    expect(get().liveConnected.value).toBe(true)
    expect(client.channel).toHaveBeenCalledWith('courier-jobs')
    expect(state.event).toBe('delivery_change')
  })

  it('accepts a { deliveries: [...] } envelope', async () => {
    const { client } = makeFakeClient()
    const fetchDeliveries = vi.fn().mockResolvedValue({ deliveries: JOBS })
    const { get } = mountWith({ fetchDeliveries, supabaseClient: client })
    await flushPromises()
    expect(get().deliveries.value).toEqual(JOBS)
  })

  it('refetches (debounced) when a delivery_change broadcast arrives', async () => {
    const { client, state } = makeFakeClient()
    const fetchDeliveries = vi.fn().mockResolvedValue(JOBS)
    const { get } = mountWith({ fetchDeliveries, supabaseClient: client })
    await flushPromises()
    const next = [...JOBS, { id: 'j3', status: 'open' }]
    fetchDeliveries.mockResolvedValue(next)
    state.handler({ event: 'delivery_change', payload: {} })
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(get().deliveries.value).toEqual(next)
  })

  it('keeps the last list and flags stale when a refetch fails', async () => {
    const { client, state } = makeFakeClient()
    const fetchDeliveries = vi.fn().mockResolvedValue(JOBS)
    const { get } = mountWith({ fetchDeliveries, supabaseClient: client })
    await flushPromises()
    fetchDeliveries.mockRejectedValue(new Error('boom'))
    state.handler({ event: 'delivery_change', payload: {} })
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(get().deliveries.value).toEqual(JOBS)
    expect(get().stale.value).toBe(true)
    expect(get().error.value).toBeNull()
  })

  it('surfaces an error when the first load fails with no data yet', async () => {
    const { client } = makeFakeClient()
    const fetchDeliveries = vi.fn().mockRejectedValue(new Error('Network down'))
    const { get } = mountWith({ fetchDeliveries, supabaseClient: client })
    await flushPromises()
    expect(get().error.value).toMatch(/network down/i)
    expect(get().deliveries.value).toEqual([])
  })

  it('does not subscribe or load while disabled, then starts when enabled flips on', async () => {
    const { client } = makeFakeClient()
    const fetchDeliveries = vi.fn().mockResolvedValue(JOBS)
    const enabled = ref(false)
    const { get } = mountWith({ enabled, fetchDeliveries, supabaseClient: client })
    await flushPromises()
    expect(fetchDeliveries).not.toHaveBeenCalled()
    expect(client.channel).not.toHaveBeenCalled()

    enabled.value = true
    await flushPromises()
    expect(fetchDeliveries).toHaveBeenCalled()
    expect(client.channel).toHaveBeenCalledWith('courier-jobs')

    // Turning it back off tears down and clears the list.
    enabled.value = false
    await flushPromises()
    expect(client.removeChannel).toHaveBeenCalled()
    expect(get().deliveries.value).toEqual([])
  })

  it('tears down the channel on unmount', async () => {
    const { client } = makeFakeClient()
    const fetchDeliveries = vi.fn().mockResolvedValue(JOBS)
    const { wrapper } = mountWith({ fetchDeliveries, supabaseClient: client })
    await flushPromises()
    wrapper.unmount()
    expect(client.removeChannel).toHaveBeenCalled()
  })
})
