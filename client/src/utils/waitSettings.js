import { useCatalogStore } from '@/stores/catalog.js'
import { config as cfg } from '@/config/index.js'

export const MERCHANT_STRATEGIES = ['serial', 'scheduled']
export const DEFAULT_STRATEGY = 'scheduled'

export function waitSettings(storeId) {
  let store = null
  try {
    store = storeId ? useCatalogStore().store(storeId) : null
  } catch {
    store = null
  }
  return {
    stations: store?.workstations ?? cfg.kitchenSlots ?? 2,
    strategy: store?.wait_strategy ?? DEFAULT_STRATEGY,
  }
}
