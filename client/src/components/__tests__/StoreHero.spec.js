import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StoreHero from '../StoreHero.vue'

const base = { id: 's1', name: 'Braek Acai & Coffee', color: '#2e8f57', mono: 'BA', unit_no: '#B1-25' }
const mountHero = (store) => mount(StoreHero, { props: { store, venueName: 'LKS Library' }, global: { stubs: { Icon: true, Mono: true } } })

describe('StoreHero', () => {
  it("uses the store's photo as the banner when it has one", () => {
    const w = mountHero({ ...base, image_url: 'https://picsum.photos/seed/braek/600/400' })
    expect(w.classes()).toContain('has-photo')
    expect(w.attributes('style')).toContain('--photo: url("https://picsum.photos/seed/braek/600/400")')
  })

  it('falls back to the colour banner without a photo', () => {
    for (const image_url of [null, '', 'not a url']) {
      const w = mountHero({ ...base, image_url })
      expect(w.classes()).not.toContain('has-photo')
      expect(w.attributes('style')).not.toContain('--photo')
    }
  })
})
