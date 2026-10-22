// Tests for the Pinia stores ported from the old app/state.js.
//
// They cover the behaviour that used to live in state.js and must be preserved:
// the catalog getters + decorateStores, the cart/option/validate logic, the
// busy-wrapped run(), notify()/toasts, session sign-in resetting per-user state,
// and the checkout estimate. The api service is mocked so no network is touched.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the API service used by the stores. estimate/placeOrder resolve with fixed data.
vi.mock('@/services/api.js', () => ({
  api: {
    profiles: vi.fn().mockResolvedValue([]),
    profile: vi.fn().mockResolvedValue({}),
    venues: vi.fn().mockResolvedValue([]),
    destinations: vi.fn().mockResolvedValue([]),
    stores: vi.fn().mockResolvedValue([]),
    menu: vi.fn().mockResolvedValue([]),
    waitTimes: vi.fn().mockResolvedValue({ stores: {}, orders: {}, slots: 2 }),
    estimate: vi.fn().mockResolvedValue({ readyAt: 123, minutes: 7 }),
    studentOrders: vi.fn().mockResolvedValue([]),
    storeOrders: vi.fn().mockResolvedValue([]),
    openJobs: vi.fn().mockResolvedValue([]),
    expiredJobs: vi.fn().mockResolvedValue([]),
    myJobs: vi.fn().mockResolvedValue([]),
    placeOrder: vi.fn().mockResolvedValue({ id: 'o-new' }),
    setOrderStatus: vi.fn(),
    setItemAvailable: vi.fn(),
    updateStore: vi.fn(),
    delivery: vi.fn(),
    setProfileStatus: vi.fn(),
    addVenue: vi.fn(),
  },
}))

import { useSessionStore } from '../session.js'
import { useCatalogStore } from '../catalog.js'
import { useOrdersStore } from '../orders.js'
import { useUiStore } from '../ui.js'

// A small fixture: one venue, one store, one menu item with a required single-choice
// group and an optional multi group.
function seedCatalog() {
  const catalog = useCatalogStore()
  catalog.db.profiles = [
    { id: 'stu', role: 'student', name: 'Aiden Tan', status: 'active' },
    { id: 'mer', role: 'merchant', name: 'Mei Lin', status: 'active' },
    { id: 'adm', role: 'admin', name: 'Admin', status: 'active' },
  ]
  catalog.db.venues = [{ id: 'v1', name: 'SMU Labs', lat: 1.2966, lng: 103.85, address: 'Level 1' }]
  catalog.db.destinations = [{ id: 'd1', name: 'Front desk', lat: 1.2966, lng: 103.85 }]
  catalog.db.stores = [{ id: 's1', venue_id: 'v1', merchant_id: 'mer', name: 'Bento Bar', is_open: true, description: '' }]
  catalog.db.menu = [{
    id: 'm1', store_id: 's1', category: 'Bento', name: 'Chicken Teriyaki', price: 6, available: true,
    option_groups: [
      { id: 'g1', name: 'Rice', type: 'single', required: true, min_select: 1, max_select: 1, options: [
        { id: 'o1', name: 'White Rice', price_delta: 0, available: true },
        { id: 'o2', name: 'Brown Rice', price_delta: 0.5, available: true },
      ] },
      { id: 'g2', name: 'Toppings', type: 'multi', required: false, min_select: 0, max_select: 2, options: [
        { id: 'o3', name: 'Tamago', price_delta: 1, available: true },
        { id: 'o4', name: 'Seaweed', price_delta: 0.5, available: true },
      ] },
    ],
  }]
  catalog.decorateStores()
  return catalog
}

describe('catalog store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('decorateStores adds mono, colour, cuisine and unit', () => {
    const catalog = seedCatalog()
    const s = catalog.store('s1')
    expect(s.mono).toBe('BB')
    expect(s.color).toMatch(/^#/)
    expect(s.cuisine).toBe('Bento')
    expect(s.unit_no).toBe('Level 1')
  })

  it('getters look up by id', () => {
    const catalog = seedCatalog()
    expect(catalog.user('stu').name).toBe('Aiden Tan')
    expect(catalog.venue('v1').name).toBe('SMU Labs')
    expect(catalog.item('m1').name).toBe('Chicken Teriyaki')
    expect(catalog.dropoff('d1').name).toBe('Front desk')
    expect(catalog.storesAt('v1')).toHaveLength(1)
    expect(catalog.storesOf('mer')).toHaveLength(1)
    expect(catalog.menuOf('s1')).toHaveLength(1)
  })

  it('groups puts required groups first and flattens options with group_id', () => {
    const catalog = seedCatalog()
    const groups = catalog.groups('m1')
    expect(groups[0].id).toBe('g1') // required single first
    const opts = catalog.options('m1')
    expect(opts.find((o) => o.id === 'o1').group_id).toBe('g1')
    expect(opts).toHaveLength(4)
  })
})

