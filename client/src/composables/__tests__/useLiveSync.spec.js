import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

vi.mock('@/common/supabase.js', () => ({ default: {} }))
vi.mock('@/config/index.js', () => ({ config: { pollMs: 4000 } }))

import { useLiveSync } from '../useLiveSync.js'

function makeFakeClient() {
  const state = { event: null, handler: null, statusCb: null, topic: null, removed: 0 }
  const channel = {
    on(_type, opts, handler) { state.event = opts?.event; state.handler = handler; return channel },
    subscribe(cb) { state.statusCb = cb; return channel }, // NOTE: not auto-SUBSCRIBED; test drives it
  }
  const client = {
    channel: vi.fn((topic) => { state.topic = topic; return channel }),
    removeChannel: vi.fn(() => { state.removed++ }),
  }
  return { client, state }
}

function mountWith(args) {
  let api
  const Host = defineComponent({
    setup() { api = useLiveSync(args.userId, args.refresh, args.options); return () => h('div') },
  })
  const wrapper = mount(Host)
  return { wrapper, get: () => api }
}

describe('useLiveSync', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('subscribes to user:<id> and, once SUBSCRIBED, only runs the slow safety poll (not the fast poll)', async () => {
    const { client, state } = makeFakeClient()
    const refresh = vi.fn()
    const { get } = mountWith({ userId: 'u1', refresh, options: { supabaseClient: client, pollMs: 4000, safetyMs: 60000 } })
    await flushPromises()
    expect(client.channel).toHaveBeenCalledWith('user:u1')
    expect(state.event).toBe('*')

    state.statusCb('SUBSCRIBED')
    expect(get().liveConnected.value).toBe(true)

    // Fast interval should NOT fire while connected...
    vi.advanceTimersByTime(4000)
    expect(refresh).not.toHaveBeenCalled()
    // ...but the slow safety net should.
    vi.advanceTimersByTime(60000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refetches (debounced) on a broadcast while connected', async () => {
    const { client, state } = makeFakeClient()
    const refresh = vi.fn()
    mountWith({ userId: 'u1', refresh, options: { supabaseClient: client } })
    await flushPromises()
    state.statusCb('SUBSCRIBED')

    state.handler({ event: 'notification', payload: {} })
    vi.advanceTimersByTime(300)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('falls back to fast polling when the channel errors', async () => {
    const { client, state } = makeFakeClient()
    const refresh = vi.fn()
    mountWith({ userId: 'u1', refresh, options: { supabaseClient: client, pollMs: 4000 } })
    await flushPromises()
    state.statusCb('CHANNEL_ERROR')
    vi.advanceTimersByTime(4000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('polls (fast) permanently when there is no supabase client', async () => {
    const refresh = vi.fn()
    mountWith({ userId: 'u1', refresh, options: { supabaseClient: null, pollMs: 4000 } })
    await flushPromises()
    vi.advanceTimersByTime(8000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('does not subscribe or poll when there is no user', async () => {
    const { client } = makeFakeClient()
    const refresh = vi.fn()
    mountWith({ userId: null, refresh, options: { supabaseClient: client, pollMs: 4000 } })
    await flushPromises()
    expect(client.channel).not.toHaveBeenCalled()
    vi.advanceTimersByTime(8000)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('re-subscribes when the user id changes', async () => {
    const { client } = makeFakeClient()
    const refresh = vi.fn()
    const userId = ref('u1')
    mountWith({ userId, refresh, options: { supabaseClient: client } })
    await flushPromises()
    expect(client.channel).toHaveBeenLastCalledWith('user:u1')
    userId.value = 'u2'
    await flushPromises()
    expect(client.removeChannel).toHaveBeenCalled()
    expect(client.channel).toHaveBeenLastCalledWith('user:u2')
  })

  it('tears down on unmount', async () => {
    const { client } = makeFakeClient()
    const refresh = vi.fn()
    const { wrapper } = mountWith({ userId: 'u1', refresh, options: { supabaseClient: client } })
    await flushPromises()
    wrapper.unmount()
    expect(client.removeChannel).toHaveBeenCalled()
  })
})
