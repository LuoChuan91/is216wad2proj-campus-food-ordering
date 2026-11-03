import { describe, it, expect } from 'vitest'
import { estimateWalkingSeconds, DEFAULT_WALK_SECONDS } from '../mapApi.js'

describe('estimateWalkingSeconds', () => {
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
