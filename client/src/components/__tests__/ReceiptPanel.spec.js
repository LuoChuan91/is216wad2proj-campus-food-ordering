// Unit test for components/ReceiptPanel.vue — the tracking/checkout receipt.
// Proves each line renders qty/name/options/line-total, the discount row shows only
// when there's a discount, the paid amount renders, and the reference line (with the
// optional "fee waived" note) renders from the payment prop.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReceiptPanel from '../ReceiptPanel.vue'

const lines = [
  { id: 'l1', qty: 2, name: 'Chicken Teriyaki Bento', option_names: ['White Rice', 'Add Tamago'], unit_price: 11.3 },
  { id: 'l2', qty: 1, name: 'Green Tea', option_names: [], unit_price: 2 },
]

describe('ReceiptPanel', () => {
  it('renders each line with qty, name, options and line total', () => {
    const w = mount(ReceiptPanel, { props: { lines, discount: 0, paid: 24.6 } })
    const rows = w.findAll('.co-line')
    expect(rows).toHaveLength(2)
    expect(w.text()).toContain('2×')
    expect(w.text()).toContain('Chicken Teriyaki Bento')
    expect(w.text()).toContain('White Rice, Add Tamago')
    expect(w.text()).toContain('$22.60') // 11.30 * 2
  })

  it('omits the options line when a line has no options', () => {
    const w = mount(ReceiptPanel, { props: { lines, paid: 24.6 } })
    // Only the first line has a <small> options row.
    expect(w.findAll('.co-what small')).toHaveLength(1)
  })

  it('shows the discount row only when discount is non-zero', () => {
    const none = mount(ReceiptPanel, { props: { lines, discount: 0, paid: 24.6 } })
    expect(none.find('.rc-row.disc').exists()).toBe(false)
    const some = mount(ReceiptPanel, { props: { lines, discount: 3.39, paid: 21.21 } })
    expect(some.find('.rc-row.disc').exists()).toBe(true)
    expect(some.find('.rc-row.disc').text()).toContain('−$3.39')
  })

  it('renders the paid amount', () => {
    const w = mount(ReceiptPanel, { props: { lines, paid: 19.21 } })
    expect(w.text()).toContain('Paid')
    expect(w.text()).toContain('$19.21')
  })

  it('renders the payment reference and method, with no fee-waived note by default', () => {
    const w = mount(ReceiptPanel, {
      props: { lines, paid: 19.21, payment: { reference: 'SIM-123', method: 'simulated' } },
    })
    expect(w.find('.rc-ref').text()).toContain('SIM-123')
    expect(w.find('.rc-ref').text()).toContain('simulated')
    expect(w.find('.rc-ref').text()).not.toContain('fee waived')
  })

  it('shows the fee-waived note when fallback is true', () => {
    const w = mount(ReceiptPanel, {
      props: { lines, paid: 19.21, payment: { reference: 'SIM-123', method: 'simulated' }, fallback: true, feeWaived: 1.5 },
    })
    expect(w.find('.rc-ref').text()).toContain('$1.50 fee waived')
  })

  it('omits the reference line when there is no payment', () => {
    const w = mount(ReceiptPanel, { props: { lines, paid: 19.21, payment: null } })
    expect(w.find('.rc-ref').exists()).toBe(false)
  })
})
