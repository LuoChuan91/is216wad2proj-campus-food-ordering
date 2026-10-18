import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { RouterLinkStub } from '@vue/test-utils'

import NotificationBell from '../NotificationBell.vue'
import NotificationPanel from '../NotificationPanel.vue'
import { useNotificationsStore } from '@/stores/notifications.js'

// Mount with a RouterLink stub so we can read the mobile link target without a
// full router. Behaviour is now Bootstrap-driven (data-bs-*), so we assert the
// wiring/markup rather than simulated open/close (Bootstrap JS does not run in
// jsdom).
function mountBell() {
  return mount(NotificationBell, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('NotificationBell (Bootstrap-controlled)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders two breakpoint triggers (desktop d-none d-md-*, mobile d-md-none)', () => {
    const wrapper = mountBell()
    const desktop = wrapper.find('[data-test="bell-desktop"]')
    const mobile = wrapper.find('[data-test="bell-mobile"]')
    expect(desktop.exists()).toBe(true)
    expect(mobile.exists()).toBe(true)
    expect(desktop.classes()).toContain('d-none')
    expect(desktop.classes()).toContain('d-md-inline-flex')
    expect(mobile.classes()).toContain('d-md-none')
  })

  it('desktop trigger is wired to the offcanvas via data-bs-* attributes', () => {
    const wrapper = mountBell()
    const desktop = wrapper.find('[data-test="bell-desktop"]')
    expect(desktop.attributes('data-bs-toggle')).toBe('offcanvas')
    expect(desktop.attributes('data-bs-target')).toBe('#notificationOffcanvas')
    // The offcanvas target exists with the matching id.
    expect(wrapper.find('#notificationOffcanvas').exists()).toBe(true)
    expect(wrapper.find('[data-test="offcanvas"]').exists()).toBe(true)
  })

  it('mobile trigger links to the full-screen /notifications page', () => {
    const wrapper = mountBell()
    const mobile = wrapper.findComponent(RouterLinkStub)
    expect(mobile.props('to')).toBe('/notifications')
  })

  it('shows an unread badge counting unread items (capped at 99+)', async () => {
    const store = useNotificationsStore()
    store.receive({ kind: 'order', status: 'ready' })
    store.receive({ kind: 'order', status: 'completed' })
    const wrapper = mountBell()
    expect(wrapper.find('[data-test="unread-badge"]').text()).toContain('2')
  })

  it('no badge when nothing is unread', async () => {
    const store = useNotificationsStore()
    const n = store.receive({ kind: 'order', status: 'ready' })
    store.markRead(n.id)
    const wrapper = mountBell()
    expect(wrapper.find('[data-test="unread-badge"]').exists()).toBe(false)
  })

  it('renders the shared NotificationPanel inside the offcanvas body', () => {
    const wrapper = mountBell()
    expect(wrapper.findComponent(NotificationPanel).exists()).toBe(true)
  })

  it('offcanvas has a Bootstrap dismiss button', () => {
    const wrapper = mountBell()
    const closeBtn = wrapper.find('.offcanvas .btn-close')
    expect(closeBtn.exists()).toBe(true)
    expect(closeBtn.attributes('data-bs-dismiss')).toBe('offcanvas')
  })
})
