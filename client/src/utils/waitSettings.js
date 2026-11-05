import { useCatalogStore } from '@/stores/catalog.js'
import { config as cfg } from '@/config/index.js'

// Resolve a store's wait settings (workstations / wait_strategy) from its loaded
// record, falling back to config.wait defaults when the store or a column is missing.
export const MERCHANT_STRATEGIES = ['serial', 'scheduled']

// The default settings object the estimators fall back to (frozen copy of the
// single source of truth in config.wait).
export const DEFAULT_WAIT = Object.freeze({
  stations: cfg.wait?.stations ?? 2,
  strategy: cfg.wait?.strategy ?? 'scheduled',
})

/**
 * Resolve a store's wait-time settings, taken DIRECTLY from the server-provided
 * store record (stores.workstations / stores.wait_strategy). Falls back to
 * DEFAULT_WAIT only when the store isn't loaded or a column is missing.
 * @param {string} storeId
 * @returns {{ stations: number, strategy: 'serial'|'scheduled' }}
 */
export function waitSettings(storeId) {
  let store = null
  try {
    store = storeId ? useCatalogStore().store(storeId) : null
  } catch {
    store = null
  }
  return {
    stations: store?.workstations ?? DEFAULT_WAIT.stations,
    strategy: store?.wait_strategy ?? DEFAULT_WAIT.strategy,
  }
}
