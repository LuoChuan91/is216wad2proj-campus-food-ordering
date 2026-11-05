// Component test for components/StoreCard.vue — the store list card. Covers the
// open/closed/unavailable badges, the discount badge, the slot, and that tapping
// an available card opens the store via the ui store (while an unavailable card
// is disabled). WaitTimeEstimate + Mono are stubbed so no realtime/supabase runs.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api.js', () => ({ api: {}, setActor: vi.fn() }))
vi.mock('@/common/supabase.js', () => ({ default: {} }))
const waitEntry = { ahead: 0, loading: false }
const waitFor = vi.fn()
vi.mock('@/composables/storeWaitCache.js', () => ({
  useStoreWait: (storeId) => {
    waitFor(typeof storeId === 'function' ? storeId() : storeId)
    return { entry: waitEntry }
  },
}))

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
  beforeEach(() => {
    setActivePinia(createPinia())
    waitEntry.ahead = 0
    waitEntry.loading = false
    waitFor.mockClear()
  })

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

  it('shows how many orders are ahead when the store is taking orders', () => {
    waitEntry.ahead = 3
    expect(mountCard({ open: true, available: true }).text()).toContain('3 orders before you')
    waitEntry.ahead = 1
    expect(mountCard({ open: true, available: true }).text()).toContain('1 order before you')
    waitEntry.ahead = 0
    expect(mountCard({ open: true, available: true }).text()).toContain('No orders before you')
  })

  it('hides the queue while loading, and for closed or unavailable stores', () => {
    waitEntry.ahead = 3
    waitEntry.loading = true
    expect(mountCard({ open: true, available: true }).text()).not.toContain('before you')
    waitEntry.loading = false
    expect(mountCard({ open: false, available: true }).text()).not.toContain('before you')
    expect(mountCard({ open: true, available: false }).text()).not.toContain('before you')
  })

  it('does not watch the queue of a closed store', () => {
    mountCard({ open: false, available: true })
    expect(waitFor).toHaveBeenLastCalledWith(null)
    mountCard({ open: true, available: true })
    expect(waitFor).toHaveBeenLastCalledWith('s1')
  })
})
