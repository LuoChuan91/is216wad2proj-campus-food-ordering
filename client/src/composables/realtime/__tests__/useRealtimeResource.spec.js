// Contract tests for the shared realtime engine. The per-consumer specs
// (useWaitTime, useStoreOrdersLive, ...) stay focused on their own mapping;
// this spec documents and locks the standard behaviour they all delegate to.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

vi.mock('@/common/supabase.js', () => ({ default: {} }))

import { useRealtimeResource } from '../useRealtimeResource.js'

// Fake Supabase client capturing the broadcast handler + subscribe status cb.
function makeFakeClient({ autoSubscribe = false } = {}) {
  const state = { event: null, handler: null, statusCb: null, topic: null, removed: 0 }
  const channel = {
    on(_t, opts, handler) { state.event = opts?.event; state.handler = handler; return channel },
    subscribe(cb) { state.statusCb = cb; if (autoSubscribe) cb && cb('SUBSCRIBED'); return channel },
  }
  const client = {
    channel: vi.fn((topic) => { state.topic = topic; return channel }),
    removeChannel: vi.fn(() => { state.removed++ }),
  }
  return { client, state }
}

function mountWith(config) {
  let api
  const Host = defineComponent({ setup() { api = useRealtimeResource(config); return () => h('div') } })
  const wrapper = mount(Host)
  return { wrapper, get: () => api }
}

