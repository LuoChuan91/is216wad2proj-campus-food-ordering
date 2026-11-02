// Integration test for the poll-diff notification engine in
// composables/useAppBootstrap.js (announceChanges). It snapshots the signed-in
// user's orders/jobs and, on the next call, emits notifications for the status
// changes it sees. We drive two snapshots by mutating orders.db between calls and
// assert the notifications pushed into the store, including the "nothing on first
// look" contract.
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
    myJobs: vi.fn().mockResolvedValue([]),
    openJobs: vi.fn().mockResolvedValue([]),
    expiredJobs: vi.fn().mockResolvedValue([]),
  },
  setActor: vi.fn(),
}))
vi.mock('@/common/supabase.js', () => ({ default: null }))

import { announceChanges, useAppBootstrap } from '../useAppBootstrap.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useSessionStore } from '@/stores/session.js'
import { useNotificationsStore } from '@/stores/notifications.js'
import { seedCatalog } from '@/stores/__tests__/fixtures.js'

// Find a pushed notification by a substring of its title.
const byTitle = (notes, frag) => notes.items.find((n) => n.title.includes(frag))

describe('announceChanges (poll-diff notifications)', () => {
  let orders, notes
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useAppBootstrap().resetSnapshot()
    seedCatalog()
    useSessionStore().signIn('stu')
    orders = useOrdersStore()
    notes = useNotificationsStore()
  })

  it('announces nothing on the first look after signing in', () => {
    orders.db.orders = [{ id: 'o1', store_id: 's1', status: 'paid', delivery: null }]
    announceChanges() // first snapshot
    expect(notes.items).toHaveLength(0)
  })

  it('announces the cooking line when an order moves paid -> preparing', () => {
    orders.db.orders = [{ id: 'o1', store_id: 's1', code: 'E287', status: 'paid', delivery: null }]
    announceChanges() // snapshot 1: paid
    orders.db.orders[0].status = 'preparing'
    announceChanges() // snapshot 2: preparing
    expect(byTitle(notes, 'Order submitted')).toBeTruthy()
  })

  it('announces "ready" when an order becomes ready', () => {
    orders.db.orders = [{ id: 'o1', store_id: 's1', code: 'E287', type: 'pickup', status: 'preparing', delivery: null }]
    announceChanges()
    orders.db.orders[0].status = 'ready'
    announceChanges()
    expect(byTitle(notes, 'Your food is ready')).toBeTruthy()
  })

  it('announces delivery status changes (accepted -> picked_up -> delivered)', () => {
    const base = { id: 'o1', store_id: 's1', code: 'E287', type: 'delivery', status: 'ready' }
    orders.db.orders = [{ ...base, delivery: { status: 'accepted', destination_id: 'd1', courier_name: 'Mingli Tan' } }]
    announceChanges() // snapshot with accepted
    orders.db.orders[0].delivery.status = 'picked_up'
    announceChanges()
    expect(byTitle(notes, 'on the way')).toBeTruthy()
    orders.db.orders[0].delivery.status = 'delivered'
    announceChanges()
    expect(byTitle(notes, 'Delivered')).toBeTruthy()
  })

  it('announces the switch-to-pickup when an order falls back', () => {
    orders.db.orders = [{ id: 'o1', store_id: 's1', code: 'E287', type: 'delivery', status: 'ready', fallback: false, delivery: { status: 'accepted', destination_id: 'd1' } }]
    announceChanges()
    orders.db.orders[0].fallback = true
    announceChanges()
    expect(byTitle(notes, 'Switched to pickup')).toBeTruthy()
  })

  it('announces account approval when the student becomes active', () => {
    const catalog = useCatalogStore()
    catalog.user('stu').status = 'inactive'
    orders.db.orders = []
    announceChanges()
    catalog.user('stu').status = 'active'
    announceChanges()
    expect(byTitle(notes, 'Account approved')).toBeTruthy()
  })

  it('announces a new delivery job for an available courier', () => {
    const ui = useUiStore()
    ui.courierOn = true
    orders.db.jobs = []
    announceChanges() // snapshot 1: no jobs, courier on
    orders.db.jobs = [{ id: 'j1', pickup_store_id: 's1', destination_id: 'd1', order: { student_id: 'stu2' } }]
    announceChanges()
    expect(byTitle(notes, 'New delivery job')).toBeTruthy()
  })
})
