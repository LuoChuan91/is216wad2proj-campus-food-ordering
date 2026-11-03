import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth.js'

// The auth store is the READ side of auth: it just mirrors the signed-in user id
// that the session store pushes in via setUserId(). There is no Supabase session
// plumbing here any more (the session store is the single source of truth, and it
// calls setUserId on signIn/signOut — see stores/session.js). These tests cover
// that mirror behaviour directly.
describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty and not ready', () => {
    const store = useAuthStore()
    expect(store.userId).toBeNull()
    expect(store.ready).toBe(false)
  })

  it('setUserId stores the id and marks the session resolved', () => {
    const store = useAuthStore()
    store.setUserId('user-123')
    expect(store.userId).toBe('user-123')
    expect(store.ready).toBe(true)
  })

  it('setUserId(null) clears the id but stays resolved (sign-out)', () => {
    const store = useAuthStore()
    store.setUserId('user-1')
    store.setUserId(null)
    expect(store.userId).toBeNull()
    expect(store.ready).toBe(true)
  })

  it('setUserId(undefined) is treated as null', () => {
    const store = useAuthStore()
    store.setUserId(undefined)
    expect(store.userId).toBeNull()
    expect(store.ready).toBe(true)
  })

  it('reflects successive sign-ins (account switch)', () => {
    const store = useAuthStore()
    store.setUserId('user-1')
    expect(store.userId).toBe('user-1')
    store.setUserId('user-2')
    expect(store.userId).toBe('user-2')
  })
})
