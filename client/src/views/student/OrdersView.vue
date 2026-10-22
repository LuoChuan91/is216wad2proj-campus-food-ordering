<script setup>
// Your orders: active ones first, then earlier ones.
//
// Migrated from portals/student/OrdersTab.vue. Renders in StudentLayout's persistent
// KeepAlive tab layer. Behaviour unchanged. Each row is an <OrderRow> (which owns the
// status-label logic); this view just splits the orders into active vs earlier.
import { computed } from 'vue'
import { S, Q, A } from '@/stores/compat.js'
import OrderRow from '@/components/OrderRow.vue'

const rows = computed(() => Q.ordersOf(S.session.userId)
  .map((o) => ({ o, s: Q.store(o.store_id), n: o.items.reduce((a, l) => a + l.qty, 0) }))
  .filter((r) => r.s))
const active = computed(() => rows.value.filter((r) => Q.isActive(r.o)))
const past = computed(() => rows.value.filter((r) => !Q.isActive(r.o)))
</script>

<template>
  <div class="orders-tab scroll">
    <h2 class="tab-title">Your orders</h2>
    <p v-if="!active.length && !past.length" class="empty-note">No orders yet. Find a store on the map to start.</p>
    <h4 v-if="active.length" class="sec">Active</h4>
    <OrderRow v-for="r in active" :key="r.o.id" :order="r.o" :store="r.s" :count="r.n" variant="active" @open="A.openTracking" />
    <h4 v-if="past.length" class="sec">Earlier</h4>
    <OrderRow v-for="r in past" :key="r.o.id" :order="r.o" :store="r.s" variant="past" :now="S.now" @open="A.openTracking" />
  </div>
</template>
