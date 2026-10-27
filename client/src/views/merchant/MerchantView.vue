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
import { computed, provide, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'
import { waitSettings } from '@/utils/waitSettings.js'
import { shortName } from '@/utils/landmarks.js'
import { useStoreOrdersLive } from '@/composables/useStoreOrdersLive.js'
import { acquireStoreWait, releaseStoreWait, peekStoreWait } from '@/composables/storeWaitCache.js'
import StatCard from '@/components/StatCard.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const ordersStore = useOrdersStore()
const { ui: uiState, now, busy } = storeToRefs(ui)

const t = computed(() => uiState.value.staff)
const me = computed(() => ordersStore.me())
const waiting = (o) => o.status === 'paid' || o.status === 'preparing'
const stores = computed(() => catalog.storesOf(me.value.id).map((s) => ({ s, waiting: ordersStore.db.orders.filter((o) => o.store_id === s.id && waiting(o)).length })))
const store = computed(() => catalog.store(t.value.storeId) || (stores.value[0] && stores.value[0].s))
const venue = computed(() => (store.value ? catalog.venue(store.value.venue_id) : null))
const open = computed(() => ui.open(store.value))
const doneToday = computed(() => ordersStore.db.orders.filter((o) => o.store_id === store.value.id && (o.status === 'completed' || (o.status === 'ready' && gone(o))) && E.sameDay(o.created_at, now.value)).length)
// A delivery order leaves the board once the courier has picked it up
const gone = (o) => o.type === 'delivery' && o.delivery && ['picked_up', 'delivered'].includes(o.delivery.status)
const kitchenSlots = computed(() => (store.value ? waitSettings(store.value.id).stations : ''))

// Merchant live layer: the merchant-store:<id> channel ('order_change') fires
// whenever this store's orders change. We refetch JUST this store's orders (via
// the shared api) and merge them into S.db.orders so the board updates — without
// the global 4s poll (which useLiveSync now owns as a fallback). This removes the
// old double-refetch where realtime triggered a whole-app refresh.
const liveStoreId = computed(() => (store.value ? store.value.id : ''))
const { liveConnected } = useStoreOrdersLive(liveStoreId, {
  fetchOrders: async (sid) => {
    const list = await ordersStore.loadStoreOrders(sid)
    return list
  },
})

// The body views (orders board / menu) read the active store and the gone() helper.
provide('merchantStore', store)
provide('merchantGone', gone)

// Per-order ready-time estimates from the single frontend engine (store:<id>).
// We ref-count a per-order wait engine for every order on the board and expose an
// { [orderId]: { readyAt } } map (readyAt derived on the frontend as now + seconds).
// `orderStore` remembers which store each acquired order belonged to so release
// targets the right cache key even if the selected store changes.
const waitKeys = new Set()
const orderStore = new Map()
const onBoardIds = computed(() => {
  const s = store.value
  if (!s) return []
  return ordersStore.db.orders
    .filter((o) => o.store_id === s.id && (waiting(o) || (o.status === 'ready' && !gone(o))))
    .map((o) => o.id)
})
watch(
  () => [store.value ? store.value.id : '', onBoardIds.value.join(',')],
  () => {
    const s = store.value
    if (!s) return
    const wanted = new Set(onBoardIds.value)
    for (const oid of wanted) if (!waitKeys.has(oid)) { acquireStoreWait(s.id, oid); orderStore.set(oid, s.id); waitKeys.add(oid) }
    for (const oid of [...waitKeys]) if (!wanted.has(oid)) { releaseStoreWait(orderStore.get(oid) || s.id, oid); orderStore.delete(oid); waitKeys.delete(oid) }
  },
  { immediate: true },
)
const est = computed(() => {
  const map = {}
  for (const oid of onBoardIds.value) {
    const entry = peekStoreWait(orderStore.get(oid) || (store.value && store.value.id), oid)
    if (entry && !entry.loading && entry.seconds) map[oid] = { readyAt: now.value + entry.seconds * 1000 }
  }
  return map
})
provide('merchantEst', est)

onBeforeUnmount(() => {
  for (const oid of waitKeys) releaseStoreWait(orderStore.get(oid), oid)
  waitKeys.clear(); orderStore.clear()
})
</script>

<template>
  <div class="app merchant">
    <nav class="rail" aria-label="Merchant sections">
      <button :class="{ on: t.merchantTab === 'orders' }" @click="ui.setMerchantTab('orders')"><Icon name="receipt" :size="20" /><span>Orders</span></button>
      <button :class="{ on: t.merchantTab === 'menu' }" @click="ui.setMerchantTab('menu')"><Icon name="menu" :size="20" /><span>Menu</span></button>
      <button :class="{ on: t.merchantTab === 'store' }" @click="ui.setMerchantTab('store')"><Icon name="store" :size="20" /><span>Store</span></button>
    </nav>
    <div v-if="!store" class="m-main"><p class="col-empty">This account doesn't run any stores yet. An admin links stores to merchant accounts.</p></div>
    <div v-else class="m-main">
      <header class="m-top d-flex align-items-center flex-wrap gap-3">
        <Mono :store="store" :size="36" />
        <div class="m-title d-flex flex-column flex-grow-1 overflow-hidden">
          <select v-if="stores.length > 1" class="form-select form-select-sm m-store" aria-label="Store" :value="store.id" @change="ui.setMerchantStore($event.target.value)">
            <option v-for="x in stores" :key="x.s.id" :value="x.s.id">{{ x.s.name }}{{ x.waiting ? ' (' + x.waiting + ' waiting)' : '' }}</option>
          </select>
          <strong v-else>{{ store.name }}</strong>
          <small>{{ venue ? shortName(venue.name) : '' }} · {{ store.unit_no }} · {{ open.label }}</small>
        </div>
        <label class="form-check form-switch mb-0 small fw-bold text-nowrap"><input class="form-check-input" type="checkbox" role="switch" :checked="store.is_open" :disabled="busy[store.id]" @change="ordersStore.setStoreOpen(store.id, $event.target.checked)"><span class="form-check-label">{{ store.is_open ? 'Taking orders' : 'Paused' }}</span></label>
        <StatCard cap label="Workstations" :value="kitchenSlots" title="Change it above the order board" />
        <StatCard label="Done today" :value="doneToday" />
        <StatCard label="Updates" :value="liveConnected ? 'Live' : 'Polling'" :title="liveConnected ? 'Realtime is connected' : 'Polling for updates'" />
      </header>
      <!-- The active sub-section (orders board / menu), selected by the route. -->
      <RouterView />
    </div>
  </div>
</template>
