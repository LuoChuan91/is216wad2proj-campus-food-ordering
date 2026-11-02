// Component test for components/OrderRow.vue.
//
// The exhaustive status-label matrix is covered by the pure unit test in
// utils/__tests__/orderStatus.spec.js (OrderRow renders orderStatusLabel). Here
// we only assert the COMPONENT behaviour: that it renders the resolved label and
// the active/past subtitles, emits `open` on a row click, and shows the
// customer-only "Collected" action in the right state.
//
// OrderRow imports the orders store at setup (for the Collected action), so a
// Pinia must be active and the api service is mocked to keep it offline.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api.js', () => ({
  api: { setOrderStatus: vi.fn().mockResolvedValue({ id: 'o1', status: 'completed' }) },
  setActor: vi.fn(),
}))

import OrderRow from '../OrderRow.vue'
import { api } from '@/services/api.js'

const store = { id: 's1', name: 'Bento Bar', color: '#123456', mono: 'BB' }
const base = { id: 'o1', code: 'E287', total: 19.21, created_at: 0 }

function mountRow(order, props = {}) {
  return mount(OrderRow, {
    props: { order: { ...base, ...order }, store, count: 2, ...props },
    global: { stubs: { Mono: true } },
  })
}

describe('OrderRow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders the store name and the resolved status label', () => {
    const w = mountRow({ status: 'paid' })
    expect(w.text()).toContain('Bento Bar')
    expect(w.text()).toContain('In queue') // orderStatusLabel(paid)
  })

  it('active variant shows the order code, item count and total', () => {
    const w = mountRow({ status: 'paid' }, { variant: 'active', count: 2 })
    expect(w.text()).toContain('#E287')
    expect(w.text()).toContain('2 items')
    expect(w.text()).toContain('$19.21')
  })

  it('emits open with the order id when the row is clicked', async () => {
    const w = mountRow({ status: 'paid' })
    await w.find('button.order-row').trigger('click')
    expect(w.emitted('open')).toEqual([['o1']])
  })

  describe('customer "Collected" action (pickup only)', () => {
    it('is shown for an uncompleted pickup order', () => {
      const w = mountRow({ status: 'ready', type: 'pickup' }, { busy: {} })
      expect(w.text()).toContain('Collected')
    })

    it('is hidden for a delivery order', () => {
      const w = mountRow({ status: 'ready', type: 'delivery' }, { busy: {} })
      const collected = w.findAll('button').filter((b) => b.text() === 'Collected')
      expect(collected).toHaveLength(0)
    })

    it('is disabled until the order is ready', () => {
      const w = mountRow({ status: 'preparing', type: 'pickup' }, { busy: {} })
      const btn = w.findAll('button').find((b) => b.text() === 'Collected')
      expect(btn.attributes('disabled')).toBeDefined()
    })

    it('marks the order collected when clicked while ready', async () => {
      const w = mountRow({ status: 'ready', type: 'pickup' }, { busy: {} })
      const btn = w.findAll('button').find((b) => b.text() === 'Collected')
      await btn.trigger('click')
      expect(api.setOrderStatus).toHaveBeenCalledWith('o1', 'completed')
    })
  })
})
