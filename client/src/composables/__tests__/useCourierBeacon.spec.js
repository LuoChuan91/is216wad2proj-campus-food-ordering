// useCourierBeacon: shares the courier's GPS fix for every job in progress, and stops when there are none.
import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('@/common/supabase.js', () => ({ default: null }))
import { useCourierBeacon } from '../useRiderLocation.js'

function fakeGeo() {
  const geo = { onFix: null, onError: null, cleared: 0 }
  geo.watchPosition = (ok, err) => { geo.onFix = ok; geo.onError = err; return 7 }
  geo.clearWatch = () => { geo.cleared++ }
  return geo
}

function run(jobs, geo, share) {
  let state
  const C = defineComponent({ setup() { state = useCourierBeacon(jobs, () => 'stu-ben', { geo, share }).state; return () => h('i') } })
  return { wrapper: mount(C), state: () => state.value }
}

describe('useCourierBeacon', () => {
  it('sends the first fix to every job in progress', async () => {
    const geo = fakeGeo()
    const share = vi.fn().mockResolvedValue({})
    const { state } = run(ref(['d1', 'd2']), geo, share)
    expect(state()).toBe('waiting')
    geo.onFix({ coords: { latitude: 1.29, longitude: 103.85, accuracy: 9 } })
    expect(state()).toBe('on')
    expect(share).toHaveBeenCalledTimes(2)
    expect(share).toHaveBeenCalledWith('d1', 'stu-ben', { lat: 1.29, lng: 103.85, accuracy: 9 })
  })

  it('stops following GPS once there is no job in progress', async () => {
    const geo = fakeGeo()
    const jobs = ref(['d1'])
    const { state } = run(jobs, geo, vi.fn().mockResolvedValue({}))
    jobs.value = []
    await nextTick()
    expect(state()).toBe('off')
    expect(geo.cleared).toBe(1)
  })

  it('reports a blocked permission', () => {
    const geo = fakeGeo()
    const { state } = run(ref(['d1']), geo, vi.fn())
    geo.onError({ code: 1 })
    expect(state()).toBe('denied')
  })
})
