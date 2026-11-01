import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MenuItemCard from '../MenuItemCard.vue'

const ITEM = { id: 'm1', name: 'Hash Stack', description: 'Bagel stacked with hash brown.', price: 9.5, available: true, image_url: 'https://picsum.photos/seed/hash/400', option_groups: [] }
const mountCard = (item = ITEM, props = {}) => mount(MenuItemCard, { props: { item, ...props } })

describe('MenuItemCard', () => {
  it('shows the name, description, price and photo', () => {
    const w = mountCard()
    expect(w.text()).toContain('Hash Stack')
    expect(w.text()).toContain('Bagel stacked with hash brown.')
    expect(w.text()).toContain('$9.50')
    expect(w.find('img').attributes('src')).toBe(ITEM.image_url)
  })

  it('shows a placeholder when there is no photo', () => {
    const w = mountCard({ ...ITEM, image_url: null })
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('.bi-image').exists()).toBe(true)
  })

  it('emits open with the item id when tapped', async () => {
    const w = mountCard()
    await w.trigger('click')
    expect(w.emitted('open')).toEqual([['m1']])
  })

  it('marks items with option groups as customisable', () => {
    expect(mountCard({ ...ITEM, option_groups: [{ id: 'g1' }] }).text()).toContain('Customisable')
    expect(mountCard().text()).not.toContain('Customisable')
  })

  it('a sold-out item is disabled, greyed and has no add button', () => {
    const w = mountCard({ ...ITEM, available: false })
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.classes()).toContain('sold-out')
    expect(w.text()).toContain('Sold out')
    expect(w.find('.mi-add').exists()).toBe(false)
  })

  it('cannot be added while the store is closed', () => {
    const w = mountCard(ITEM, { canAdd: false })
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.find('.mi-add').exists()).toBe(false)
  })
})
