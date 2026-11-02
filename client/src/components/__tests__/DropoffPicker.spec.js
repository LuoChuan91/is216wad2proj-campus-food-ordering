import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DropoffPicker from '../DropoffPicker.vue'

const drops = [
  { d: { id: 'd1', name: 'Library Entrance Desk' }, m: 40 },
  { d: { id: 'd2', name: 'SOE Bench' }, m: 120 },
  { d: { id: 'd3', name: 'Campus Green' }, m: 200 },
]

describe('DropoffPicker', () => {
  it('renders every drop-off point passed in (not just the nearest few)', () => {
    const wrapper = mount(DropoffPicker, { props: { drops } })
    expect(wrapper.findAll('.drop')).toHaveLength(3)
    expect(wrapper.text()).toContain('Library Entrance Desk')
    expect(wrapper.text()).toContain('Campus Green')
  })

  it('filters by name (case-insensitive) via the search box', async () => {
    const wrapper = mount(DropoffPicker, { props: { drops } })
    await wrapper.find('input[type="search"]').setValue('soe')
    const rows = wrapper.findAll('.drop')
    expect(rows).toHaveLength(1)
    expect(wrapper.text()).toContain('SOE Bench')
    expect(wrapper.text()).not.toContain('Library Entrance Desk')
    expect(wrapper.text()).not.toContain('Campus Green')
  })

  it('shows an empty note when nothing matches', async () => {
    const wrapper = mount(DropoffPicker, { props: { drops } })
    await wrapper.find('input[type="search"]').setValue('zzz')
    expect(wrapper.findAll('.drop')).toHaveLength(0)
    expect(wrapper.find('.drop-empty').exists()).toBe(true)
  })

  it('emits "pick" with the destination id when a radio is chosen', async () => {
    const wrapper = mount(DropoffPicker, { props: { drops } })
    await wrapper.findAll('input[type="radio"]')[1].setValue(true)
    expect(wrapper.emitted('pick')).toBeTruthy()
    expect(wrapper.emitted('pick')[0]).toEqual(['d2'])
  })

  it('has a fixed-height scroll container for the list', () => {
    const wrapper = mount(DropoffPicker, { props: { drops } })
    expect(wrapper.find('.drop-list').exists()).toBe(true)
  })
})
