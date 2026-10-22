// Unit test for components/SegToggle.vue — the pickup/delivery segmented control.
// Proves it reflects the current value (aria-checked + .on) and emits 'change' with
// the chosen type when a segment is clicked.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SegToggle from '../SegToggle.vue'

function mountSeg(modelValue = 'pickup') {
  return mount(SegToggle, { props: { modelValue, deliveryFee: '$1.50' } })
}

describe('SegToggle', () => {
  it('marks the active segment with aria-checked and the .on class', () => {
    const w = mountSeg('pickup')
    const [pickup, delivery] = w.findAll('button[role="radio"]')
    expect(pickup.attributes('aria-checked')).toBe('true')
    expect(pickup.classes()).toContain('on')
    expect(delivery.attributes('aria-checked')).toBe('false')
    expect(delivery.classes()).not.toContain('on')
  })

  it('shows the formatted delivery fee', () => {
    expect(mountSeg().text()).toContain('$1.50')
  })

  it('emits change("delivery") when the delivery segment is clicked', async () => {
    const w = mountSeg('pickup')
    const delivery = w.findAll('button[role="radio"]')[1]
    await delivery.trigger('click')
    expect(w.emitted('change')).toBeTruthy()
    expect(w.emitted('change')[0]).toEqual(['delivery'])
  })

  it('emits change("pickup") when the pickup segment is clicked', async () => {
    const w = mountSeg('delivery')
    const pickup = w.findAll('button[role="radio"]')[0]
    await pickup.trigger('click')
    expect(w.emitted('change')[0]).toEqual(['pickup'])
  })
})
