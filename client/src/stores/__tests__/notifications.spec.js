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
    const n = store.receive({ kind: 'order', status: 'preparing' })
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
