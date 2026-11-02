// Unit tests for utils/routing.js — OSRM walking routes with a straight-line
// fallback. The module keeps a cache + "unreachable" cooldown at module scope,
// so each test uses DISTINCT coordinates to avoid cross-test cache collisions.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getRoute, ensureRoute } from '../routing.js'

const A = { lat: 1.2900, lng: 103.8500 }

describe('getRoute (synchronous read)', () => {
  it('returns a straight-line estimate when nothing is cached', () => {
    const r = getRoute(A, { lat: 1.2950, lng: 103.8550 })
    expect(r.source).toBe('estimate')
    expect(r.meters).toBeGreaterThan(0)
    expect(r.minutes).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(r.coords)).toBe(true)
  })
})

describe('ensureRoute (background fetch)', () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = realFetch
    vi.restoreAllMocks()
  })

  it('caches a successful OSRM response so getRoute then returns the real route', async () => {
    const B = { lat: 1.3000, lng: 103.8600 } // unique pair for this test
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{
          distance: 500,
          duration: 420, // 7 min
          geometry: { coordinates: [[103.85, 1.29], [103.86, 1.30]] },
        }],
      }),
    })

    await ensureRoute(A, B)
    const r = getRoute(A, B)
    expect(r.source).toBe('osrm')
    expect(r.meters).toBe(500)
    expect(r.minutes).toBe(7)
    // coordinates are flipped from [lng,lat] to [lat,lng]
    expect(r.coords[0]).toEqual([1.29, 103.85])
  })

  it('falls back to the estimate (no cache written) when the fetch fails', async () => {
    const C = { lat: 1.3100, lng: 103.8700 } // unique pair
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))

    await ensureRoute(A, C)
    const r = getRoute(A, C)
    expect(r.source).toBe('estimate') // nothing cached -> still an estimate
  })

  it('does not fetch when fetch is unavailable in the environment', async () => {
    const D = { lat: 1.3200, lng: 103.8800 }
    globalThis.fetch = undefined
    // Should simply return without throwing.
    await expect(ensureRoute(A, D)).resolves.toBeUndefined()
    expect(getRoute(A, D).source).toBe('estimate')
  })
})
