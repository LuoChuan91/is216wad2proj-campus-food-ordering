import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NotificationToaster from '../NotificationToaster.vue'
import { useNotificationsStore } from '@/stores/notifications.js'

describe('NotificationToaster', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a toast for a toast-status notification, bottom-right container', async () => {
    const store = useNotificationsStore()
    const wrapper = mount(NotificationToaster)
    store.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    await flushPromises()

    expect(wrapper.find('.toast-container.bottom-0.end-0').exists()).toBe(true)
    expect(wrapper.text()).toContain('Your food is ready')
    expect(wrapper.findAll('.toast-card')).toHaveLength(1)
  })

  it('stacks multiple toasts', async () => {
    const store = useNotificationsStore()
    const wrapper = mount(NotificationToaster)
    store.receive({ kind: 'order', status: 'ready' })
    store.receive({ kind: 'delivery', status: 'accepted' })
    await flushPromises()
    expect(wrapper.findAll('.toast-card')).toHaveLength(2)
  })

  it('auto-dismisses after the duration', async () => {
    const store = useNotificationsStore()
    const wrapper = mount(NotificationToaster, { props: { duration: 3000 } })
    store.receive({ kind: 'order', status: 'ready' })
    await flushPromises()
    expect(wrapper.findAll('.toast-card')).toHaveLength(1)

    vi.advanceTimersByTime(3000)
    await flushPromises()
    expect(wrapper.findAll('.toast-card')).toHaveLength(0)
    // still kept in history
    expect(store.items).toHaveLength(1)
  })

  it('dismisses on close-button click', async () => {
    const store = useNotificationsStore()
    const wrapper = mount(NotificationToaster)
    store.receive({ kind: 'order', status: 'completed' })
    await flushPromises()
    await wrapper.find('.toast-x').trigger('click')
    expect(wrapper.findAll('.toast-card')).toHaveLength(0)
  })
})
