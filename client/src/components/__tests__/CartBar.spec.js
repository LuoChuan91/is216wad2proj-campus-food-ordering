// Component test for components/CartBar.vue — the floating "View cart" bar.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CartBar from '../CartBar.vue'

describe('CartBar', () => {
  it('shows the item count and formatted total', () => {
    const w = mount(CartBar, { props: { count: 3, total: 18.5 } })
    expect(w.find('.cart-count').text()).toBe('3')
    expect(w.text()).toContain('View cart')
    expect(w.text()).toContain('$18.50')
  })

  it('emits open when tapped', async () => {
    const w = mount(CartBar, { props: { count: 1, total: 6 } })
    await w.trigger('click')
    expect(w.emitted('open')).toHaveLength(1)
  })
})
