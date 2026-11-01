import { defineStore } from 'pinia'
import { api } from '@/services/api.js'
import { useCatalogStore } from './catalog.js'

export const useMerchantStore = defineStore('merchant', () => {
  async function saveStore(storeId, changes) {
    const catalog = useCatalogStore()
    const saved = await api.updateStore(storeId, changes)
    const store = catalog.store(storeId)
    if (store) Object.assign(store, saved)
    catalog.decorateStores()
    return saved
  }

  function putItem(item) {
    const catalog = useCatalogStore()
    const i = catalog.db.menu.findIndex((m) => m.id === item.id)
    if (i >= 0) catalog.db.menu[i] = item
    else catalog.db.menu.push(item)
    catalog.decorateStores()
    return item
  }

  async function addMenuItem(storeId, fields) {
    return putItem(await api.addMenuItem({ ...fields, store_id: storeId }))
  }

  async function saveMenuItem(itemId, changes) {
    return putItem(await api.updateMenuItem(itemId, changes))
  }

  async function removeMenuItem(itemId) {
    const catalog = useCatalogStore()
    await api.removeMenuItem(itemId)
    catalog.db.menu = catalog.db.menu.filter((m) => m.id !== itemId)
    catalog.decorateStores()
  }

  return { saveStore, addMenuItem, saveMenuItem, removeMenuItem }
})
