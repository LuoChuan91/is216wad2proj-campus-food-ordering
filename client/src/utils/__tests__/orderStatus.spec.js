// Pure unit test for utils/orderStatus.js — the human-facing order status label.
// This is the single home for the full label matrix (OrderRow.vue just renders
// this function, so its component spec no longer repeats every permutation).
import { describe, it, expect } from 'vitest'
import { orderStatusLabel } from '../orderStatus.js'

describe('orderStatusLabel', () => {
  it('maps the in-progress statuses', () => {
    expect(orderStatusLabel({ status: 'pending' })).toBe('Pending')
    expect(orderStatusLabel({ status: 'paid' })).toBe('In queue')
    expect(orderStatusLabel({ status: 'preparing' })).toBe('Cooking')
    expect(orderStatusLabel({ status: 'ready' })).toBe('Ready')
    expect(orderStatusLabel({ status: 'cancelled' })).toBe('Cancelled')
  })

  it('completed with a real delivery (not fallback) -> Delivered', () => {
    expect(orderStatusLabel({ status: 'completed', delivery: { status: 'delivered' }, fallback: false }))
      .toBe('Delivered')
  })

  it('completed delivery that fell back to pickup -> Collected', () => {
    expect(orderStatusLabel({ status: 'completed', delivery: { status: 'delivered' }, fallback: true }))
      .toBe('Collected')
  })

  it('completed pickup (no delivery) -> Collected', () => {
    expect(orderStatusLabel({ status: 'completed' })).toBe('Collected')
  })

  it('ready while the courier has picked it up -> On the way', () => {
    expect(orderStatusLabel({ status: 'ready', delivery: { status: 'picked_up' } })).toBe('On the way')
  })

  it('ready with an accepted (not yet picked up) delivery stays Ready', () => {
    expect(orderStatusLabel({ status: 'ready', delivery: { status: 'accepted' } })).toBe('Ready')
  })

  it('falls through to the raw value for an unknown status', () => {
    expect(orderStatusLabel({ status: 'weird' })).toBe('weird')
  })
})
