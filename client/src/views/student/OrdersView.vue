<script setup>
// Your orders: active ones first, then earlier ones.
//
// Migrated from portals/student/OrdersTab.vue. Renders in StudentLayout's persistent
// KeepAlive tab layer. Behaviour unchanged. Each row is an <OrderRow> (which owns the
// status-label logic); this view just splits the orders into active vs earlier.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useSessionStore } from '@/stores/session.js'
import OrderRow from '@/components/OrderRow.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const sessionStore = useSessionStore()
const { now, busy } = storeToRefs(ui)
const { session } = storeToRefs(sessionStore)

const rows = computed(() => orders.ordersOf(session.value.userId)
  .map((o) => ({ o, s: catalog.store(o.store_id), n: o.items.reduce((a, l) => a + l.qty, 0) }))
  .filter((r) => r.s))
const active = computed(() => rows.value.filter((r) => orders.isActive(r.o)))
const past = computed(() => rows.value.filter((r) => !orders.isActive(r.o)))
</script>

<template>
  <div class="orders-tab scroll">
    <div class="container px-0">
    <h2 class="tab-title">Your orders</h2>
    <p v-if="!active.length && !past.length" class="empty-note">No orders yet. Find a store on the map to start.</p>
    <h4 v-if="active.length" class="sec">Active</h4>
    <div class="row g-2">
      <div v-for="r in active" :key="r.o.id" class="col-12 col-md-6 col-lg-4">
        <OrderRow class="h-100" :order="r.o" :store="r.s" :count="r.n" :busy="busy" variant="active" @open="ui.openTracking" />
      </div>
    </div>
    <h4 v-if="past.length" class="sec">Earlier</h4>
    <div class="row g-2">
      <div v-for="r in past" :key="r.o.id" class="col-12 col-md-6 col-lg-4">
        <OrderRow class="h-100" :order="r.o" :store="r.s" variant="past" :now="now" @open="ui.openTracking" />
      </div>
    </div>
    </div>
  </div>
</template>
