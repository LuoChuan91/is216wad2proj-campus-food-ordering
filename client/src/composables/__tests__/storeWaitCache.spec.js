// Unit test for composables/storeWaitCache.js — the module-level, ref-counted
// shared wait engine. We verify that multiple acquires of the same store share a
// single realtime subscription, that the shared reactive entry updates on load,
// and that the channel is torn down only when the last caller releases.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/common/supabase.js', () => ({ default: null }))
vi.mock('@/utils/waitTimeApi.js', () => ({
  fetchQueue: vi.fn().mockResolvedValue({
    orderItems: [{ menu_item_id: 'burger', qty: 2 }],
    cookingDetails: [{ id: 'burger', cook_time_sec: 60, max_at_once: 2 }],
    ahead: 4,
  }),
}))

import { fetchQueue } from '@/utils/waitTimeApi.js'
import { acquireStoreWait, releaseStoreWait, peekStoreWait, _resetStoreWaitCache } from '../storeWaitCache.js'

const flush = () => new Promise((r) => setTimeout(r, 0))

function makeFakeClient() {
  const state = { topic: null, removed: 0, subscribed: 0 }
  const channel = {
    on() { return channel },
    subscribe(cb) { state.subscribed++; cb && cb('SUBSCRIBED'); return channel },
  }
  const client = {
    channel: vi.fn((topic) => { state.topic = topic; return channel }),
    removeChannel: vi.fn(() => { state.removed++ }),
  }
  return { client, state }
}

describe('storeWaitCache', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    _resetStoreWaitCache()
    fetchQueue.mockClear()
  })
  afterEach(() => _resetStoreWaitCache())

  it('loads and exposes a reactive entry for a store', async () => {
    const { client } = makeFakeClient()
    const entry = acquireStoreWait('s1', null, client)
    expect(entry.loading).toBe(true)
    await flush()
    expect(entry.seconds).toBe(60) // 2 burgers batch 2 -> 1 batch * 60
    expect(entry.ahead).toBe(4)
    expect(entry.loading).toBe(false)
    expect(client.channel).toHaveBeenCalledWith('store:s1')
    releaseStoreWait('s1', null, client)
  })

  it('shares ONE subscription across multiple acquires of the same store', async () => {
    const { client, state } = makeFakeClient()
    const a = acquireStoreWait('s1', null, client)
    const b = acquireStoreWait('s1', null, client)
    await flush()
    expect(a).toBe(b) // same reactive entry
    expect(client.channel).toHaveBeenCalledTimes(1) // only one engine started
    expect(state.subscribed).toBe(1)
    releaseStoreWait('s1', null, client)
    releaseStoreWait('s1', null, client)
  })

  it('tears the engine down only when the last caller releases', async () => {
    const { client } = makeFakeClient()
    acquireStoreWait('s1', null, client)
    acquireStoreWait('s1', null, client)
    await flush()

    releaseStoreWait('s1', null, client)
    expect(client.removeChannel).not.toHaveBeenCalled() // one caller still holds it
    expect(peekStoreWait('s1')).toBeTruthy()

    releaseStoreWait('s1', null, client)
    expect(client.removeChannel).toHaveBeenCalledTimes(1) // last release tears down
    expect(peekStoreWait('s1')).toBeUndefined()
  })

  it('keys separate entries by store + order id', async () => {
    const { client } = makeFakeClient()
    acquireStoreWait('s1', null, client)
    acquireStoreWait('s1', 'o9', client)
    await flush()
    expect(client.channel).toHaveBeenCalledTimes(2) // two distinct engines
    releaseStoreWait('s1', null, client)
    releaseStoreWait('s1', 'o9', client)
  })
})
