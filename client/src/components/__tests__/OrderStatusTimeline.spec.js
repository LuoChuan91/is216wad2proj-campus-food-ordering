import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderStatusTimeline from '../OrderStatusTimeline.vue'

describe('OrderStatusTimeline', () => {
  it('pickup mode shows two steps (no picked-up)', () => {
    const wrapper = mount(OrderStatusTimeline, { props: { mode: 'pickup', status: 'preparing' } })
    expect(wrapper.find('[data-test="step-preparing"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="step-ready"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="step-picked_up"]').exists()).toBe(false)
  })

  it('delivery mode shows the picked-up step', () => {
    const wrapper = mount(OrderStatusTimeline, { props: { mode: 'delivery', status: 'ready' } })
    expect(wrapper.find('[data-test="step-picked_up"]').exists()).toBe(true)
  })

  it('marks the current step and completes earlier ones', () => {
    const wrapper = mount(OrderStatusTimeline, { props: { mode: 'delivery', status: 'ready' } })
    expect(wrapper.find('[data-test="step-preparing"]').attributes('data-state')).toBe('done')
    expect(wrapper.find('[data-test="step-ready"]').attributes('data-state')).toBe('current')
    expect(wrapper.find('[data-test="step-picked_up"]').attributes('data-state')).toBe('upcoming')
  })

  it('completed/delivered marks every step done', () => {
    const wrapper = mount(OrderStatusTimeline, { props: { mode: 'delivery', status: 'delivered' } })
    for (const key of ['preparing', 'ready', 'picked_up']) {
      expect(wrapper.find(`[data-test="step-${key}"]`).attributes('data-state')).toBe('done')
    }
  })

  it('pickup "ready" is the final (current) step', () => {
    const wrapper = mount(OrderStatusTimeline, { props: { mode: 'pickup', status: 'ready' } })
    expect(wrapper.find('[data-test="step-ready"]').attributes('data-state')).toBe('current')
  })
})
