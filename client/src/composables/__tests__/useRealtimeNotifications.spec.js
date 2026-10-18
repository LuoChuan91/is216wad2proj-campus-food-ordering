import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

// Mock the default supabase import so importing modules needs no env vars.
vi.mock('@/common/supabase.js', () => ({ default: {} }))

import { useRealtimeNotifications } from '../useRealtimeNotifications.js'
import { useAuthStore } from '@/stores/auth.js'
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

// Host component that activates the composable with an injected client.
function mountHost(client) {
  const Host = defineComponent({
    setup() {
      useRealtimeNotifications({ supabaseClient: client })
      return () => h('div')
    },
  })
  return mount(Host)
}

describe('useRealtimeNotifications', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('subscribes to user:<id> once a user id is known', async () => {
    const { client, state } = makeClient()
    const auth = useAuthStore()
    auth.userId = 'user-9'
    mountHost(client)
    await flushPromises()
    expect(client.channel).toHaveBeenCalledWith('user:user-9')
    expect(state.topic).toBe('user:user-9')
  })

  it('routes an incoming broadcast payload into the notifications store', async () => {
    const { client, state } = makeClient()
    const auth = useAuthStore()
    const notifications = useNotificationsStore()
    auth.userId = 'user-9'
    mountHost(client)
    await flushPromises()

    // Simulate a broadcast message shape { event, payload }.
    state.handler({ event: 'notification', payload: { kind: 'order', status: 'ready', order_id: 'o1' } })
    expect(notifications.items).toHaveLength(1)
    expect(notifications.items[0]).toMatchObject({ title: 'Order ready', orderId: 'o1' })
    expect(notifications.toasts).toHaveLength(1)
  })

  it('re-subscribes when the user id changes and tears down the old channel', async () => {
    const { client } = makeClient()
    const auth = useAuthStore()
    auth.userId = 'user-1'
    mountHost(client)
    await flushPromises()
    expect(client.channel).toHaveBeenLastCalledWith('user:user-1')

    auth.userId = 'user-2'
    await flushPromises()
    expect(client.removeChannel).toHaveBeenCalled() // old channel removed
    expect(client.channel).toHaveBeenLastCalledWith('user:user-2')
  })

  it('does not subscribe when there is no user', async () => {
    const { client } = makeClient()
    const auth = useAuthStore()
    auth.userId = null
    mountHost(client)
    await flushPromises()
    expect(client.channel).not.toHaveBeenCalled()
  })

  it('tears down the channel on unmount', async () => {
    const { client } = makeClient()
    const auth = useAuthStore()
    auth.userId = 'user-1'
    const wrapper = mountHost(client)
    await flushPromises()
    wrapper.unmount()
    expect(client.removeChannel).toHaveBeenCalled()
  })
})
