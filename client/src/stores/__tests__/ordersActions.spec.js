// Store unit tests for the action flows in stores/orders.js: merchant order
// transitions, courier job actions, admin student status, availability toggle and
// the addVenue validation. The api is mocked; we assert the server call, the
// local update, the busy-guard clearing, and the error-toast behaviour of run().
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

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
    setOrderStatus: vi.fn(),
    delivery: vi.fn(),
    setProfileStatus: vi.fn(),
    addVenue: vi.fn(),
  },
  setActor: vi.fn(),
}))

import { api } from '@/services/api.js'
import { useOrdersStore } from '../orders.js'
import { useUiStore } from '../ui.js'
import { useSessionStore } from '../session.js'
import { useCatalogStore } from '../catalog.js'
import { useNotificationsStore } from '../notifications.js'
import { seedCatalog } from './fixtures.js'

describe('orders store: merchant order transitions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    seedCatalog()
  })

  it('markReady patches the order and updates the local row', async () => {
    const orders = useOrdersStore()
    orders.db.orders = [{ id: 'o1', store_id: 's1', status: 'preparing' }]
    api.setOrderStatus.mockResolvedValue({ id: 'o1', store_id: 's1', status: 'ready', order_items: [] })

    await orders.markReady('o1')

    expect(api.setOrderStatus).toHaveBeenCalledWith('o1', 'ready')
    expect(orders.order('o1').status).toBe('ready')
  })

  it('a failed transition surfaces a notification and clears the busy flag', async () => {
    const orders = useOrdersStore()
    const notes = useNotificationsStore()
    const ui = useUiStore()
    orders.db.orders = [{ id: 'o1', store_id: 's1', status: 'preparing' }]
    api.setOrderStatus.mockRejectedValue(new Error('server said no'))

    await orders.markReady('o1')

    expect(notes.items[0].body).toBe('server said no')
    expect(ui.busy.o1).toBeUndefined()
    expect(orders.order('o1').status).toBe('preparing') // unchanged
  })
})

describe('orders store: courier actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    seedCatalog()
  })

  it('acceptJob calls delivery with the actor id and reloads', async () => {
    const orders = useOrdersStore()
    const session = useSessionStore()
    session.signIn('stu')
    api.delivery.mockResolvedValue({ id: 'j1' })

    await orders.acceptJob('j1')

    expect(api.delivery).toHaveBeenCalledWith('j1', 'accept', 'stu')
  })

  it('pickUp and deliver pass the matching action', async () => {
    const orders = useOrdersStore()
    const session = useSessionStore()
    session.signIn('stu')
    api.delivery.mockResolvedValue({ id: 'j1' })

    await orders.pickUp('j1')
    expect(api.delivery).toHaveBeenLastCalledWith('j1', 'pickup', 'stu')
    await orders.deliver('j1')
    expect(api.delivery).toHaveBeenLastCalledWith('j1', 'deliver', 'stu')
  })

  it('setAvailable toggles courierOn and persists the courier flag', () => {
    const orders = useOrdersStore()
    const ui = useUiStore()
    const session = useSessionStore()
    session.signIn('stu')
    orders.setAvailable(true)
    expect(ui.courierOn).toBe(true)
    expect(session._loadCourier('stu')).toBe(true)
    orders.setAvailable(false)
    expect(ui.courierOn).toBe(false)
  })
})

describe('orders store: admin student status', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    seedCatalog()
  })

  it('approveStudent patches the profile and merges the result into the catalog', async () => {
    const orders = useOrdersStore()
    const catalog = useCatalogStore()
    api.setProfileStatus.mockResolvedValue({ id: 'stu', status: 'active' })
    catalog.user('stu').status = 'inactive'

    await orders.approveStudent('stu')

    expect(api.setProfileStatus).toHaveBeenCalledWith('stu', 'active')
    expect(catalog.user('stu').status).toBe('active')
  })

  it('blockStudent and removeStudent send the matching status', async () => {
    const orders = useOrdersStore()
    api.setProfileStatus.mockResolvedValue({ id: 'stu', status: 'blocked' })
    await orders.blockStudent('stu')
    expect(api.setProfileStatus).toHaveBeenLastCalledWith('stu', 'blocked')
    api.setProfileStatus.mockResolvedValue({ id: 'stu', status: 'removed' })
    await orders.removeStudent('stu')
    expect(api.setProfileStatus).toHaveBeenLastCalledWith('stu', 'removed')
  })
})

describe('orders store: addVenue validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    seedCatalog()
  })

  function draft(ui, { name = 'New Venue', lat = '1.30', lng = '103.85' } = {}) {
    ui.ui.staff.venueDraft = { name, lat, lng }
  }

  it('rejects an empty name without calling the server', async () => {
    const orders = useOrdersStore()
    const ui = useUiStore()
    draft(ui, { name: '  ' })
    await orders.addVenue()
    expect(ui.ui.staff.formError).toMatch(/name/i)
    expect(api.addVenue).not.toHaveBeenCalled()
  })

  it('rejects a pin outside Singapore', async () => {
    const orders = useOrdersStore()
    const ui = useUiStore()
    draft(ui, { lat: '48.85', lng: '2.35' }) // Paris
    await orders.addVenue()
    expect(ui.ui.staff.formError).toMatch(/Singapore/i)
    expect(api.addVenue).not.toHaveBeenCalled()
  })

  it('saves a valid venue and pushes it into the catalog, resetting the draft', async () => {
    const orders = useOrdersStore()
    const ui = useUiStore()
    const catalog = useCatalogStore()
    draft(ui, { name: 'LKS Steps', lat: '1.2966', lng: '103.85' })
    api.addVenue.mockResolvedValue({ id: 'v2', name: 'LKS Steps', lat: 1.2966, lng: 103.85, type: 'eatery' })

    await orders.addVenue()

    expect(api.addVenue).toHaveBeenCalledWith({ name: 'LKS Steps', lat: 1.2966, lng: 103.85, type: 'eatery' })
    expect(catalog.venue('v2')).toBeTruthy()
    expect(ui.ui.staff.venueDraft).toEqual({ name: '', lat: '', lng: '' })
    expect(ui.ui.staff.saving).toBe(false)
  })
})
