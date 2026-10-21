<script setup>
// Merchant portal: the live order board (New → Cooking → Ready) and the menu (sold-out switches).
// Merchants with several stores pick which one to run from the header.
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'
import { shortName } from '../../app/landmarks'
import OrderCard from './OrderCard.vue'
import { useStoreOrdersLive } from '@/composables/useStoreOrdersLive.js'
import { refresh as refreshLive } from '../../app/live'

const money = E.money
const t = computed(() => S.ui.staff)
const me = computed(() => Q.me())
const waiting = (o) => o.status === 'paid' || o.status === 'preparing'
const stores = computed(() => Q.storesOf(me.value.id).map((s) => ({ s, waiting: S.db.orders.filter((o) => o.store_id === s.id && waiting(o)).length })))
const store = computed(() => Q.store(t.value.storeId) || (stores.value[0] && stores.value[0].s))
const venue = computed(() => Q.venue(store.value.venue_id))
const est = computed(() => S.waits.orders)
// A delivery order leaves the board once the courier has picked it up
const gone = (o) => o.type === 'delivery' && o.delivery && ['picked_up', 'delivered'].includes(o.delivery.status)
const onBoard = computed(() => S.db.orders
  .filter((o) => o.store_id === store.value.id)
  .filter((o) => waiting(o) || (o.status === 'ready' && !gone(o)))
  .sort((a, b) => a.created_at - b.created_at))
const cols = computed(() => [
  { k: 'paid', title: 'New', list: onBoard.value.filter((o) => o.status === 'paid') },
  { k: 'preparing', title: 'Cooking', list: onBoard.value.filter((o) => o.status === 'preparing') },
  { k: 'ready', title: 'Ready', list: onBoard.value.filter((o) => o.status === 'ready') },
])
const doneToday = computed(() => S.db.orders.filter((o) => o.store_id === store.value.id && (o.status === 'completed' || (o.status === 'ready' && gone(o))) && E.sameDay(o.created_at, S.now)).length)
const open = computed(() => Q.open(store.value))
const menu = computed(() => Q.menu(store.value.id).map((m) => ({ m, groups: (m.option_groups || []).length })))

// Angel's merchant live layer: her channel (merchant-store:<id>, 'order_change')
// fires whenever this store's orders change, and we refetch the board's data.
const liveStoreId = computed(() => (store.value ? store.value.id : ''))
const { liveConnected } = useStoreOrdersLive(liveStoreId, {
  fetchOrders: async () => {
    await refreshLive()
    return S.db.orders
  },
})
</script>

<template>
  <div class="app merchant">
    <nav class="rail" aria-label="Merchant sections">
      <button :class="{ on: t.merchantTab === 'orders' }" @click="A.setMerchantTab('orders')"><Icon name="receipt" :size="20" /><span>Orders</span></button>
      <button :class="{ on: t.merchantTab === 'menu' }" @click="A.setMerchantTab('menu')"><Icon name="menu" :size="20" /><span>Menu</span></button>
    </nav>
    <div v-if="!store" class="m-main"><p class="col-empty">This account doesn't run any stores yet. An admin links stores to merchant accounts.</p></div>
    <div v-else class="m-main">
      <header class="m-top">
        <Mono :store="store" :size="36" />
        <div class="m-title">
          <select v-if="stores.length > 1" class="form-select form-select-sm m-store" aria-label="Store" :value="store.id" @change="A.setMerchantStore($event.target.value)">
            <option v-for="x in stores" :key="x.s.id" :value="x.s.id">{{ x.s.name }}{{ x.waiting ? ' (' + x.waiting + ' waiting)' : '' }}</option>
          </select>
          <strong v-else>{{ store.name }}</strong>
          <small>{{ venue ? shortName(venue.name) : '' }} · {{ store.unit_no }} · {{ open.label }}</small>
        </div>
        <label class="form-switch m-open"><input class="form-check-input" type="checkbox" role="switch" :checked="store.is_open" :disabled="S.busy[store.id]" @change="A.setStoreOpen(store.id, $event.target.checked)"><span>{{ store.is_open ? 'Taking orders' : 'Paused' }}</span></label>
        <div class="m-stat cap" title="Set on the server (KITCHEN_SLOTS) until stores has a column for it"><small>Cooks at once</small><b>{{ S.waits.slots }}</b></div>
        <div class="m-stat"><small>Done today</small><b>{{ doneToday }}</b></div>
        <div class="m-stat" :title="liveConnected ? 'Realtime is connected' : 'Polling for updates'"><small>Updates</small><b>{{ liveConnected ? 'Live' : 'Polling' }}</b></div>
      </header>
      <div v-if="t.merchantTab === 'orders'" class="board">
        <section v-for="c in cols" :key="c.k" class="kcol" :class="'col-' + c.k">
          <h5>{{ c.title }} <span>{{ c.list.length }}</span></h5>
          <div class="col-list scroll">
            <OrderCard v-for="o in c.list" :key="o.id" :o="o" :est="est[o.id]" />
            <p v-if="!c.list.length" class="col-empty">No orders</p>
          </div>
        </section>
      </div>
      <div v-else class="m-menu scroll">
        <p class="m-hint">Switching an item off hides it from students straight away. Cook time and "at once" feed the wait-time estimate.</p>
        <div v-for="x in menu" :key="x.m.id" class="mrow">
          <div><strong>{{ x.m.name }}</strong><small>{{ money(x.m.price) }} · {{ x.m.category }} · {{ x.groups ? x.groups + (x.groups === 1 ? ' option group' : ' option groups') : 'no options' }} · {{ Math.max(1, Math.round(x.m.cook_time_sec / 60)) }} min, {{ x.m.max_at_once }} at once</small></div>
          <label class="form-switch"><input class="form-check-input" type="checkbox" role="switch" :checked="x.m.available" :disabled="S.busy[x.m.id]" @change="A.setItemAvailable(x.m.id, $event.target.checked)"><span>{{ x.m.available ? 'Available' : 'Sold out' }}</span></label>
        </div>
      </div>
    </div>
  </div>
</template>
