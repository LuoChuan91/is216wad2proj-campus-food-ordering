import { describe, it, expect } from 'vitest'
import { toOrderReference } from '../orderReference.js'
import { estimateWalkingSeconds, DEFAULT_WALK_SECONDS } from '../mapApi.js'
import { computeEta } from '../eta.js'

describe('toOrderReference', () => {
  it('derives an uppercased 6-hex reference with default prefix', () => {
    expect(toOrderReference('3f2a1b9c-dead-beef-0000-111122223333')).toBe('ORD-3F2A1B')
  })
  it('supports a custom prefix', () => {
    expect(toOrderReference('abcdef12-0000', 'DLV')).toBe('DLV-ABCDEF')
  })
  it('is deterministic', () => {
    const id = '12345678-aaaa'
    expect(toOrderReference(id)).toBe(toOrderReference(id))
  })
  it('handles bad input', () => {
    expect(toOrderReference(null)).toBe('ORD-??????')
    expect(toOrderReference('')).toBe('ORD-??????')
  })
})

describe('estimateWalkingSeconds (placeholder)', () => {
  it('returns the default when coordinates are missing', () => {
    expect(estimateWalkingSeconds(null, null)).toBe(DEFAULT_WALK_SECONDS)
    expect(estimateWalkingSeconds({ lat: 1, lng: 1 }, null)).toBe(DEFAULT_WALK_SECONDS)
  })
  it('returns 0 for identical points', () => {
    const p = { lat: 1.296, lng: 103.85 }
    expect(estimateWalkingSeconds(p, p)).toBe(0)
  })
  it('grows with distance', () => {
    const a = { lat: 1.296, lng: 103.85 }
    const near = { lat: 1.297, lng: 103.851 }
    const far = { lat: 1.31, lng: 103.86 }
    expect(estimateWalkingSeconds(a, far)).toBeGreaterThan(estimateWalkingSeconds(a, near))
  })
})

describe('computeEta', () => {
  const now = new Date('2026-01-01T12:00:00').getTime()

  it('readyAt = now + wait; no walk by default', () => {
    const eta = computeEta(now, 600) // +10 min
    expect(eta.readyAt.getTime()).toBe(now + 600_000)
    expect(eta.deliveredAt.getTime()).toBe(now + 600_000) // same, walk=0
    expect(eta.readyInSeconds).toBe(600)
  })

  it('deliveredAt adds the walking leg', () => {
    const eta = computeEta(now, 600, 300) // 10 min cook + 5 min walk
    expect(eta.deliveredAt.getTime()).toBe(now + 900_000)
    expect(eta.deliveredInSeconds).toBe(900)
  })

  it('produces clock labels', () => {
    const eta = computeEta(now, 0)
    expect(typeof eta.readyAtLabel).toBe('string')
    expect(eta.readyAtLabel.length).toBeGreaterThan(0)
  })

  it('clamps negative inputs', () => {
    const eta = computeEta(now, -100, -50)
    expect(eta.readyInSeconds).toBe(0)
    expect(eta.deliveredInSeconds).toBe(0)
  })
})
