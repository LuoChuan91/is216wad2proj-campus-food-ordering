// Shared catalog fixture for store tests. Seeds one venue, one store (with a
// merchant), a couple of destinations and a customisable menu item, then runs
// decorateStores so the display fields exist.
import { useCatalogStore } from '../catalog.js'

export function seedCatalog() {
  const catalog = useCatalogStore()
  catalog.db.profiles = [
    { id: 'stu', role: 'student', name: 'Aiden Tan', status: 'active' },
    { id: 'stu2', role: 'student', name: 'Bao Lim', status: 'active' },
    { id: 'mer', role: 'merchant', name: 'Mei Lin', status: 'active' },
    { id: 'adm', role: 'admin', name: 'Admin', status: 'active' },
  ]
  catalog.db.venues = [{ id: 'v1', name: 'SMU Labs', lat: 1.2966, lng: 103.85, address: 'Level 1' }]
  catalog.db.destinations = [
    { id: 'd1', name: 'Front desk', lat: 1.2966, lng: 103.85 },     // nearest to the venue
    { id: 'd2', name: 'Far corner', lat: 1.3200, lng: 103.88 },     // far
  ]
  catalog.db.stores = [{
    id: 's1', venue_id: 'v1', merchant_id: 'mer', name: 'Bento Bar',
    is_open: true, description: '', workstations: 2, wait_strategy: 'scheduled',
  }]
  catalog.db.menu = [{
    id: 'm1', store_id: 's1', category: 'Bento', name: 'Chicken Teriyaki', price: 6, available: true,
    option_groups: [
      { id: 'g1', name: 'Rice', type: 'single', required: true, min_select: 1, max_select: 1, options: [
        { id: 'o1', name: 'White Rice', price_delta: 0, available: true },
        { id: 'o2', name: 'Brown Rice', price_delta: 0.5, available: true },
      ] },
      { id: 'g2', name: 'Toppings', type: 'multi', required: false, min_select: 0, max_select: 2, options: [
        { id: 'o3', name: 'Tamago', price_delta: 1, available: true },
      ] },
    ],
  }]
  catalog.decorateStores()
  return catalog
}