describe('ui store: cart, options and validate', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('openItem refuses an unavailable item', () => {
    const catalog = seedCatalog()
    catalog.item('m1').available = false
    const ui = useUiStore()
    ui.openItem('m1')
    expect(ui.ui.student.sheet).toBe(null)
  })

  it('toggleOption enforces single-choice and multi max', () => {
    seedCatalog()
    const ui = useUiStore()
    ui.openItem('m1')
    // single group: picking o2 replaces o1
    ui.toggleOption('o1')
    ui.toggleOption('o2')
    expect(ui.ui.student.draft.selected).toContain('o2')
    expect(ui.ui.student.draft.selected).not.toContain('o1')
    // multi group max 2
    ui.toggleOption('o3')
    ui.toggleOption('o4')
    expect(ui.ui.student.draft.selected).toEqual(expect.arrayContaining(['o2', 'o3', 'o4']))
  })

  it('addToCart is blocked until required group is satisfied, then adds a priced line', () => {
    seedCatalog()
    const ui = useUiStore()
    ui.openItem('m1')
    ui.addToCart() // required Rice not chosen -> blocked
    expect(ui.ui.student.cart.lines).toHaveLength(0)
    ui.toggleOption('o2') // Brown Rice (+0.5)
    ui.toggleOption('o3') // Tamago (+1)
    ui.setDraftQty(2)
    ui.addToCart()
    expect(ui.ui.student.cart.lines).toHaveLength(1)
    const line = ui.ui.student.cart.lines[0]
    expect(line.qty).toBe(2)
    expect(line.unit_price).toBe(7.5) // 6 + 0.5 + 1
    expect(ui.ui.student.cart.storeId).toBe('s1')
  })

  it('setLineQty to 0 removes the line and clears the store', () => {
    seedCatalog()
    const ui = useUiStore()
    ui.openItem('m1')
    ui.toggleOption('o1')
    ui.addToCart()
    const key = ui.ui.student.cart.lines[0].key
    ui.setLineQty(key, 0)
    expect(ui.ui.student.cart.lines).toHaveLength(0)
    expect(ui.ui.student.cart.storeId).toBe(null)
  })
})

describe('ui store: notify, toasts and run()', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  it('notify unshifts a notification and pushes a toast', () => {
    const ui = useUiStore()
    ui.notify('Hello', 'World', 'ok')
    expect(ui.notifications[0].title).toBe('Hello')
    expect(ui.toasts).toHaveLength(1)
    vi.useRealTimers()
  })

  it('run() marks busy, returns the result and clears busy; a failure notifies', async () => {
    vi.useRealTimers()
    const ui = useUiStore()
    const ok = await ui.run('k1', async () => 'done')
    expect(ok).toBe('done')
    expect(ui.busy.k1).toBeUndefined()
    const bad = await ui.run('k2', async () => { throw new Error('nope') })
    expect(bad).toBe(null)
    expect(ui.notifications[0].body).toBe('nope')
  })
})

describe('session store: signIn resets per-user state', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('student sign-in builds a fresh student ui and clears db lists', () => {
    seedCatalog()
    const session = useSessionStore()
    const ui = useUiStore()
    const orders = useOrdersStore()
    orders.db.orders = [{ id: 'x' }]
    ui.notifications.push({ id: 1, title: 't' })
    session.signIn('stu')
    expect(session.session.userId).toBe('stu')
    expect(orders.db.orders).toEqual([])
    expect(ui.notifications).toEqual([])
    expect(ui.ui.student.tab).toBe('explore')
  })

  it('merchant sign-in selects their first store', () => {
    seedCatalog()
    const session = useSessionStore()
    const ui = useUiStore()
    session.signIn('mer')
    expect(ui.ui.staff.storeId).toBe('s1')
  })

  it('signIn ignores an unknown id', () => {
    seedCatalog()
    const session = useSessionStore()
    session.signIn('ghost')
    expect(session.session.userId).toBe(null)
  })
})

describe('orders store: estimate and loadLive', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('refreshEstimate fills the estimate from the server when the cart has lines', async () => {
    seedCatalog()
    const ui = useUiStore()
    const orders = useOrdersStore()
    ui.openItem('m1'); ui.toggleOption('o1'); ui.addToCart()
    await orders.refreshEstimate()
    expect(ui.ui.student.estimate).toEqual({ readyAt: 123, minutes: 7 })
  })

  it('refreshEstimate clears the estimate when the cart is empty', async () => {
    seedCatalog()
    const orders = useOrdersStore()
    const ui = useUiStore()
    ui.ui.student.estimate = { minutes: 1 }
    await orders.refreshEstimate()
    expect(ui.ui.student.estimate).toBe(null)
  })

  it('loadLive loads wait times for a signed-in student', async () => {
    seedCatalog()
    const session = useSessionStore()
    const orders = useOrdersStore()
    session.signIn('stu')
    await orders.loadLive()
    expect(orders.waits.slots).toBe(2)
  })
})

describe('shim: S/Q/A are backed by the stores', () => {
  it('S/Q/A reflect store state and actions', async () => {
    // The shim binds its stores to the shared pinia instance (stores/pinia.js),
    // which it activates on import. Use that same instance here so the stores the
    // shim uses are the stores we seed.
    const { default: pinia } = await import('@/stores/pinia.js')
    setActivePinia(pinia)
    const catalog = useCatalogStore()
    catalog.db.stores = [{ id: 's1', venue_id: 'v1', merchant_id: 'mer', name: 'Bento Bar', is_open: true }]
    catalog.db.profiles = [{ id: 'stu', role: 'student', name: 'Aiden Tan', status: 'active' }]
    catalog.decorateStores()

    const mod = await import('@/stores/compat.js')
    const { S, Q, A } = mod
    expect(Q.store('s1').name).toBe('Bento Bar')
    A.signIn('stu')
    expect(S.session.userId).toBe('stu')
    expect(Q.me().name).toBe('Aiden Tan')
    expect(S.db.stores).toHaveLength(1)
    A.setTab('me')
    expect(S.ui.student.tab).toBe('me')
  })
})
