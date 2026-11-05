import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api.js', () => ({
  api: {},
  setActor: vi.fn(),
}))

import { useUiStore } from '../ui.js'
import { useSessionStore } from '../session.js'
import { useCatalogStore } from '../catalog.js'
import { seedCatalog } from './fixtures.js'

const ORDER = {
  id: 'old-1', store_id: 's1', store_name: 'Bento Bar', created_at: '2026-11-01T04:00:00Z',
  items: [
    { menu_item_id: 'm1', name: 'Chicken Teriyaki', qty: 2, selected_options: ['o2', 'o3'], option_names: ['Brown Rice', 'Tamago'] },
  ],
}

describe('ui store: order again', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T12:00:00+08:00'))
    setActivePinia(createPinia())
    const catalog = seedCatalog()
    const allDay = ['00:00', '23:59']
    catalog.db.stores[0].open_hours = { mon: allDay, tue: allDay, wed: allDay, thu: allDay, fri: allDay, sat: allDay, sun: allDay }
    useSessionStore().signIn('stu')
  })
  afterEach(() => vi.useRealTimers())

  it('fills the cart with the old order at today’s prices and opens checkout', () => {
    const ui = useUiStore()
    ui.reorder(ORDER)
    const u = ui.ui.student
    expect(u.page).toBe('checkout')
    expect(u.checkout.dropoffId).toBe('d1')
    expect(u.cart.storeId).toBe('s1')
    expect(u.cart.lines).toHaveLength(1)
    expect(u.cart.lines[0]).toMatchObject({ menu_item_id: 'm1', qty: 2, selected: ['o2', 'o3'], unit_price: 7.5 })
  })

  it('replaces whatever was in the cart, so checkout shows exactly that order', () => {
    const ui = useUiStore()
    ui.ui.student.cart = { storeId: 's1', lines: [{ key: 'x', menu_item_id: 'm1', qty: 1, selected: ['o1'], unit_price: 6 }] }
    ui.reorder(ORDER)
    expect(ui.ui.student.cart.lines.map((l) => l.qty)).toEqual([2])
  })

  it('leaves out items that are sold out but still goes to checkout with the rest', () => {
    const ui = useUiStore()
    const catalog = useCatalogStore()
    catalog.db.menu.push({ ...catalog.db.menu[0], id: 'm2', name: 'Gone', available: false })
    ui.reorder({ ...ORDER, items: [...ORDER.items, { menu_item_id: 'm2', qty: 1, selected_options: ['o1'] }] })
    expect(ui.ui.student.page).toBe('checkout')
    expect(ui.ui.student.cart.lines.map((l) => l.menu_item_id)).toEqual(['m1'])
  })

  it('stays put when nothing in the order can be bought any more', () => {
    const ui = useUiStore()
    useCatalogStore().db.menu[0].available = false
    ui.reorder(ORDER)
    expect(ui.ui.student.page).not.toBe('checkout')
    expect(ui.ui.student.cart.lines).toHaveLength(0)
  })

  it('stays put when the store is closed', () => {
    const ui = useUiStore()
    useCatalogStore().db.stores[0].is_open = false
    ui.reorder(ORDER)
    expect(ui.ui.student.page).not.toBe('checkout')
    expect(ui.ui.student.cart.lines).toHaveLength(0)
  })
})
