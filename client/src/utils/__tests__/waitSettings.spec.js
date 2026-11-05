import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/common/supabase.js', () => ({ default: null }))
vi.mock('@/utils/waitTimeApi.js', () => ({
  fetchQueue: vi.fn().mockResolvedValue({
    orderItems: [{ menu_item_id: 'm1', qty: 4 }],
    cookingDetails: [{ id: 'm1', cook_time_sec: 60, max_at_once: 1 }],
    ahead: 1,
  }),
}))

import { useCatalogStore } from '@/stores/catalog.js'
import { waitSettings } from '../waitSettings.js'
import { acquireStoreWait, _resetStoreWaitCache } from '@/composables/storeWaitCache.js'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('waitSettings', () => {
  let catalog
  beforeEach(() => {
    setActivePinia(createPinia())
    _resetStoreWaitCache()
    catalog = useCatalogStore()
    catalog.db.stores = [
      { id: 's1', name: 'A' },
      { id: 's2', name: 'B', workstations: 4, wait_strategy: 'serial' },
    ]
  })

  it('falls back to 2 workstations and the scheduled strategy', () => {
    expect(waitSettings('s1')).toEqual({ stations: 2, strategy: 'scheduled' })
    expect(waitSettings('missing')).toEqual({ stations: 2, strategy: 'scheduled' })
  })

  it("uses the store's saved settings", () => {
    expect(waitSettings('s2')).toEqual({ stations: 4, strategy: 'serial' })
  })

  it('the shared store-wait estimate recomputes when the settings change', async () => {
    const entry = acquireStoreWait('s1')
    await flush()
    expect(entry.seconds).toBe(120)

    catalog.store('s1').workstations = 4
    await nextTick()
    expect(entry.seconds).toBe(60)

    catalog.store('s1').wait_strategy = 'serial'
    await nextTick()
    expect(entry.seconds).toBe(240)
  })
})
