import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationsStore } from '../notifications.js'

describe('notifications store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('records a mapped notification in history and returns it', () => {
    const store = useNotificationsStore()
    const n = store.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    expect(n).toBeTruthy()
    expect(store.items).toHaveLength(1)
    expect(store.items[0]).toMatchObject({ title: 'Your food is ready', orderId: 'o1', read: false })
  })

  it('pushes a toast only for toast statuses', () => {
    const store = useNotificationsStore()
    store.receive({ kind: 'order', status: 'ready' }) // toast
    store.receive({ kind: 'order', status: 'paid' }) // not a toast
    expect(store.items).toHaveLength(2)
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0].status).toBe('ready')
  })

  it('ignores unmapped statuses (returns null, records nothing)', () => {
    const store = useNotificationsStore()
    const n = store.receive({ kind: 'order', status: 'pending' })
    expect(n).toBeNull()
    expect(store.items).toHaveLength(0)
    expect(store.toasts).toHaveLength(0)
  })

  it('newest notification is first', () => {
    const store = useNotificationsStore()
    store.receive({ kind: 'order', status: 'paid' })
    store.receive({ kind: 'order', status: 'ready' })
    expect(store.items[0].status).toBe('ready')
    expect(store.items[1].status).toBe('paid')
  })

  it('dismissToast removes from toasts but keeps history', () => {
    const store = useNotificationsStore()
    const n = store.receive({ kind: 'delivery', status: 'accepted' })
    expect(store.toasts).toHaveLength(1)
    store.dismissToast(n.id)
    expect(store.toasts).toHaveLength(0)
    expect(store.items).toHaveLength(1)
  })

  it('markRead flips the read flag; clear empties both', () => {
    const store = useNotificationsStore()
    const n = store.receive({ kind: 'order', status: 'ready' })
    store.markRead(n.id)
    expect(store.items[0].read).toBe(true)
    store.clear()
    expect(store.items).toHaveLength(0)
    expect(store.toasts).toHaveLength(0)
  })
})


describe('notifications store: per-user persistence (survives refresh)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    try { sessionStorage.clear() } catch { /* ignore */ }
  })

  it('persists history under the user and rehydrates it on a simulated refresh', () => {
    // First "page load": the session hydrates for a user, a notification arrives.
    const a = useNotificationsStore()
    a.hydrate('stu', { fresh: true })
    a.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    expect(a.items).toHaveLength(1)
    expect(a.toasts).toHaveLength(1)

    // Simulate a refresh: brand-new pinia + store, restore (fresh:false) same user.
    setActivePinia(createPinia())
    const b = useNotificationsStore()
    b.hydrate('stu') // restore path
    expect(b.items).toHaveLength(1) // history survived
    expect(b.items[0]).toMatchObject({ title: 'Your food is ready', orderId: 'o1' })
    expect(b.toasts).toHaveLength(0) // toasts do NOT resurrect
  })

  it('a fresh sign-in wipes stale stored history for that user', () => {
    const a = useNotificationsStore()
    a.hydrate('stu', { fresh: true })
    a.receive({ kind: 'order', status: 'ready', order_id: 'o1' })

    setActivePinia(createPinia())
    const b = useNotificationsStore()
    b.hydrate('stu', { fresh: true }) // brand-new sign-in, not a refresh
    expect(b.items).toHaveLength(0)
  })

  it('clear() wipes the stored history', () => {
    const a = useNotificationsStore()
    a.hydrate('stu', { fresh: true })
    a.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    a.clear()

    setActivePinia(createPinia())
    const b = useNotificationsStore()
    b.hydrate('stu')
    expect(b.items).toHaveLength(0)
  })

  it('persists markRead across a refresh', () => {
    const a = useNotificationsStore()
    a.hydrate('stu', { fresh: true })
    const n = a.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    a.markRead(n.id)

    setActivePinia(createPinia())
    const b = useNotificationsStore()
    b.hydrate('stu')
    expect(b.items[0].read).toBe(true)
  })
})
