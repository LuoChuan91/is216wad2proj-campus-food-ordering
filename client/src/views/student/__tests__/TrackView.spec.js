// Mount test for views/student/TrackView.vue.
//
// TrackView reads the order id from the route param (:orderId) and renders the live
// tracking page for that order. This test proves it looks the order up by the param
// (not S.ui.student.trackOrderId) and renders the code, store and receipt. The peer-
// delivery walking leg (utils/mapApi.js) is left real — it's a pure calculation.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/common/supabase.js', () => ({ default: null }))

// Controllable route param.
const route = { params: { orderId: 'o1' } }
vi.mock('vue-router', () => ({ useRoute: () => route }))

import { setActivePinia } from 'pinia'
import pinia from '@/stores/pinia.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import Icon from '@/components/Icon.vue'
import Mono from '@/components/Mono.vue'
import Avatar from '@/components/Avatar.vue'
import TrackView from '../TrackView.vue'

const globalCfg = { global: { components: { Icon, Mono, Avatar } } }

function seed() {
  setActivePinia(pinia)
  const catalog = useCatalogStore()
  catalog.db.profiles = [{ id: 'mer', role: 'merchant', name: 'Mei Lin', status: 'active' }]
  catalog.db.venues = [{ id: 'v1', name: 'SMU Labs', lat: 1.2966, lng: 103.85, address: 'Level 1' }]
  catalog.db.stores = [{ id: 's1', venue_id: 'v1', merchant_id: 'mer', name: 'Bento Bar', is_open: true, description: '' }]
  catalog.db.menu = [{ id: 'm1', store_id: 's1', category: 'Bento', name: 'Chicken Teriyaki', price: 6, available: true, cook_time_sec: 60, max_at_once: 2, option_groups: [] }]
  catalog.decorateStores()

  const orders = useOrdersStore()
  orders.db.orders = [{
    id: 'o1', code: 'E287', status: 'paid', type: 'pickup', store_id: 's1',
    created_at: Date.now(), preparing_at: null, ready_at: null, completed_at: null,
    subtotal: 6, discount: 0, paid: 6, total: 6, fallback: false, fee_waived: 0,
    items: [{ id: 'oi1', menu_item_id: 'm1', name: 'Chicken Teriyaki', qty: 1, unit_price: 6, option_names: [] }],
    payment: { amount: 6, status: 'success', reference: 'SIM-1', method: 'simulated' },
    delivery: null,
  }]
  return { catalog, orders }
}

describe('TrackView', () => {
  beforeEach(() => { seed() })

  it('renders the order named by the route param', async () => {
    const wrapper = mount(TrackView, globalCfg)
    await flushPromises()
    expect(wrapper.text()).toContain('Order #E287')
    expect(wrapper.text()).toContain('Bento Bar')
    expect(wrapper.text()).toContain('Chicken Teriyaki')
  })

  it('shows the Live chip and the paid receipt line', async () => {
    const wrapper = mount(TrackView, globalCfg)
    await flushPromises()
    expect(wrapper.find('.live').exists()).toBe(true)
    expect(wrapper.text()).toContain('SIM-1')
    expect(wrapper.text()).toContain('Paid')
  })

  it('reacts to a different orderId on the route', async () => {
    const { orders } = seed()
    orders.db.orders.push({
      id: 'o2', code: 'F999', status: 'completed', type: 'pickup', store_id: 's1',
      created_at: Date.now(), preparing_at: null, ready_at: null, completed_at: Date.now(),
      subtotal: 6, discount: 0, paid: 6, total: 6, fallback: false, fee_waived: 0,
      items: [{ id: 'oi2', menu_item_id: 'm1', name: 'Chicken Teriyaki', qty: 1, unit_price: 6, option_names: [] }],
      payment: { amount: 6, status: 'success', reference: 'SIM-2', method: 'simulated' },
      delivery: null,
    })
    route.params.orderId = 'o2'
    const wrapper = mount(TrackView, globalCfg)
    await flushPromises()
    expect(wrapper.text()).toContain('Order #F999')
    route.params.orderId = 'o1' // reset
  })
})
