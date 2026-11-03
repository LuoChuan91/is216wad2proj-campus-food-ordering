import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'

// Mock the default supabase import so importing modules needs no env vars.
vi.mock('@/common/supabase.js', () => ({ default: {} }))

import { useRealtimeNotifications } from '../useRealtimeNotifications.js'
import { useSessionStore } from '@/stores/session.js'
import { useNotificationsStore } from '@/stores/notifications.js'

// Fake Supabase client capturing the broadcast handler and channel topic.
function makeClient() {
  const state = { handler: null, topic: null, removed: 0 }
  const channel = {
    on(_type, _opts, handler) {
      state.handler = handler
      return channel
    },
    subscribe() {
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

// Host component that activates the composable with an injected client. A userId
// source (ref/getter/value) can be injected; otherwise it follows the session store.
function mountHost(client, userId) {
  const Host = defineComponent({
    setup() {
      useRealtimeNotifications({ supabaseClient: client, userId })
      return () => h('div')
    },
  })
  return mount(Host)
}

describe('useRealtimeNotifications', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('subscribes to user:<id> from the session store', async () => {
    const { client, state } = makeClient()
    // The session store is the single source of truth for who's signed in.
    useSessionStore().session.userId = 'user-9'
    mountHost(client)
    await flushPromises()
    expect(client.channel).toHaveBeenCalledWith('user:user-9')
    expect(state.topic).toBe('user:user-9')
  })

  it('routes an incoming broadcast payload into the notifications store', async () => {
    const { client, state } = makeClient()
    const notifications = useNotificationsStore()
    useSessionStore().session.userId = 'user-9'
    mountHost(client)
    await flushPromises()

    // Simulate a broadcast message shape { event, payload }.
    state.handler({ event: 'notification', payload: { kind: 'order', status: 'ready', order_id: 'o1' } })
    expect(notifications.items).toHaveLength(1)
    expect(notifications.items[0]).toMatchObject({ title: 'Your food is ready', orderId: 'o1' })
    expect(notifications.toasts).toHaveLength(1)
  })

  it('re-subscribes when the user id changes and tears down the old channel', async () => {
    const { client } = makeClient()
    const userId = ref('user-1')
    mountHost(client, userId)
    await flushPromises()
    expect(client.channel).toHaveBeenLastCalledWith('user:user-1')

    userId.value = 'user-2'
    await flushPromises()
    expect(client.removeChannel).toHaveBeenCalled() // old channel removed
    expect(client.channel).toHaveBeenLastCalledWith('user:user-2')
  })

  it('does not subscribe when there is no user', async () => {
    const { client } = makeClient()
    useSessionStore().session.userId = null
    mountHost(client)
    await flushPromises()
    expect(client.channel).not.toHaveBeenCalled()
  })

  it('tears down the channel on unmount', async () => {
    const { client } = makeClient()
    const wrapper = mountHost(client, ref('user-1'))
    await flushPromises()
    wrapper.unmount()
    expect(client.removeChannel).toHaveBeenCalled()
  })
})
