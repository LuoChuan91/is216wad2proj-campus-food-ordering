import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MenuItemAdminCard from '../MenuItemAdminCard.vue'

const ITEM = { id: 'm1', category: 'Bento', name: 'Teriyaki', description: 'Grilled chicken.', price: 6, available: true, image_url: 'https://picsum.photos/seed/t/400', cook_time_sec: 300, max_at_once: 2, option_groups: [{ id: 'g1' }] }
const mountCard = (props = {}) => mount(MenuItemAdminCard, { props: { item: ITEM, ...props } })
const button = (w, text) => w.findAll('button').find((b) => b.text() === text)

describe('MenuItemAdminCard', () => {
  it('shows the dish details, category and cooking details', () => {
    const w = mountCard()
    expect(w.text()).toContain('Teriyaki')
    expect(w.text()).toContain('$6.00')
    expect(w.text()).toContain('Bento')
    expect(w.text()).toContain('Grilled chicken.')
    expect(w.text()).toContain('1 option group · 5 min, batch of 2')
    expect(w.find('img').attributes('src')).toBe(ITEM.image_url)
  })

  it('shows a placeholder when there is no photo', () => {
    const w = mountCard({ item: { ...ITEM, image_url: null } })
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('.bi-image').exists()).toBe(true)
  })

  it('emits toggle-available with the new value, and the switch is disabled while busy', async () => {
    const w = mountCard()
    await w.find('input[role="switch"]').setValue(false)
    expect(w.emitted('toggle-available')).toEqual([[false]])
    expect(mountCard({ busy: true }).find('input[role="switch"]').attributes('disabled')).toBeDefined()
  })

  it('a sold-out item says so and is greyed out', () => {
    const w = mountCard({ item: { ...ITEM, available: false } })
    expect(w.text()).toContain('Sold out')
    expect(w.classes()).toContain('sold-out')
  })

  it('emits edit with the item', async () => {
    const w = mountCard()
    await w.find('button[aria-label="Edit Teriyaki"]').trigger('click')
    expect(w.emitted('edit')).toEqual([[ITEM]])
  })

  it('asks before removing, and Cancel backs out', async () => {
    const w = mountCard()
    await w.find('button[aria-label="Remove Teriyaki"]').trigger('click')
    expect(w.text()).toContain('Remove this item?')
    expect(w.emitted('remove')).toBeUndefined()
    await button(w, 'Cancel').trigger('click')
    expect(w.text()).not.toContain('Remove this item?')
    expect(w.emitted('remove')).toBeUndefined()
  })

  it('emits remove after confirming, and closes the prompt if removal fails', async () => {
    const w = mountCard()
    await w.find('button[aria-label="Remove Teriyaki"]').trigger('click')
    await button(w, 'Remove').trigger('click')
    expect(w.emitted('remove')).toEqual([[ITEM]])
    await w.setProps({ removing: true })
    expect(button(w, 'Remove').attributes('disabled')).toBeDefined()
    await w.setProps({ removing: false })
    expect(w.text()).not.toContain('Remove this item?')
  })
})
