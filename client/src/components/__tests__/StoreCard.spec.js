// Component test for components/StoreCard.vue — the store list card. Covers the
// open/closed/unavailable badges, the discount badge, the slot, and that tapping
// an available card opens the store via the ui store (while an unavailable card
// is disabled). WaitTimeEstimate + Mono are stubbed so no realtime/supabase runs.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api.js', () => ({ api: {}, setActor: vi.fn() }))
vi.mock('@/common/supabase.js', () => ({ default: {} }))

import StoreCard from '../StoreCard.vue'
import WaitTimeEstimate from '../WaitTimeEstimate.vue'
import { useUiStore } from '@/stores/ui.js'

const store = { id: 's1', name: 'Bento Bar', mono: 'BB', color: '#123' }

function mountCard(props = {}, slot = '') {
  return mount(StoreCard, {
    props: { store, ...props },
    slots: slot ? { default: slot } : {},
    global: { stubs: { Mono: true, WaitTimeEstimate: true } },
  })
}

describe('StoreCard', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders the store name and a slot', () => {
    const w = mountCard({ open: true, available: true }, '<span class="cuisine">Japanese</span>')
    expect(w.text()).toContain('Bento Bar')
    expect(w.find('.cuisine').text()).toBe('Japanese')
  })

  it('shows Open / Closed badges based on the open prop', () => {
    expect(mountCard({ open: true, available: true }).text()).toContain('Open')
    expect(mountCard({ open: false, available: true }).text()).toContain('Closed')
  })

  it('an unavailable store shows "Unavailable" and is disabled', () => {
    const w = mountCard({ open: true, available: false })
    expect(w.text()).toContain('Unavailable')
    expect(w.attributes('disabled')).toBeDefined()
  })

  it('shows a discount badge when the store has one', () => {
    const w = mountCard({ open: true, available: true, store: { ...store, discount_type: 'percentage', discount_per: 10 } })
    expect(w.text()).toContain('10% off')
  })

  it('opens the store through the ui store when an available card is clicked', async () => {
    const ui = useUiStore()
    const spy = vi.spyOn(ui, 'openStore')
    const w = mountCard({ open: true, available: true })
    await w.trigger('click')
    expect(spy).toHaveBeenCalledWith('s1')
  })

  it('only renders the wait estimate when open and available', () => {
    const openCard = mountCard({ open: true, available: true })
    expect(openCard.findComponent(WaitTimeEstimate).exists()).toBe(true)
    const closedCard = mountCard({ open: false, available: true })
    expect(closedCard.findComponent(WaitTimeEstimate).exists()).toBe(false)
  })
})
