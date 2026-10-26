// Unit test for components/SegToggle.vue — the pickup/delivery radio choice.
// Proves it reflects the current value (the checked radio) and emits 'change' with
// the chosen type when an option is picked.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SegToggle from '../SegToggle.vue'

function mountSeg(modelValue = 'pickup') {
  return mount(SegToggle, { props: { modelValue, deliveryFee: '$1.50' } })
}

describe('SegToggle', () => {
  it('checks the radio for the current value', () => {
    const w = mountSeg('pickup')
    const [pickup, delivery] = w.findAll('input[type="radio"]')
    expect(pickup.element.checked).toBe(true)
    expect(delivery.element.checked).toBe(false)
  })

  it('shows the formatted delivery fee', () => {
    expect(mountSeg().text()).toContain('$1.50')
  })

  it('emits change("delivery") when the delivery option is picked', async () => {
    const w = mountSeg('pickup')
    const delivery = w.findAll('input[type="radio"]')[1]
    await delivery.setValue(true)
    expect(w.emitted('change')).toBeTruthy()
    expect(w.emitted('change')[0]).toEqual(['delivery'])
  })

  it('emits change("pickup") when the pickup option is picked', async () => {
    const w = mountSeg('delivery')
    const pickup = w.findAll('input[type="radio"]')[0]
    await pickup.setValue(true)
    expect(w.emitted('change')[0]).toEqual(['pickup'])
  })
})
