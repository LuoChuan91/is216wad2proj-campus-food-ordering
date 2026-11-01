import { describe, it, expect } from 'vitest'
import { pathLength, pointAt, progressOf, riderEstimate, FIX_FRESH_MS } from '../riderPosition.js'

// An L-shaped route: ~111 m north, then ~111 m east
const route = [[1.2950, 103.8490], [1.2960, 103.8490], [1.2960, 103.8500]]

describe('riderPosition', () => {
  it('measures the route in metres', () => {
    expect(Math.round(pathLength(route))).toBe(223)
  })

  it('finds the point halfway along by distance (the corner)', () => {
    const [lat, lng] = pointAt(route, 0.5)
    expect(lat).toBeCloseTo(1.296, 5)
    expect(lng).toBeCloseTo(103.849, 5)
  })

  it('projects a GPS point onto the route', () => {
    expect(progressOf(route, [1.29605, 103.8495])).toBeCloseTo(0.75, 1)
  })

  it('uses a fresh GPS fix when the courier is carrying the food', () => {
    const now = Date.now()
    const r = riderEstimate({ coords: route, status: 'picked_up', now, fix: { lat: 1.2960, lng: 103.8495, accuracy: 9, at: new Date(now - 5e3).toISOString() } })
    expect(r.source).toBe('gps')
    expect(r.progress).toBeCloseTo(0.75, 1)
    expect(r.metresLeft).toBeGreaterThan(50)
    expect(r.metresLeft).toBeLessThan(60)
  })

  it('estimates from walking time when the fix is stale, and never claims arrival', () => {
    const now = Date.now()
    const stale = { lat: 1.2960, lng: 103.8495, at: new Date(now - FIX_FRESH_MS - 1).toISOString() }
    const r = riderEstimate({ coords: route, status: 'picked_up', pickedUpAt: now - 60e3, now, fix: stale })
    expect(r.source).toBe('estimate')
    expect(r.progress).toBeCloseTo(75 / 222.6, 2) // one minute at 75 m/min
    const late = riderEstimate({ coords: route, status: 'picked_up', pickedUpAt: now - 3600e3, now })
    expect(late.progress).toBe(0.95)
  })

  it('puts the courier at the store before pickup when there is no fix', () => {
    const r = riderEstimate({ coords: route, status: 'accepted', now: Date.now() })
    expect([r.lat, r.lng]).toEqual(route[0])
    expect(r.metresLeft).toBeNull()
  })
})
