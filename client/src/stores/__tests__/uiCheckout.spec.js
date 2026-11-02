// Store unit tests for the student checkout/payment flow in stores/ui.js.
// Covers: nearest-dropoff auto-selection, fulfilment/note setters, the order body
// built by confirmPay (pickup vs delivery), the pay state machine
// (idle->processing->done / ->error), and openTracking clearing the cart only
// after a completed payment. The api is mocked and the 900ms pay delay is driven
// with fake timers.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api.js', () => ({
  api: {
    profiles: vi.fn().mockResolvedValue([]),
    profile: vi.fn().mockResolvedValue({}),
    venues: vi.fn().mockResolvedValue([]),
    destinations: vi.fn().mockResolvedValue([]),
    stores: vi.fn().mockResolvedValue([]),
    menu: vi.fn().mockResolvedValue([]),
    studentOrders: vi.fn().mockResolvedValue([]),
    myJobs: vi.fn().mockResolvedValue([]),
    openJobs: vi.fn().mockResolvedValue([]),
    expiredJobs: vi.fn().mockResolvedValue([]),
    placeOrder: vi.fn(),
  },
  setActor: vi.fn(),
}))

import { api } from '@/services/api.js'
import { useUiStore } from '../ui.js'
import { useSessionStore } from '../session.js'
import { seedCatalog } from './fixtures.js'

// Build a one-line cart for the seeded item (white rice) so checkout is possible.
function addItem(ui) {
  ui.openItem('m1')
  ui.toggleOption('o1') // satisfy the required Rice group
  ui.addToCart()
}

describe('ui store: checkout + payment flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    seedCatalog()
    useSessionStore().signIn('stu')
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('openCheckout auto-selects the nearest drop-off point', () => {
    const ui = useUiStore()
    addItem(ui)
    ui.openCheckout()
    expect(ui.ui.student.page).toBe('checkout')
    // d1 (Front desk) is nearer to the venue than d2 (Far corner).
    expect(ui.ui.student.checkout.dropoffId).toBe('d1')
  })

  it('setFulfilment / setDropoff / setNote update the checkout, note length capped', () => {
    const ui = useUiStore()
    ui.setFulfilment('delivery')
    ui.setDropoff('d2')
    ui.setNote('x'.repeat(200))
    expect(ui.ui.student.checkout.type).toBe('delivery')
    expect(ui.ui.student.checkout.dropoffId).toBe('d2')
    expect(ui.ui.student.checkout.note).toHaveLength(80)
  })

  it('confirmPay builds a pickup order body and transitions idle->processing->done', async () => {
    const ui = useUiStore()
    addItem(ui)
    ui.openCheckout()
    ui.setFulfilment('pickup')
    api.placeOrder.mockResolvedValue({ id: 'o-new' })

    const p = ui.confirmPay()
    expect(ui.ui.student.pay.state).toBe('processing')
    await vi.advanceTimersByTimeAsync(900)
    await p

    expect(api.placeOrder).toHaveBeenCalledWith(expect.objectContaining({
      student_id: 'stu',
      type: 'pickup',
      items: [{ menu_item_id: 'm1', qty: 1, option_ids: ['o1'] }],
    }))
    // pickup body carries no destination/note
    expect(api.placeOrder.mock.calls[0][0]).not.toHaveProperty('destination_id')
    expect(ui.ui.student.pay).toMatchObject({ state: 'done', orderId: 'o-new' })
  })

  it('confirmPay includes destination and note for a delivery order', async () => {
    const ui = useUiStore()
    addItem(ui)
    ui.openCheckout()
    ui.setFulfilment('delivery')
    ui.setDropoff('d2')
    ui.setNote('Leave at the bench')
    api.placeOrder.mockResolvedValue({ id: 'o-del' })

    const p = ui.confirmPay()
    await vi.advanceTimersByTimeAsync(900)
    await p

    expect(api.placeOrder).toHaveBeenCalledWith(expect.objectContaining({
      type: 'delivery',
      destination_id: 'd2',
      note: 'Leave at the bench',
    }))
  })

  it('a failed placeOrder leaves pay in the error state with the message', async () => {
    const ui = useUiStore()
    addItem(ui)
    ui.openCheckout()
    api.placeOrder.mockRejectedValue(new Error('Out of stock'))

    const p = ui.confirmPay()
    await vi.advanceTimersByTimeAsync(900)
    await p

    expect(ui.ui.student.pay.state).toBe('error')
    expect(ui.ui.student.pay.error).toBe('Out of stock')
  })

  it('openTracking clears the cart only after a completed payment', async () => {
    const ui = useUiStore()
    addItem(ui)
    ui.openCheckout()
    api.placeOrder.mockResolvedValue({ id: 'o-new' })
    const p = ui.confirmPay()
    await vi.advanceTimersByTimeAsync(900)
    await p

    expect(ui.ui.student.cart.lines).toHaveLength(1) // still there until tracking opens
    ui.openTracking('o-new')
    expect(ui.ui.student.page).toBe('track')
    expect(ui.ui.student.trackOrderId).toBe('o-new')
    expect(ui.ui.student.cart.lines).toHaveLength(0) // cleared now
    expect(ui.ui.student.pay.state).toBe('idle')
  })
})
