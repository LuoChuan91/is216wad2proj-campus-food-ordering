// Component test for components/icons/Mono.vue: shows the store's logo when it has
// one, and falls back to the coloured initials when it doesn't.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Mono from '../icons/Mono.vue'

describe('Mono', () => {
  it('shows the initials on the store colour when there is no logo', () => {
    const w = mount(Mono, { props: { store: { name: 'Bento Bar', mono: 'BB', color: '#123456' }, size: 40 } })
    expect(w.text()).toBe('BB')
    expect(w.find('img').exists()).toBe(false)
    expect(w.attributes('style')).toContain('background: rgb(18, 52, 86)')
  })

  it('shows the logo instead of the initials when logo_url is set', () => {
    const w = mount(Mono, { props: { store: { name: 'Supergreen', mono: 'S', color: '#123456', logo_url: '/images/stores/supergreen.webp' } } })
    const img = w.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/images/stores/supergreen.webp')
    expect(img.attributes('alt')).toBe('Supergreen logo')
    expect(w.text()).toBe('')
    expect(w.classes()).toContain('has-logo')
  })

  it('falls back to the initials if the logo file fails to load', async () => {
    const w = mount(Mono, { props: { store: { name: 'Supergreen', mono: 'S', color: '#123456', logo_url: '/images/stores/missing.webp' } } })
    await w.find('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toBe('S')
  })
})
