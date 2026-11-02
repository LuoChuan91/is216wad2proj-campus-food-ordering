import { describe, it, expect } from 'vitest'
import { buildNotification, shouldToast } from '../notificationMessages.js'

// A pickup order and a delivery order to exercise the order-aware wording.
const pickup = { code: 'E287', type: 'pickup' }
const delivery = { code: 'D512', type: 'delivery', delivery: { courier_name: 'Mingli Tan', destination_id: 'd1' } }

describe('buildNotification (shared, order-aware wording)', () => {
  it('order paid -> the order-submitted line with the reference code', () => {
    const v = buildNotification(
      { kind: 'order', status: 'paid', order_id: 'o1' },
      { order: pickup, storeName: 'Hawker Corner' }
    )
    expect(v).toMatchObject({ title: 'Order submitted', variant: 'info', toast: false })
    expect(v.body).toContain('Your order reference is')
    expect(v.body).toContain('#E287')
  })

  it('order ready (pickup) -> "Collect order #code at store"', () => {
    const v = buildNotification(
      { kind: 'order', status: 'ready', order_id: 'o1' },
      { order: pickup, storeName: 'Hawker Corner' }
    )
    expect(v).toMatchObject({ title: 'Your food is ready', variant: 'success', toast: true })
    expect(v.body).toBe('Collect order #E287 at Hawker Corner')
  })

  it('order ready (delivery + courier) -> "<first> is picking it up now"', () => {
    const v = buildNotification(
      { kind: 'order', status: 'ready', order_id: 'o2' },
      { order: delivery, storeName: 'Hawker Corner', courierName: 'Mingli Tan' }
    )
    expect(v.body).toBe('Mingli is picking it up now')
  })

  it('order ready (delivery, no courier) -> waiting line', () => {
    const v = buildNotification(
      { kind: 'order', status: 'ready', order_id: 'o2' },
      { order: { code: 'D512', type: 'delivery', delivery: {} } }
    )
    expect(v.body).toBe('Waiting for a student courier to accept')
  })

  it('delivery accepted / picked_up / delivered use courier + drop-off', () => {
    const acc = buildNotification({ kind: 'delivery', status: 'accepted', order_id: 'o2' }, { order: delivery, courierName: 'Mingli Tan', dropoffName: 'SOE Bench' })
    expect(acc).toMatchObject({ title: 'Mingli accepted your delivery', variant: 'info', toast: true })
    expect(acc.body).toBe("They'll bring it to SOE Bench")

    const pick = buildNotification({ kind: 'delivery', status: 'picked_up', order_id: 'o2' }, { order: delivery, courierName: 'Mingli Tan', storeName: 'Hawker Corner' })
    expect(pick).toMatchObject({ title: 'Your food is on the way', variant: 'secondary', toast: true })
    expect(pick.body).toBe('Mingli picked it up from Hawker Corner')

    const del = buildNotification({ kind: 'delivery', status: 'delivered', order_id: 'o2' }, { order: delivery, dropoffName: 'SOE Bench' })
    expect(del).toMatchObject({ title: 'Delivered. Enjoy your meal!', variant: 'success', toast: false })
    expect(del.body).toBe('Dropped at SOE Bench')
  })

  it('delivery expired -> "Switched to pickup" with window + store + fee waived', () => {
    const v = buildNotification(
      { kind: 'delivery', status: 'expired', order_id: 'o2' },
      { order: delivery, storeName: 'Hawker Corner', deliveryWindowMin: 10 }
    )
    expect(v).toMatchObject({ title: 'Switched to pickup', variant: 'warning', toast: true })
    expect(v.body).toContain('10 min')
    expect(v.body).toContain('Hawker Corner')
    expect(v.body).toContain('fee waived')
  })

  it('falls back to generic wording when context is missing', () => {
    const v = buildNotification({ kind: 'order', status: 'ready', order_id: 'o1' })
    expect(v).toMatchObject({ title: 'Your food is ready', toast: true })
    expect(v.body).toContain('the store')
  })

  it('derives the code from order_id when the order is not loaded (no "#—")', () => {
    // Realtime fires on paid before loadLive pulls the order into the store.
    const v = buildNotification({ kind: 'order', status: 'paid', order_id: 'abcd1234-....' })
    expect(v.body).toContain('#ABCD') // first 4 chars of order_id, upper-cased
    expect(v.body).not.toContain('—')
  })

  it('omits the "#" fragment entirely when there is no code and no order_id', () => {
    const v = buildNotification({ kind: 'order', status: 'paid' })
    expect(v.title).toBe('Order submitted')
    expect(v.body).toContain('Your order reference is')
    expect(v.body).not.toContain('#')
    const ready = buildNotification({ kind: 'order', status: 'ready' })
    expect(ready.body).toBe('Collect order at the store')
    expect(ready.body).not.toContain('#')
  })

  it('carries the original payload fields through', () => {
    const v = buildNotification({ kind: 'order', status: 'ready', order_id: 'o1', at: 't' }, { order: pickup, storeName: 'X' })
    expect(v).toMatchObject({ kind: 'order', status: 'ready', order_id: 'o1', at: 't' })
  })

  it('returns null for unknown / unmapped statuses', () => {
    expect(buildNotification({ kind: 'order', status: 'preparing' })).toBeNull()
    expect(buildNotification({ kind: 'delivery', status: 'open' })).toBeNull()
    expect(buildNotification({ kind: 'nope', status: 'ready' })).toBeNull()
    expect(buildNotification(null)).toBeNull()
    expect(buildNotification({})).toBeNull()
  })
})

describe('shouldToast', () => {
  it('is true only for the toast statuses', () => {
    expect(shouldToast({ kind: 'order', status: 'ready' })).toBe(true)
    expect(shouldToast({ kind: 'order', status: 'completed' })).toBe(true)
    expect(shouldToast({ kind: 'delivery', status: 'accepted' })).toBe(true)
    expect(shouldToast({ kind: 'delivery', status: 'picked_up' })).toBe(true)
    expect(shouldToast({ kind: 'delivery', status: 'expired' })).toBe(true)
    expect(shouldToast({ kind: 'order', status: 'paid' })).toBe(false)
    expect(shouldToast({ kind: 'delivery', status: 'delivered' })).toBe(false)
    expect(shouldToast({ kind: 'order', status: 'preparing' })).toBe(false)
  })
})
