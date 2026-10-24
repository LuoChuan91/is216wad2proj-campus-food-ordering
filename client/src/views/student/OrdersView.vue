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
import OrderTable from '@/components/OrderTable.vue'

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
    <template v-if="active.length">
      <h4 class="sec">Active</h4>
      <div class="d-flex flex-column gap-2 d-md-none">
        <OrderRow v-for="r in active" :key="r.o.id" :order="r.o" :store="r.s" :count="r.n" :busy="busy" variant="active" @open="ui.openTracking" />
      </div>
      <OrderTable class="d-none d-md-block" :rows="active" active @open="ui.openTracking" />
    </template>
    <template v-if="past.length">
      <h4 class="sec">Earlier</h4>
      <div class="d-flex flex-column gap-2 d-md-none">
        <OrderRow v-for="r in past" :key="r.o.id" :order="r.o" :store="r.s" variant="past" :now="now" @open="ui.openTracking" />
      </div>
      <OrderTable class="d-none d-md-block" :rows="past" @open="ui.openTracking" />
    </template>
    </div>
  </div>
</template>
