import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useNotificationsStore } from '@/stores/notifications.js'

// ui.notify() mirrors poll-derived notifications into the shared notifications
// store.
describe('ui.notify -> notifications store mirror', () => {
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

  it('mirrors a realtime-owned event when realtime is NOT connected (fallback, nothing lost)', () => {
    const notes = useNotificationsStore()
    const ui = useUiStore()
    notes.setRealtimeConnected(false)
    ui.notify('T', 'B', 'ok', { kind: 'order', status: 'ready', order_id: 'o1' })
    expect(notes.items).toHaveLength(1)
    expect(notes.toasts).toHaveLength(1)
  })

  it('SKIPS a realtime-owned event at the source while realtime is connected (no duplicate to collapse)', () => {
    const notes = useNotificationsStore()
    const ui = useUiStore()
    notes.setRealtimeConnected(true)
    // Realtime is the sole producer: the poll-diff copy is dropped before it's stored.
    const result = ui.notify('Order #E1 is ready', 'Collect it now', 'ok', { kind: 'order', status: 'ready', order_id: 'o1' })
    expect(result).toBeUndefined() // notifyView/notify return nothing; pushLocal returned null
    expect(notes.items).toHaveLength(0)
    expect(notes.toasts).toHaveLength(0)
    // ...and the realtime path still delivers it.
    notes.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    expect(notes.items).toHaveLength(1)
  })

  it('still lets PLAIN messages through while realtime is connected (no realtime twin)', () => {
    const notes = useNotificationsStore()
    const ui = useUiStore()
    notes.setRealtimeConnected(true)
    ui.notify('Account approved', 'You can now order food', 'ok') // no meta
    expect(notes.items).toHaveLength(1)
  })

  it('content-dedup guards the transition: a mirror copy collapses a just-received realtime event', () => {
    const notes = useNotificationsStore()
    const ui = useUiStore()
    // realtime disconnected (transition), but the event already arrived via receive()
    notes.receive({ kind: 'order', status: 'ready', order_id: 'o1' })
    expect(notes.items).toHaveLength(1)
    ui.notify('Order #E1 is ready', 'Collect it now', 'ok', { kind: 'order', status: 'ready', order_id: 'o1' })
    expect(notes.items).toHaveLength(1)
    expect(notes.toasts).toHaveLength(1)
  })

  it('does NOT collapse distinct events (different order / status)', () => {
    const notes = useNotificationsStore()
    const ui = useUiStore()
    ui.notify('T', 'B', 'ok', { kind: 'order', status: 'ready', order_id: 'o1' })
    ui.notify('T', 'B', 'ok', { kind: 'order', status: 'ready', order_id: 'o2' })
    expect(notes.items).toHaveLength(2)
  })
})
