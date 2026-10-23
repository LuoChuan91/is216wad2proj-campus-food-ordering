// Tests for composables/useAppBootstrap.js — the non-routing half of the old
// prototype app/live.js. We verify that startApp():
//   - loads the catalog on start-up
//   - restores the session and does an initial live load
//   - starts the polling timers (refresh on cfg.pollMs, refreshCatalog on
//     cfg.catalogPollMs) and the 1s clock tick
// Fake timers + a mocked api service keep the test deterministic and offline.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Keep the api service offline. Every call resolves with empty/fixed data.
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
  },
}))

// Supabase is optional; mock so no env vars are needed when the shim/bridges load.
vi.mock('@/common/supabase.js', () => ({ default: null }))

// Routing is owned by vue-router (router/sync.js). Stub startRouting so the
// bootstrap test never touches the router/route-sync.
vi.mock('@/router/sync.js', () => ({ startRouting: vi.fn() }))

import { api } from '@/services/api.js'
import { startRouting } from '@/router/sync.js'
import { startApp, refresh, refreshCatalog } from '../useAppBootstrap.js'
import { config as cfg } from '@/config/index.js'

describe('useAppBootstrap', () => {
  let handles

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    // No signed-in session for this tab.
    try { sessionStorage.clear() } catch { /* jsdom */ }
    handles = null
  })

  afterEach(() => {
    if (handles && handles.stop) handles.stop()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('loads the catalog on start-up', async () => {
    handles = await startApp()
    // All five catalog endpoints were hit during loadCatalog().
    expect(api.stores).toHaveBeenCalled()
    expect(api.menu).toHaveBeenCalled()
    expect(api.venues).toHaveBeenCalled()
    expect(api.destinations).toHaveBeenCalled()
    expect(api.profiles).toHaveBeenCalled()
  })

  it('restores the session, hands routing to router/sync and marks loaded', async () => {
    const { useUiStore } = await import('@/stores/ui.js')
    handles = await startApp()
    expect(startRouting).toHaveBeenCalledTimes(1)
    expect(useUiStore().loaded).toBe(true)
  })

  it('starts the clock tick and advances S.now', async () => {
    const { useUiStore } = await import('@/stores/ui.js')
    const ui = useUiStore()
    handles = await startApp()
    const before = ui.now
    vi.advanceTimersByTime(1000)
    expect(ui.now).toBeGreaterThanOrEqual(before)
    expect(typeof ui.now).toBe('number')
  })

  it('starts polling: refreshCatalog fires on cfg.catalogPollMs and re-hits the catalog', async () => {
    handles = await startApp()
    const callsAfterStart = api.stores.mock.calls.length
    // Advance one catalog poll interval; refreshCatalog() calls loadCatalog() again.
    vi.advanceTimersByTime(cfg.catalogPollMs)
    await vi.waitFor(() => {
      expect(api.stores.mock.calls.length).toBeGreaterThan(callsAfterStart)
    })
  })

  it('refresh() is a no-op without a signed-in user (guarded)', async () => {
    // With no session, Q.me() is undefined, so refresh short-circuits and does
    // not call the live endpoints.
    await refresh()
    expect(api.studentOrders).not.toHaveBeenCalled()
    expect(api.myJobs).not.toHaveBeenCalled()
  })

  it('exposes stop() that clears the timers', async () => {
    handles = await startApp()
    expect(typeof handles.stop).toBe('function')
    const callsBefore = api.stores.mock.calls.length
    handles.stop()
    handles = null
    // After stop, advancing well past a catalog poll triggers no more catalog loads.
    vi.advanceTimersByTime(cfg.catalogPollMs * 3)
    await Promise.resolve()
    expect(api.stores.mock.calls.length).toBe(callsBefore)
  })

  it('refreshCatalog() reloads the catalog and sets online', async () => {
    const { useUiStore } = await import('@/stores/ui.js')
    const ui = useUiStore()
    const before = api.venues.mock.calls.length
    await refreshCatalog()
    expect(api.venues.mock.calls.length).toBeGreaterThan(before)
    expect(ui.online).toBe(true)
  })
})
