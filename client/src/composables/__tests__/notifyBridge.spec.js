import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mirrorNotification } from '../notifyBridge.js'
import { useNotificationsStore } from '@/stores/notifications.js'

const appNote = (meta) => [{ title: 'T', body: 'B', tone: 'ok', created_at: Date.now() }, meta]

describe('notifyBridge.mirrorNotification (fallback-aware)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('mirrors a plain (non-status) notification regardless of realtime state', () => {
    const store = useNotificationsStore()
    store.setRealtimeConnected(true)
    mirrorNotification(...appNote(null))
    expect(store.items).toHaveLength(1)
    expect(store.toasts).toHaveLength(1)
  })

  it('SKIPS a realtime-owned (meta.kind) event when realtime is CONNECTED (no duplicate)', () => {
    const store = useNotificationsStore()
    store.setRealtimeConnected(true)
    mirrorNotification(...appNote({ kind: 'delivery', status: 'expired', order_id: 'o1' }))
    expect(store.items).toHaveLength(0)
    expect(store.toasts).toHaveLength(0)
  })

  it('MIRRORS a realtime-owned event when realtime is DISCONNECTED (fallback, nothing lost)', () => {
    const store = useNotificationsStore()
    store.setRealtimeConnected(false)
    mirrorNotification(...appNote({ kind: 'order', status: 'ready', order_id: 'o1' }))
    expect(store.items).toHaveLength(1)
    expect(store.toasts).toHaveLength(1)
  })
})
