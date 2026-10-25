import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useNotificationsStore } from '@/stores/notifications.js'

// ui.notify() mirrors poll-derived notifications into the shared notifications
// store (bell panel + toaster), with the realtime-dedup rule. This used to live
// in a separate notifyBridge module; it is now inlined in the ui store, so these
// tests drive ui.notify() directly.
describe('ui.notify -> notifications store mirror (inlined, fallback-aware)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers() // notify() schedules a toast auto-dismiss
  })

  it('mirrors a plain (non-status) notification regardless of realtime state', () => {
    const ui = useUiStore()
    const notes = useNotificationsStore()
    notes.setRealtimeConnected(true)
    ui.notify('T', 'B', 'ok') // no meta
    expect(notes.items).toHaveLength(1)
    expect(notes.items[0]).toMatchObject({ title: 'T', body: 'B', variant: 'success', read: false })
    expect(notes.toasts).toHaveLength(1)
  })

  it('SKIPS a realtime-owned (meta.kind) event when realtime is CONNECTED (no duplicate)', () => {
    const ui = useUiStore()
    const notes = useNotificationsStore()
    notes.setRealtimeConnected(true)
    ui.notify('T', 'B', 'ok', { kind: 'delivery', status: 'expired', order_id: 'o1' })
    expect(notes.items).toHaveLength(0)
    expect(notes.toasts).toHaveLength(0)
  })

  it('MIRRORS a realtime-owned event when realtime is DISCONNECTED (fallback, nothing lost)', () => {
    const ui = useUiStore()
    const notes = useNotificationsStore()
    notes.setRealtimeConnected(false)
    ui.notify('T', 'B', 'ok', { kind: 'order', status: 'ready', order_id: 'o1' })
    expect(notes.items).toHaveLength(1)
    expect(notes.toasts).toHaveLength(1)
  })
})
