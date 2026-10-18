import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth.js'

// Build a fake Supabase auth client.
function makeClient({ userId = null } = {}) {
  const subscription = { unsubscribe: vi.fn() }
  return {
    _cb: null,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
      onAuthStateChange: vi.fn(function (cb) {
        this._cb = cb
        return { data: { subscription } }
      }),
    },
    _subscription: subscription,
  }
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads the current user id from the session', async () => {
    const store = useAuthStore()
    await store.init(makeClient({ userId: 'user-123' }))
    expect(store.userId).toBe('user-123')
    expect(store.ready).toBe(true)
  })

  it('sets userId null when there is no session', async () => {
    const store = useAuthStore()
    await store.init(makeClient({ userId: null }))
    expect(store.userId).toBeNull()
    expect(store.ready).toBe(true)
  })

  it('updates userId on auth state change', async () => {
    const store = useAuthStore()
    const client = makeClient({ userId: 'user-1' })
    await store.init(client)
    expect(store.userId).toBe('user-1')
    // Simulate a logout then login via the registered callback.
    client.auth._cb('SIGNED_OUT', null)
    expect(store.userId).toBeNull()
    client.auth._cb('SIGNED_IN', { user: { id: 'user-2' } })
    expect(store.userId).toBe('user-2')
  })

  it('stop() unsubscribes from auth changes', async () => {
    const store = useAuthStore()
    const client = makeClient({ userId: 'user-1' })
    await store.init(client)
    store.stop()
    expect(client._subscription.unsubscribe).toHaveBeenCalled()
  })

  it('ready becomes true even if getUser throws', async () => {
    const store = useAuthStore()
    const client = { auth: { getUser: vi.fn().mockRejectedValue(new Error('no net')) } }
    await store.init(client)
    expect(store.userId).toBeNull()
    expect(store.ready).toBe(true)
  })
})
