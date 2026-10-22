<script setup>
// Merchant portal shell: the rail, the store header, and the realtime order layer.
//
// Migrated from portals/merchant/MerchantApp.vue. The shell (rail + header) stays
// here and renders the active sub-section (orders board / menu) through <RouterView>,
// which vue-router selects from the URL (#/merchant, #/merchant/menu). The store and
// its live wait-time map are PROVIDED down to the body views via provide/inject so the
// board and the menu read the same selection.
//
// CRITICAL (preserved exactly): Angel's merchant live layer — useStoreOrdersLive on
// merchant-store:<id> — is mounted here at the shell level, so it stays connected while
// switching between the Orders and Menu tabs, and the header's "Updates: Live/Polling"
// chip reflects its connection on both tabs, identical to the prototype.
import { computed, provide } from 'vue'
import { S, Q, A } from '@/stores/compat.js'
import * as E from '@/utils/engine.js'
import { shortName } from '@/utils/landmarks.js'
import { useStoreOrdersLive } from '@/composables/useStoreOrdersLive.js'
import { refresh as refreshLive } from '@/composables/useAppBootstrap.js'
import StatCard from '@/components/StatCard.vue'

const t = computed(() => S.ui.staff)
const me = computed(() => Q.me())
const waiting = (o) => o.status === 'paid' || o.status === 'preparing'
const stores = computed(() => Q.storesOf(me.value.id).map((s) => ({ s, waiting: S.db.orders.filter((o) => o.store_id === s.id && waiting(o)).length })))
const store = computed(() => Q.store(t.value.storeId) || (stores.value[0] && stores.value[0].s))
const venue = computed(() => (store.value ? Q.venue(store.value.venue_id) : null))
const open = computed(() => Q.open(store.value))
const doneToday = computed(() => S.db.orders.filter((o) => o.store_id === store.value.id && (o.status === 'completed' || (o.status === 'ready' && gone(o))) && E.sameDay(o.created_at, S.now)).length)
// A delivery order leaves the board once the courier has picked it up
const gone = (o) => o.type === 'delivery' && o.delivery && ['picked_up', 'delivered'].includes(o.delivery.status)

// Angel's merchant live layer: her channel (merchant-store:<id>, 'order_change')
// fires whenever this store's orders change, and we refetch the board's data.
const liveStoreId = computed(() => (store.value ? store.value.id : ''))
const { liveConnected } = useStoreOrdersLive(liveStoreId, {
  fetchOrders: async () => {
    await refreshLive()
    return S.db.orders
  },
})

// The body views (orders board / menu) read the active store and the gone() helper.
provide('merchantStore', store)
provide('merchantGone', gone)
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
        <StatCard cap label="Cooks at once" :value="S.waits.slots" title="Set on the server (KITCHEN_SLOTS) until stores has a column for it" />
        <StatCard label="Done today" :value="doneToday" />
        <StatCard label="Updates" :value="liveConnected ? 'Live' : 'Polling'" :title="liveConnected ? 'Realtime is connected' : 'Polling for updates'" />
      </header>
      <!-- The active sub-section (orders board / menu), selected by the route. -->
      <RouterView />
    </div>
  </div>
</template>
