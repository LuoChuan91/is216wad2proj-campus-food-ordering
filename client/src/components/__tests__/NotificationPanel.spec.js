// Component test for components/NotificationPanel.vue — the shared notification
// history list (bell panel / full-screen page). Reads the notifications store, so
// a Pinia is active and items are seeded via the store's receive().
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

import NotificationPanel from '../NotificationPanel.vue'
import { useNotificationsStore } from '@/stores/notifications.js'

describe('NotificationPanel', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useNotificationsStore()
  })

  it('shows an empty state when there are no notifications', () => {
    const w = mount(NotificationPanel)
    expect(w.find('[data-test="empty"]').exists()).toBe(true)
  })

  it('lists notifications newest-first', () => {
    store.receive({ kind: 'order', status: 'paid', order_id: 'o1' })
    store.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    const w = mount(NotificationPanel)
    const rows = w.findAll('[data-test="notification"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Your food is ready') // newest first
  })

  it('marks a single notification read', async () => {
    store.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    const w = mount(NotificationPanel)
    expect(w.find('[data-test="notification"]').classes()).toContain('unread')
    await w.find('.notif-read').trigger('click')
    expect(store.items[0].read).toBe(true)
    expect(w.find('[data-test="notification"]').classes()).not.toContain('unread')
  })

  it('marks all read from the header action', async () => {
    store.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    store.receive({ kind: 'delivery', status: 'accepted', order_id: 'o2' })
    const w = mount(NotificationPanel)
    await w.find('.notif-read-all').trigger('click')
    expect(store.items.every((n) => n.read)).toBe(true)
    // The "mark all" header disappears once nothing is unread.
    expect(w.find('.notif-read-all').exists()).toBe(false)
  })
})
