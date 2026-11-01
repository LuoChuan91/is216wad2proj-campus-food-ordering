import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useNotificationsStore } from '@/stores/notifications.js'

// ui.notify() mirrors poll-derived notifications into the shared notifications
// store (bell panel + toaster). Duplicates are prevented by content-based
// de-duplication in the store (not by a realtime-connected flag): an event that
// also arrives via the realtime channel is collapsed because both paths share
// the same dedup key (kind|status|orderId|title). These tests drive the mirror
// via ui.notify() and the realtime path via notes.receive().
describe('ui.notify -> notifications store mirror (content de-duplicated)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers() // notify() schedules a toast auto-dismiss
  })

  it('mirrors a plain (non-status) notification', () => {
    const ui = useUiStore()
    const notes = useNotificationsStore()
    ui.notify('T', 'B', 'ok') // no meta
    expect(notes.items).toHaveLength(1)
    expect(notes.items[0]).toMatchObject({ title: 'T', body: 'B', variant: 'success', read: false })
    expect(notes.toasts).toHaveLength(1)
  })

  it('mirrors a realtime-owned event when it has NOT already arrived via realtime (nothing lost)', () => {
    const notes = useNotificationsStore()
    const ui = useUiStore()
    ui.notify('T', 'B', 'ok', { kind: 'order', status: 'ready', order_id: 'o1' })
    expect(notes.items).toHaveLength(1)
    expect(notes.toasts).toHaveLength(1)
  })

  it('COLLAPSES the mirror copy when the same event already arrived via realtime (no duplicate)', () => {
    const notes = useNotificationsStore()
    const ui = useUiStore()
    // Realtime delivers the event first...
    notes.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    expect(notes.items).toHaveLength(1)
    // ...then the poll-diff mirror tries to add the same event — dropped.
    ui.notify('Order #E1 is ready', 'Collect it now', 'ok', { kind: 'order', status: 'ready', order_id: 'o1' })
    expect(notes.items).toHaveLength(1)
    expect(notes.toasts).toHaveLength(1)
  })

  it('COLLAPSES the realtime copy when the mirror added the event first (no duplicate, either order)', () => {
    const notes = useNotificationsStore()
    const ui = useUiStore()
    ui.notify('T', 'B', 'ok', { kind: 'delivery', status: 'accepted', order_id: 'o2' })
    expect(notes.items).toHaveLength(1)
    const dup = notes.receive({ kind: 'delivery', status: 'accepted', order_id: 'o2' })
    expect(dup).toBeNull()
    expect(notes.items).toHaveLength(1)
  })

  it('does NOT collapse distinct events (different order / status)', () => {
    const notes = useNotificationsStore()
    const ui = useUiStore()
    ui.notify('T', 'B', 'ok', { kind: 'order', status: 'ready', order_id: 'o1' })
    ui.notify('T', 'B', 'ok', { kind: 'order', status: 'ready', order_id: 'o2' })
    expect(notes.items).toHaveLength(2)
  })
})
