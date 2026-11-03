import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/common/supabase.js', () => ({ default: null }))
vi.mock('@/services/api.js', () => ({
  api: { storeAnalytics: vi.fn() },
  setActor: vi.fn(),
}))

import { api } from '@/services/api.js'
import { useOrdersStore } from '@/stores/orders.js'
import MerchantAnalyticsView from '../MerchantAnalyticsView.vue'

const RESULT = {
  store_id: 's1', from: '2026-10-29', to: '2026-11-04', earnings: 123.5, orders: 14, avg_wait_min: 8.36,
  daily: [
    { date: '2026-10-29', orders: 0, earnings: 0, avg_wait_min: null },
    { date: '2026-11-04', orders: 14, earnings: 123.5, avg_wait_min: 8.36 },
  ],
}

function mountView() {
  return mount(MerchantAnalyticsView, {
    global: {
      provide: { merchantStore: ref({ id: 's1', name: 'Bento Bar' }) },
      stubs: { TrendChart: { props: ['labels', 'values', 'label'], template: '<div class="chart-stub" :data-label="label">{{ values.join(",") }}</div>' } },
    },
  })
}

describe('merchant analytics view', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T12:00:00+08:00'))
    api.storeAnalytics.mockResolvedValue(RESULT)
  })
  afterEach(() => vi.useRealTimers())

  it('loads the last 7 days in Singapore time and shows the totals', async () => {
    const w = mountView()
    await flushPromises()
    expect(api.storeAnalytics).toHaveBeenCalledWith('s1', '2026-10-29', '2026-11-04')
    expect(w.text()).toContain('$123.50')
    expect(w.text()).toContain('14')
    expect(w.text()).toContain('8.4 min')
    expect(w.find('[data-label="Orders"]').text()).toBe('0,14')
  })

  it('switching to Today and 30 days refetches with the new range', async () => {
    const w = mountView()
    await flushPromises()
    const button = (label) => w.findAll('button').find((b) => b.text() === label)
    await button('Today').trigger('click')
    await flushPromises()
    expect(api.storeAnalytics).toHaveBeenLastCalledWith('s1', '2026-11-04', '2026-11-04')
    await button('30 days').trigger('click')
    await flushPromises()
    expect(api.storeAnalytics).toHaveBeenLastCalledWith('s1', '2026-10-06', '2026-11-04')
  })

  it('a backwards custom range shows a warning and does not call the server', async () => {
    const w = mountView()
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Custom').trigger('click')
    const [from, to] = w.findAll('input[type="date"]')
    await from.setValue('2026-11-03')
    await to.setValue('2026-11-01')
    await flushPromises()
    expect(api.storeAnalytics).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('The start date must be on or before the end date.')
  })

  it("refetches when this store's orders change", async () => {
    mountView()
    await flushPromises()
    useOrdersStore().db.orders = [{ id: 'o1', store_id: 's1', status: 'paid' }]
    await flushPromises()
    expect(api.storeAnalytics).toHaveBeenCalledTimes(2)
  })

  it('shows the server error with a retry button', async () => {
    api.storeAnalytics.mockRejectedValueOnce(new Error("You can only see your own store's analytics"))
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain("Couldn’t load analytics: You can only see your own store's analytics")
    await w.findAll('button').find((b) => b.text() === 'Try again').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('$123.50')
  })
})
