import { describe, it, expect } from 'vitest'
import { toNotificationView, shouldToast } from '../notificationMessages.js'

describe('toNotificationView', () => {
  it('maps order statuses', () => {
    expect(toNotificationView({ kind: 'order', status: 'paid' })).toMatchObject({ title: 'Order placed', toast: false })
    expect(toNotificationView({ kind: 'order', status: 'ready' })).toMatchObject({ variant: 'success', toast: true })
    expect(toNotificationView({ kind: 'order', status: 'completed' })).toMatchObject({ toast: true })
  })

  it('maps delivery statuses', () => {
    expect(toNotificationView({ kind: 'delivery', status: 'accepted' })).toMatchObject({ title: 'Delivery ready', toast: true })
    expect(toNotificationView({ kind: 'delivery', status: 'picked_up' })).toMatchObject({ toast: true })
    expect(toNotificationView({ kind: 'delivery', status: 'delivered' })).toMatchObject({ toast: false })
  })

  it('carries the original payload fields through', () => {
    const view = toNotificationView({ kind: 'order', status: 'ready', order_id: 'o1', at: 't' })
    expect(view).toMatchObject({ kind: 'order', status: 'ready', order_id: 'o1', at: 't' })
  })

  it('returns null for unknown / unmapped statuses', () => {
    expect(toNotificationView({ kind: 'order', status: 'preparing' })).toBeNull()
    expect(toNotificationView({ kind: 'delivery', status: 'open' })).toBeNull()
    expect(toNotificationView({ kind: 'nope', status: 'ready' })).toBeNull()
    expect(toNotificationView(null)).toBeNull()
    expect(toNotificationView({})).toBeNull()
  })
})

describe('shouldToast', () => {
  it('is true only for the toast statuses', () => {
    expect(shouldToast({ kind: 'order', status: 'ready' })).toBe(true)
    expect(shouldToast({ kind: 'order', status: 'completed' })).toBe(true)
    expect(shouldToast({ kind: 'delivery', status: 'accepted' })).toBe(true)
    expect(shouldToast({ kind: 'delivery', status: 'picked_up' })).toBe(true)
    expect(shouldToast({ kind: 'order', status: 'paid' })).toBe(false)
    expect(shouldToast({ kind: 'delivery', status: 'delivered' })).toBe(false)
    expect(shouldToast({ kind: 'order', status: 'preparing' })).toBe(false)
  })
})
