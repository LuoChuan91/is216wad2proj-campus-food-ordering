// Integration test for the student side of composables/useRiderLocation.js:
// useRiderLocation polls the courier's last GPS fix while the delivery is active,
// and keeps the last good fix when a poll fails. (useCourierBeacon has its own
// spec in useCourierBeacon.spec.js.)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

vi.mock('@/common/supabase.js', () => ({ default: null }))
vi.mock('@/services/api.js', () => ({ api: { riderLocation: vi.fn(), shareLocation: vi.fn() } }))

import { useRiderLocation } from '../useRiderLocation.js'

function run(deliveryId, active, fetchLocation, pollMs = 1000) {
  let fixRef
  const Host = defineComponent({
    setup() { fixRef = useRiderLocation(deliveryId, active, { fetchLocation, pollMs }).fix; return () => h('i') },
  })
  const wrapper = mount(Host)
  return { wrapper, fix: () => fixRef.value }
}

describe('useRiderLocation (student poll)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('loads the fix on mount when active, and polls on the interval', async () => {
    const fetchLocation = vi.fn()
      .mockResolvedValueOnce({ location: { lat: 1.29, lng: 103.85, at: 't0' } })
      .mockResolvedValueOnce({ location: { lat: 1.30, lng: 103.86, at: 't1' } })
    const { fix } = run('d1', true, fetchLocation)
    await flushPromises()
    expect(fix()).toMatchObject({ lat: 1.29 })
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(fix()).toMatchObject({ lat: 1.30 })
    expect(fetchLocation).toHaveBeenCalledTimes(2)
  })

  it('does not poll while inactive and clears the fix', async () => {
    const fetchLocation = vi.fn().mockResolvedValue({ location: { lat: 1, lng: 1 } })
    const active = ref(false)
    const { fix } = run('d1', active, fetchLocation)
    await flushPromises()
    expect(fetchLocation).not.toHaveBeenCalled()
    expect(fix()).toBeNull()

    active.value = true
    await flushPromises()
    expect(fetchLocation).toHaveBeenCalledTimes(1)
  })

  it('keeps the last good fix when a poll fails', async () => {
    const fetchLocation = vi.fn()
      .mockResolvedValueOnce({ location: { lat: 1.29, lng: 103.85 } })
      .mockRejectedValueOnce(new Error('timeout'))
    const { fix } = run('d1', true, fetchLocation)
    await flushPromises()
    expect(fix()).toMatchObject({ lat: 1.29 })
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(fix()).toMatchObject({ lat: 1.29 }) // unchanged after the failed poll
  })
})
