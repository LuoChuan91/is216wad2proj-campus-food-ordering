// Catalog store.
//
// The slow-changing reference data loaded once at start-up (and re-polled rarely):
// profiles, venues, delivery destinations, stores and the full menu. Also the
// display-only decoration the database doesn't store (monogram, colour, cuisine,
// unit) and the catalog lookup getters (the "Q" catalog queries).
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { api } from '@/services/api.js'

const PALETTE = ['#d9472b', '#2e8f57', '#3a66cc', '#8a5a2b', '#7b4bb7', '#c2410c', '#0f766e', '#a21caf', '#b7791f', '#2f2f35']

function initials(name) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const by = (arr, id) => arr.find((x) => x.id === id)

export const useCatalogStore = defineStore('catalog', () => {
  const db = reactive({
    profiles: [], venues: [], destinations: [], stores: [], menu: [],
  })

  // quick solution to decoration details that DB dont store: monogram, colour, cuisine (from the
  // menu categories) and where in the building the store is
  function decorateStores() {
    for (const [i, s] of db.stores.entries()) {
      const cats = [...new Set(db.menu.filter((m) => m.store_id === s.id).map((m) => m.category))]
      s.mono = initials(s.name)
      s.color = PALETTE[i % PALETTE.length]
      s.cuisine = cats.join(' · ') || s.description || 'Food'
      const v = db.venues.find((x) => x.id === s.venue_id)
      s.unit_no = v ? v.address || v.name : ''
    }
  }

  async function loadCatalog() {
    const [profiles, venues, destinations, stores, menu] = await Promise.all([
      api.profiles(), api.venues(), api.destinations(), api.stores(), api.menu(),
    ])
    db.profiles = profiles
    db.venues = venues
    db.destinations = destinations
    db.menu = menu
    db.stores = stores
    decorateStores()
  }

  /* ---------- catalog queries ---------- */
  const user = (id) => by(db.profiles, id)
  const venue = (id) => by(db.venues, id)
  const store = (id) => by(db.stores, id)
  const item = (id) => by(db.menu, id)
  const dropoff = (id) => by(db.destinations, id)
  // option groups, required ones first (otherwise in the database's order)
  function groups(itemId) {
    const it = item(itemId)
    if (!it) return []
    return (it.option_groups || []).slice().sort((a, b) => Number(b.required) - Number(a.required))
  }
  const options = (itemId) => groups(itemId).flatMap((g) => (g.options || []).map((o) => ({ ...o, group_id: g.id })))
  const storesAt = (venueId) => db.stores.filter((s) => s.venue_id === venueId)
  const storesOf = (merchantId) => db.stores.filter((s) => s.merchant_id === merchantId)
  const menuOf = (storeId) => db.menu.filter((m) => m.store_id === storeId)

  // A store is "available" to order from only when its merchant account is active.
  // A blocked/removed (or missing) merchant makes the store unorderable, so the
  // student store cards grey it out and it can't be opened.
  function storeAvailable(store) {
    if (!store) return false
    const m = by(db.profiles, store.merchant_id)
    return !!m && m.status === 'active'
  }

  return {
    db,
    decorateStores, loadCatalog,
    user, venue, store, item, dropoff, groups, options, storesAt, storesOf, menuOf, storeAvailable,
  }
})
