// Mount test for the merchant orders flow.
//
// The merchant order board and its realtime layer were split (per the migration) into
// a shell (MerchantView: rail + header + useStoreOrdersLive + the "Updates: Live/
// Polling" chip) and a body (MerchantOrdersView: the New/Cooking/Ready columns). This
// test mounts the shell so the realtime usage is exercised exactly as it ships: it
// mocks useStoreOrdersLive to control liveConnected, mocks the router (so the shell's
// <RouterView> renders the orders body), and asserts the chip + the board together.
//
// CRITICAL coverage: the "Live/Polling" chip is driven by useStoreOrdersLive's
// liveConnected — the realtime signal must survive the split.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, h } from 'vue'

vi.mock('@/common/supabase.js', () => ({ default: null }))

// The frontend wait engine fetches the queue; stub it so the board's per-order
// estimates are offline + deterministic.
vi.mock('@/utils/waitTimeApi.js', () => ({
  fetchQueue: vi.fn().mockResolvedValue({
    orderItems: [{ menu_item_id: 'm1', qty: 1 }],
    cookingDetails: [{ id: 'm1', cook_time_sec: 60, max_at_once: 2 }],
    ahead: 1,
  }),
}))

// Control the merchant live layer. The spy is created in a hoisted block (so it exists
// before the hoisted vi.mock factory runs); the ref it returns is assigned in beforeEach,
// where Vue's ref() is available.
const { useStoreOrdersLive } = vi.hoisted(() => ({ useStoreOrdersLive: vi.fn() }))
vi.mock('@/composables/useStoreOrdersLive.js', () => ({ useStoreOrdersLive }))
// The shell calls refresh() inside the composable's fetchOrders; stub it out.
vi.mock('@/composables/useAppBootstrap.js', () => ({ refresh: vi.fn().mockResolvedValue() }))

const live = { liveConnected: ref(true) }

import { setActivePinia } from 'pinia'
import pinia from '@/stores/pinia.js'
import { useSessionStore } from '@/stores/session.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import Icon from '@/components/icons/Icon.vue'
import Mono from '@/components/icons/Mono.vue'
import MerchantOrdersView from '../MerchantOrdersView.vue'
import MerchantView from '../MerchantView.vue'
import { _resetStoreWaitCache } from '@/composables/storeWaitCache.js'

// A minimal <RouterView> stub that renders the orders body (what #/merchant resolves
// to), wiring the shell's provide() to the body's inject(). A render function (not a
// template) avoids the stub's own name re-resolving to the RouterView stub.
const RouterViewStub = { name: 'RouterViewStub', render: () => h(MerchantOrdersView) }
const globalCfg = { global: { components: { Icon, Mono, RouterView: RouterViewStub } } }

function seed() {
  setActivePinia(pinia)
  const catalog = useCatalogStore()
  catalog.db.profiles = [{ id: 'mer', role: 'merchant', name: 'Mei Lin', status: 'active', email: 'mei@smu.edu' }]
  catalog.db.venues = [{ id: 'v1', name: 'SMU Labs', lat: 1.2966, lng: 103.85, address: 'Level 1' }]
  catalog.db.stores = [{ id: 's1', venue_id: 'v1', merchant_id: 'mer', name: 'Bento Bar', is_open: true, description: '' }]
  catalog.db.menu = [{ id: 'm1', store_id: 's1', category: 'Bento', name: 'Chicken Teriyaki', price: 6, available: true, cook_time_sec: 60, max_at_once: 2, option_groups: [] }]
  catalog.decorateStores()

  const session = useSessionStore()
  session.signIn('mer') // selects s1 as the merchant store (also clears per-user db lists)

  const orders = useOrdersStore()
  orders.db.orders = [
    { id: 'o1', code: 'E287', status: 'paid', type: 'pickup', store_id: 's1', student_name: 'Aiden Tan', created_at: Date.now(), items: [{ id: 'oi1', menu_item_id: 'm1', name: 'Chicken Teriyaki', qty: 1, option_names: [] }], delivery: null },
    { id: 'o2', code: 'E288', status: 'preparing', type: 'pickup', store_id: 's1', student_name: 'Bea Lim', created_at: Date.now(), items: [{ id: 'oi2', menu_item_id: 'm1', name: 'Chicken Teriyaki', qty: 2, option_names: [] }], delivery: null },
  ]
  return { catalog, orders, session }
}

describe('MerchantOrdersView (via the MerchantView shell)', () => {
  beforeEach(() => {
    _resetStoreWaitCache()
    useStoreOrdersLive.mockReset()
    useStoreOrdersLive.mockReturnValue(live)
    live.liveConnected.value = true
    seed()
  })

  it('subscribes to the store via useStoreOrdersLive', async () => {
    mount(MerchantView, globalCfg)
    await flushPromises()
    expect(useStoreOrdersLive).toHaveBeenCalled()
  })

  it('shows the Live chip when realtime is connected', async () => {
    const wrapper = mount(MerchantView, globalCfg)
    await flushPromises()
    expect(wrapper.text()).toContain('Live')
    expect(wrapper.text()).not.toContain('Polling')
  })

  it('shows the Polling chip when realtime is not connected', async () => {
    live.liveConnected.value = false
    const wrapper = mount(MerchantView, globalCfg)
    await flushPromises()
    expect(wrapper.text()).toContain('Polling')
  })

  it('renders the order board columns with this store\'s orders', async () => {
    const wrapper = mount(MerchantView, globalCfg)
    await flushPromises()
    expect(wrapper.text()).toContain('New')
    expect(wrapper.text()).toContain('Cooking')
    expect(wrapper.text()).toContain('Ready')
    expect(wrapper.text()).toContain('E287') // the paid order in New
    expect(wrapper.text()).toContain('E288') // the preparing order in Cooking
  })

  it('MerchantOrdersView body renders standalone with injected store', async () => {
    const { catalog } = seed()
    const storeRef = ref(catalog.store('s1'))
    const wrapper = mount(MerchantOrdersView, {
      global: {
        components: { Icon, Mono },
        provide: { merchantStore: storeRef, merchantGone: () => false },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('New')
    expect(wrapper.text()).toContain('E287')
  })
})
