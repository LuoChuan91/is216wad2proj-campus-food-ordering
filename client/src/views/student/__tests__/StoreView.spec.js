// Mount test for views/student/StoreView.vue.
//
// StoreView reads the store id from the route param (:storeId) — this test proves it
// renders the right store's hero + menu from that param, not from the ui store. The
// stores are backed by the shared Pinia instance (stores/pinia.js), so we seed that
// instance. vue-router's useRoute is mocked to control the param. The embedded
// WaitTimeEstimate's network/realtime deps are mocked so nothing hits Supabase.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

// No real Supabase client (keeps the import side-effect-free and poll-only).
vi.mock('@/common/supabase.js', () => ({ default: null }))
// WaitTimeEstimate's composable: return a steady estimate, no fetching.
vi.mock('@/composables/useWaitTime.js', () => ({
  useWaitTime: () => ({
    seconds: ref(300), loading: ref(false), error: ref(null), stale: ref(false), liveConnected: ref(true),
  }),
}))

// Controllable route param.
const route = { params: { storeId: 's1' } }
vi.mock('vue-router', () => ({ useRoute: () => route }))

import { setActivePinia } from 'pinia'
import pinia from '@/stores/pinia.js'
import { useCatalogStore } from '@/stores/catalog.js'
import Icon from '@/components/icons/Icon.vue'
import Mono from '@/components/icons/Mono.vue'
import AppMark from '@/components/icons/AppMark.vue'
import Avatar from '@/components/icons/Avatar.vue'
import WaitChip from '@/components/icons/WaitChip.vue'
import StoreView from '../StoreView.vue'

const globalCfg = { global: { components: { Icon, Mono, AppMark, Avatar, WaitChip } } }

function seed() {
  setActivePinia(pinia)
  const catalog = useCatalogStore()
  catalog.db.profiles = [{ id: 'mer', role: 'merchant', name: 'Mei Lin', status: 'active' }]
  catalog.db.venues = [{ id: 'v1', name: 'SMU Labs', lat: 1.2966, lng: 103.85, address: 'Level 1' }]
  catalog.db.stores = [{ id: 's1', venue_id: 'v1', merchant_id: 'mer', name: 'Bento Bar', is_open: true, description: 'Fresh bento', open_hours: null }]
  catalog.db.menu = [
    { id: 'm1', store_id: 's1', category: 'Bento', name: 'Chicken Teriyaki', price: 6, available: true, cook_time_sec: 60, max_at_once: 2, option_groups: [] },
  ]
  catalog.decorateStores()
  return catalog
}

describe('StoreView', () => {
  beforeEach(() => { seed() })

  it('renders the store named by the route param', async () => {
    const wrapper = mount(StoreView, globalCfg)
    await flushPromises()
    expect(wrapper.text()).toContain('Bento Bar')
    expect(wrapper.text()).toContain('Chicken Teriyaki')
  })

  it('renders the store description from the catalog', async () => {
    const wrapper = mount(StoreView, globalCfg)
    await flushPromises()
    expect(wrapper.text()).toContain('Fresh bento')
  })

  it('reacts to a different storeId on the route', async () => {
    const catalog = useCatalogStore()
    catalog.db.stores.push({ id: 's2', venue_id: 'v1', merchant_id: 'mer', name: 'Noodle House', is_open: true, description: '' })
    catalog.db.menu.push({ id: 'm2', store_id: 's2', category: 'Noodles', name: 'Laksa', price: 5, available: true, cook_time_sec: 60, max_at_once: 2, option_groups: [] })
    catalog.decorateStores()
    route.params.storeId = 's2'
    const wrapper = mount(StoreView, globalCfg)
    await flushPromises()
    expect(wrapper.text()).toContain('Noodle House')
    expect(wrapper.text()).toContain('Laksa')
    route.params.storeId = 's1' // reset for other tests
  })
})
