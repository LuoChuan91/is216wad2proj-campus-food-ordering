import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/common/supabase.js', () => ({ default: null }))
vi.mock('@/services/api.js', () => ({
  api: {
    updateStore: vi.fn(),
    addMenuItem: vi.fn(),
    updateMenuItem: vi.fn(),
    removeMenuItem: vi.fn(),
  },
  setActor: vi.fn(),
}))

import { api } from '@/services/api.js'
import { useCatalogStore } from '@/stores/catalog.js'
import MerchantStoreView from '../MerchantStoreView.vue'
import MerchantMenuView from '../MerchantMenuView.vue'

const STORE = {
  id: 's1', name: 'Bento Bar', merchant_id: 'mer', is_open: true, description: 'Rice', image_url: '',
  open_hours: { mon: ['11:00', '20:00'] },
}
const ITEM = { id: 'm1', store_id: 's1', category: 'Bento', name: 'Teriyaki', price: 6, available: true, cook_time_sec: 300, max_at_once: 2, option_groups: [] }

let catalog
function mountView(View) {
  return mount(View, { global: { provide: { merchantStore: ref(catalog.store('s1')) } } })
}

describe('merchant edit views', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    catalog = useCatalogStore()
    catalog.db.stores = [{ ...STORE }]
    catalog.db.menu = [{ ...ITEM }]
  })

  it('store form will not save without a name', async () => {
    const w = mountView(MerchantStoreView)
    await w.find('#store-name').setValue('  ')
    await w.find('form').trigger('submit')
    expect(api.updateStore).not.toHaveBeenCalled()
    expect(w.find('#store-name').classes()).toContain('is-invalid')
    expect(w.text()).toContain('Store name is required.')
  })

  it('store form saves details and opening hours, then shows success', async () => {
    api.updateStore.mockImplementation(async (id, changes) => ({ ...STORE, ...changes }))
    const w = mountView(MerchantStoreView)
    await w.find('#store-name').setValue('Bento Bar Express')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(api.updateStore).toHaveBeenCalledWith('s1', {
      name: 'Bento Bar Express', description: 'Rice', image_url: '', open_hours: { mon: ['11:00', '20:00'] },
    })
    expect(catalog.store('s1').name).toBe('Bento Bar Express')
    expect(w.text()).toContain('Store details saved.')
  })

  it('store form shows the server error', async () => {
    api.updateStore.mockRejectedValue(new Error('You can only change your own store'))
    const w = mountView(MerchantStoreView)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('You can only change your own store')
  })

  it('adding a menu item posts it and shows it in the list', async () => {
    api.addMenuItem.mockImplementation(async (body) => ({ id: 'm2', option_groups: [], ...body }))
    const w = mountView(MerchantMenuView)
    await w.findAll('button').find((b) => b.text().includes('Add item')).trigger('click')
    await w.find('#item-name').setValue('Katsu Don')
    await w.find('#item-price').setValue('7.5')
    await w.find('#item-cook').setValue('4')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(api.addMenuItem).toHaveBeenCalledWith(expect.objectContaining({
      store_id: 's1', name: 'Katsu Don', category: 'Bento', price: 7.5, cook_time_sec: 240, max_at_once: 1,
    }))
    expect(w.text()).toContain('Katsu Don')
    expect(w.find('#item-name').exists()).toBe(false)
  })

  it('removing a menu item asks first, then drops it', async () => {
    api.removeMenuItem.mockResolvedValue({ id: 'm1', removed: true })
    const w = mountView(MerchantMenuView)
    await w.find('button[aria-label="Remove Teriyaki"]').trigger('click')
    await w.findAll('button').find((b) => b.text() === 'Remove').trigger('click')
    await flushPromises()
    expect(api.removeMenuItem).toHaveBeenCalledWith('m1')
    expect(catalog.db.menu).toHaveLength(0)
  })
})
