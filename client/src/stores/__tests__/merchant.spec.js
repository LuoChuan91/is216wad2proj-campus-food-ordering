// Store unit tests for stores/merchant.js — the merchant's menu/store CRUD
// wrappers that also keep the catalog store in sync. The api service is mocked so
// each action is driven by a fixed server response and we assert the catalog
// mutation + decoration, not the network.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api.js', () => ({
  api: {
    profiles: vi.fn(), venues: vi.fn(), destinations: vi.fn(), stores: vi.fn(), menu: vi.fn(),
    updateStore: vi.fn(),
    addMenuItem: vi.fn(),
    updateMenuItem: vi.fn(),
    removeMenuItem: vi.fn(),
  },
  setActor: vi.fn(),
}))

import { api } from '@/services/api.js'
import { useMerchantStore } from '../merchant.js'
import { useCatalogStore } from '../catalog.js'
import { seedCatalog } from './fixtures.js'

describe('merchant store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    seedCatalog()
  })

  it('saveStore merges the server response into the catalog record and re-decorates', async () => {
    api.updateStore.mockResolvedValue({ is_open: false, name: 'Bento Bar Deluxe' })
    const merchant = useMerchantStore()
    const catalog = useCatalogStore()

    const saved = await merchant.saveStore('s1', { is_open: false })

    expect(api.updateStore).toHaveBeenCalledWith('s1', { is_open: false })
    expect(saved).toEqual({ is_open: false, name: 'Bento Bar Deluxe' })
    const store = catalog.store('s1')
    expect(store.is_open).toBe(false)
    expect(store.name).toBe('Bento Bar Deluxe')
    expect(store.mono).toBeDefined() // re-decorated
  })

  it('addMenuItem inserts the new item returned by the server into the catalog menu', async () => {
    api.addMenuItem.mockResolvedValue({ id: 'm2', store_id: 's1', name: 'Gyoza', price: 4, category: 'Sides' })
    const merchant = useMerchantStore()
    const catalog = useCatalogStore()

    const item = await merchant.addMenuItem('s1', { name: 'Gyoza', price: 4, category: 'Sides' })

    expect(api.addMenuItem).toHaveBeenCalledWith({ name: 'Gyoza', price: 4, category: 'Sides', store_id: 's1' })
    expect(item.id).toBe('m2')
    expect(catalog.item('m2')).toMatchObject({ name: 'Gyoza', price: 4 })
  })

  it('saveMenuItem replaces the existing item in place', async () => {
    api.updateMenuItem.mockResolvedValue({ id: 'm1', store_id: 's1', name: 'Chicken Teriyaki', price: 7, available: false })
    const merchant = useMerchantStore()
    const catalog = useCatalogStore()

    await merchant.saveMenuItem('m1', { price: 7, available: false })

    expect(api.updateMenuItem).toHaveBeenCalledWith('m1', { price: 7, available: false })
    expect(catalog.item('m1')).toMatchObject({ price: 7, available: false })
    expect(catalog.menuOf('s1')).toHaveLength(1) // replaced, not duplicated
  })

  it('removeMenuItem deletes the item from the catalog menu', async () => {
    api.removeMenuItem.mockResolvedValue({})
    const merchant = useMerchantStore()
    const catalog = useCatalogStore()

    await merchant.removeMenuItem('m1')

    expect(api.removeMenuItem).toHaveBeenCalledWith('m1')
    expect(catalog.item('m1')).toBeUndefined()
    expect(catalog.menuOf('s1')).toHaveLength(0)
  })
})