describe('useRealtimeResource', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('loads on mount, subscribes, and exposes data', async () => {
    const { client, state } = makeFakeClient({ autoSubscribe: true })
    const load = vi.fn().mockResolvedValue([1, 2, 3])
    const { get } = mountWith({ channel: () => 'c:1', event: 'change', load, supabaseClient: client })
    expect(get().loading.value).toBe(true)
    await flushPromises()
    expect(load).toHaveBeenCalledTimes(1)
    expect(get().data.value).toEqual([1, 2, 3])
    expect(get().loading.value).toBe(false)
    expect(get().liveConnected.value).toBe(true)
    expect(client.channel).toHaveBeenCalledWith('c:1')
    expect(state.event).toBe('change')
  })

  it('once SUBSCRIBED, does not poll (single-speed)', async () => {
    const { client, state } = makeFakeClient()
    const load = vi.fn().mockResolvedValue('x')
    mountWith({ channel: () => 'c:1', event: 'e', load, supabaseClient: client, pollMs: 1000 })
    await flushPromises()
    state.statusCb('SUBSCRIBED')
    load.mockClear()
    vi.advanceTimersByTime(5000)
    expect(load).not.toHaveBeenCalled()
  })

  it('polls when the channel goes down', async () => {
    const { client, state } = makeFakeClient()
    const load = vi.fn().mockResolvedValue('x')
    mountWith({ channel: () => 'c:1', event: 'e', load, supabaseClient: client, pollMs: 1000 })
    await flushPromises()
    state.statusCb('CHANNEL_ERROR')
    load.mockClear()
    vi.advanceTimersByTime(2000)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('polls permanently when there is no usable client', async () => {
    const load = vi.fn().mockResolvedValue('x')
    mountWith({ channel: () => 'c:1', event: 'e', load, supabaseClient: null, pollMs: 1000 })
    await flushPromises()
    load.mockClear()
    vi.advanceTimersByTime(3000)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('debounces a burst of broadcasts into one refetch', async () => {
    const { client, state } = makeFakeClient({ autoSubscribe: true })
    const load = vi.fn().mockResolvedValue('x')
    mountWith({ channel: () => 'c:1', event: 'e', load, supabaseClient: client })
    await flushPromises()
    load.mockClear()
    state.handler({}); state.handler({}); state.handler({})
    vi.advanceTimersByTime(300)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps last data and flags stale when a refetch fails', async () => {
    const { client, state } = makeFakeClient({ autoSubscribe: true })
    const load = vi.fn().mockResolvedValue('good')
    const { get } = mountWith({ channel: () => 'c:1', event: 'e', load, supabaseClient: client })
    await flushPromises()
    load.mockRejectedValue(new Error('boom'))
    state.handler({})
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(get().data.value).toBe('good')
    expect(get().stale.value).toBe(true)
    expect(get().error.value).toBeNull()
  })

  it('surfaces an error when the first load fails with no data', async () => {
    const { client } = makeFakeClient({ autoSubscribe: true })
    const load = vi.fn().mockRejectedValue(new Error('Network down'))
    const { get } = mountWith({ channel: () => 'c:1', event: 'e', load, supabaseClient: client, errorMessage: 'nope' })
    await flushPromises()
    expect(get().error.value).toMatch(/network down/i)
  })

  it('two-speed mode: safety poll while connected, fast poll while down', async () => {
    const { client, state } = makeFakeClient()
    const load = vi.fn().mockResolvedValue('x')
    mountWith({ channel: () => 'c:1', event: 'e', load, supabaseClient: client, pollMs: 1000, safetyMs: 10000 })
    await flushPromises()
    // connected -> only the slow safety net fires
    state.statusCb('SUBSCRIBED')
    load.mockClear()
    vi.advanceTimersByTime(1000)
    expect(load).not.toHaveBeenCalled()
    vi.advanceTimersByTime(9000)
    expect(load).toHaveBeenCalledTimes(1)
    // down -> fast poll
    state.statusCb('CLOSED')
    load.mockClear()
    vi.advanceTimersByTime(1000)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('subscribe-only mode hands the payload to onBroadcast and never polls', async () => {
    const { client, state } = makeFakeClient({ autoSubscribe: true })
    const onBroadcast = vi.fn()
    mountWith({ channel: () => 'c:1', event: 'e', onBroadcast, supabaseClient: client, pollMs: 1000 })
    await flushPromises()
    state.handler({ payload: { a: 1 } })
    expect(onBroadcast).toHaveBeenCalledWith({ payload: { a: 1 } })
    onBroadcast.mockClear()
    vi.advanceTimersByTime(5000) // SUBSCRIBED + no load -> no polling
    expect(onBroadcast).not.toHaveBeenCalled()
  })

  it('a null channel name means do not subscribe or poll', async () => {
    const { client } = makeFakeClient()
    const load = vi.fn().mockResolvedValue('x')
    mountWith({ channel: () => null, event: 'e', load, supabaseClient: client, pollMs: 1000 })
    await flushPromises()
    expect(client.channel).not.toHaveBeenCalled()
    load.mockClear()
    vi.advanceTimersByTime(3000)
    expect(load).not.toHaveBeenCalled()
  })

  it('re-wires when the key changes (teardown old, subscribe new)', async () => {
    const { client } = makeFakeClient({ autoSubscribe: true })
    const load = vi.fn().mockResolvedValue('x')
    const storeId = ref('s1')
    mountWith({ channel: () => `store:${storeId.value}`, event: 'e', load, key: () => storeId.value, supabaseClient: client })
    await flushPromises()
    expect(client.channel).toHaveBeenLastCalledWith('store:s1')
    storeId.value = 's2'
    await flushPromises()
    expect(client.removeChannel).toHaveBeenCalled()
    expect(client.channel).toHaveBeenLastCalledWith('store:s2')
  })

  it('enabled gate: off = no subscribe/poll; turning on starts', async () => {
    const { client } = makeFakeClient({ autoSubscribe: true })
    const load = vi.fn().mockResolvedValue('x')
    const enabled = ref(false)
    const { get } = mountWith({ channel: () => 'c:1', event: 'e', load, enabled, supabaseClient: client, pollMs: 1000 })
    await flushPromises()
    expect(client.channel).not.toHaveBeenCalled()
    expect(get().loading.value).toBe(false)
    enabled.value = true
    await flushPromises()
    expect(client.channel).toHaveBeenCalledWith('c:1')
    expect(load).toHaveBeenCalled()
  })

  it('manageLifecycle:false lets the caller drive start()/stop()', async () => {
    const { client } = makeFakeClient({ autoSubscribe: true })
    const load = vi.fn().mockResolvedValue('x')
    // No host component needed; call outside setup.
    const api = useRealtimeResource({ channel: () => 'c:1', event: 'e', load, supabaseClient: client, manageLifecycle: false })
    expect(client.channel).not.toHaveBeenCalled() // nothing until start()
    api.start()
    await flushPromises()
    expect(client.channel).toHaveBeenCalledWith('c:1')
    api.stop()
    expect(client.removeChannel).toHaveBeenCalled()
  })
})
