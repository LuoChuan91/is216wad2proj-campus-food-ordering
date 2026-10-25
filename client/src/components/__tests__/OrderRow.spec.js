// Unit test for components/OrderRow.vue — the status-label logic extracted from
// OrdersView (completed -> Delivered/Collected, ready+picked_up -> On the way,
// otherwise the status map) plus the active vs past subtitle.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderRow from '../OrderRow.vue'

const store = { id: 's1', name: 'Bento Bar', color: '#123456', mono: 'BB' }
const base = { id: 'o1', code: 'E287', total: 19.21, created_at: 0 }

function mountRow(order, props = {}) {
  return mount(OrderRow, {
    props: { order: { ...base, ...order }, store, count: 2, ...props },
  })
}

describe('OrderRow label logic', () => {
  it('maps paid -> "In queue"', () => {
    expect(mountRow({ status: 'paid' }).text()).toContain('In queue')
  })

  it('maps preparing -> "Cooking", ready -> "Ready"', () => {
    expect(mountRow({ status: 'preparing' }).text()).toContain('Cooking')
    expect(mountRow({ status: 'ready' }).text()).toContain('Ready')
  })

  it('completed delivery (not fallback) -> "Delivered"', () => {
    const w = mountRow({ status: 'completed', delivery: { status: 'delivered' }, fallback: false })
    expect(w.text()).toContain('Delivered')
  })

  it('completed delivery that fell back to pickup -> "Collected"', () => {
    const w = mountRow({ status: 'completed', delivery: { status: 'delivered' }, fallback: true })
    expect(w.text()).toContain('Collected')
  })

  it('completed pickup (no delivery) -> "Collected"', () => {
    expect(mountRow({ status: 'completed' }).text()).toContain('Collected')
  })

  it('ready + courier picked_up -> "On the way"', () => {
    const w = mountRow({ status: 'ready', delivery: { status: 'picked_up' } })
    expect(w.text()).toContain('On the way')
  })

  it('unknown status falls through to the raw value', () => {
    expect(mountRow({ status: 'weird' }).text()).toContain('weird')
  })
})

describe('OrderRow variant subtitle', () => {
  it('active variant shows code + item count', () => {
    const w = mountRow({ status: 'paid' }, { variant: 'active', count: 2 })
    expect(w.text()).toContain('#E287')
    expect(w.text()).toContain('2 items')
  })

  it('emits open with the order id when clicked', async () => {
    const w = mountRow({ status: 'paid' })
    await w.find('button.order-row').trigger('click')
    expect(w.emitted('open')).toBeTruthy()
    expect(w.emitted('open')[0]).toEqual(['o1'])
  })
})
