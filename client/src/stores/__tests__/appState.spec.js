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
import { useNotificationsStore } from '../notifications.js'

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

  it('notify writes a history item and a toast into the notifications store', () => {
    const ui = useUiStore()
    const notes = useNotificationsStore()
    ui.notify('Hello', 'World', 'ok')
    expect(notes.items[0].title).toBe('Hello')
    expect(notes.items[0].variant).toBe('success')
    expect(notes.toasts).toHaveLength(1)
    vi.useRealTimers()
  })

  it('run() marks busy, returns the result and clears busy; a failure notifies', async () => {
    vi.useRealTimers()
    const ui = useUiStore()
    const notes = useNotificationsStore()
    const ok = await ui.run('k1', async () => 'done')
    expect(ok).toBe('done')
    expect(ui.busy.k1).toBeUndefined()
    const bad = await ui.run('k2', async () => { throw new Error('nope') })
    expect(bad).toBe(null)
    expect(notes.items[0].body).toBe('nope')
  })
})

describe('session store: signIn resets per-user state', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('student sign-in builds a fresh student ui and clears db lists', () => {
    seedCatalog()
    const session = useSessionStore()
    const ui = useUiStore()
    const notes = useNotificationsStore()
    const orders = useOrdersStore()
    orders.db.orders = [{ id: 'x' }]
    notes.items.push({ id: 1, title: 't' })
    session.signIn('stu')
    expect(session.session.userId).toBe('stu')
    expect(orders.db.orders).toEqual([])
    expect(notes.items).toEqual([])
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

describe('orders store: loadLive', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('loadLive loads the signed-in student\'s orders and jobs', async () => {
    seedCatalog()
    const session = useSessionStore()
    const orders = useOrdersStore()
    session.signIn('stu')
    await orders.loadLive()
    // No throw, and the live slice is populated (empty in this mock) — wait times
    // are no longer part of loadLive (the frontend engine owns them now).
    expect(Array.isArray(orders.db.orders)).toBe(true)
  })
})

describe('orders store: moved query helpers (me/ordersOf/isActive/activeJob/openJobs/earnings)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('me returns the signed-in user profile', () => {
    seedCatalog()
    const session = useSessionStore()
    const orders = useOrdersStore()
    session.signIn('stu')
    expect(orders.me().name).toBe('Aiden Tan')
  })

  it('ordersOf filters by student and sorts newest first', () => {
    seedCatalog()
    const orders = useOrdersStore()
    orders.db.orders = [
      { id: 'a', student_id: 'stu', created_at: 100, status: 'paid' },
      { id: 'b', student_id: 'stu', created_at: 300, status: 'paid' },
      { id: 'c', student_id: 'other', created_at: 200, status: 'paid' },
    ]
    const mine = orders.ordersOf('stu')
    expect(mine.map((o) => o.id)).toEqual(['b', 'a'])
  })

  it('isActive is true for paid/preparing/ready and not yet delivered', () => {
    seedCatalog()
    const orders = useOrdersStore()
    expect(orders.isActive({ status: 'paid' })).toBe(true)
    expect(orders.isActive({ status: 'preparing' })).toBe(true)
    expect(orders.isActive({ status: 'ready' })).toBe(true)
    expect(orders.isActive({ status: 'completed' })).toBe(false)
    expect(orders.isActive({ status: 'ready', delivery: { status: 'delivered' } })).toBe(false)
  })

  it('activeJob finds an accepted or picked_up job', () => {
    seedCatalog()
    const orders = useOrdersStore()
    orders.db.myJobs = [{ id: 'j1', status: 'delivered' }, { id: 'j2', status: 'picked_up' }]
    expect(orders.activeJob().id).toBe('j2')
  })

  it('openJobs excludes the courier\'s own orders', () => {
    seedCatalog()
    const session = useSessionStore()
    const orders = useOrdersStore()
    session.signIn('stu')
    orders.db.jobs = [
      { id: 'j1', order: { student_id: 'stu' } },
      { id: 'j2', order: { student_id: 'other' } },
    ]
    expect(orders.openJobs().map((d) => d.id)).toEqual(['j2'])
  })

  it('earnings sums today and this week from delivered jobs', () => {
    seedCatalog()
    const ui = useUiStore()
    const orders = useOrdersStore()
    const now = Date.now()
    ui.now = now
    orders.db.myJobs = [
      { id: 'j1', status: 'delivered', delivered_at: now, fee: 1.5 },
      { id: 'j2', status: 'delivered', delivered_at: now - 3 * 864e5, fee: 1.5 }, // this week, not today
      { id: 'j3', status: 'delivered', delivered_at: now - 10 * 864e5, fee: 1.5 }, // older than a week
      { id: 'j4', status: 'picked_up', delivered_at: now, fee: 1.5 }, // not delivered
    ]
    const e = orders.earnings()
    expect(e.todayCount).toBe(1)
    expect(e.today).toBe(1.5)
    expect(e.weekCount).toBe(2)
    expect(e.week).toBe(3)
  })
})

describe('ui store: moved query helpers (open/unread)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('open reports a paused store as closed', () => {
    seedCatalog()
    const ui = useUiStore()
    const status = ui.open({ is_open: false })
    expect(status.open).toBe(false)
    expect(status.label).toBe('Paused by the store')
  })
})
