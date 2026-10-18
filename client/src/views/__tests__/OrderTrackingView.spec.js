import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

// Mock the composable so the view does no real fetching/subscribing.
const state = {
  seconds: ref(600),
  loading: ref(false),
  error: ref(null),
  stale: ref(false),
  liveConnected: ref(true),
}
vi.mock('@/composables/useWaitTime.js', () => ({
  useWaitTime: () => state,
}))

// Controllable route.
const route = { params: { orderId: '3f2a1b9c-dead-0000' }, query: { store_id: 's1', mode: 'pickup', status: 'preparing' } }
vi.mock('vue-router', () => ({ useRoute: () => route }))

import OrderTrackingView from '../OrderTrackingView.vue'

describe('OrderTrackingView', () => {
  beforeEach(() => {
    state.seconds.value = 600
    state.loading.value = false
    state.error.value = null
    route.query = { store_id: 's1', mode: 'pickup', status: 'preparing' }
  })

  it('shows a derived order reference', () => {
    const wrapper = mount(OrderTrackingView)
    expect(wrapper.find('[data-test="reference"]').text()).toBe('ORD-3F2A1B')
  })

  it('shows a ready ETA with the wait label, no delivered line for pickup', () => {
    const wrapper = mount(OrderTrackingView)
    const ready = wrapper.find('[data-test="ready-at"]')
    expect(ready.exists()).toBe(true)
    expect(ready.text()).toContain('10 min') // 600s wait label
    expect(wrapper.find('[data-test="delivered-at"]').exists()).toBe(false)
  })

  it('delivery mode uses DLV prefix and shows a delivered line', async () => {
    route.query = { store_id: 's1', mode: 'delivery', status: 'ready' }
    const wrapper = mount(OrderTrackingView)
    expect(wrapper.find('[data-test="reference"]').text()).toBe('DLV-3F2A1B')
    expect(wrapper.find('[data-test="delivered-at"]').exists()).toBe(true)
  })

  it('renders the status timeline', () => {
    const wrapper = mount(OrderTrackingView)
    expect(wrapper.find('[data-test="timeline"]').exists()).toBe(true)
  })

  it('shows loading and error states', async () => {
    state.loading.value = true
    let wrapper = mount(OrderTrackingView)
    expect(wrapper.text()).toContain('Estimating')

    state.loading.value = false
    state.error.value = 'Wait time unavailable'
    wrapper = mount(OrderTrackingView)
    expect(wrapper.text()).toContain('Wait time unavailable')
  })
})
