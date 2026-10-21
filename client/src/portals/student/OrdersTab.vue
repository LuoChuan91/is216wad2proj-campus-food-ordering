<script setup>
// Your orders: active ones first, then earlier ones
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'

const money = E.money
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const rows = computed(() => Q.ordersOf(S.session.userId)
  .map((o) => ({ o, s: Q.store(o.store_id), n: o.items.reduce((a, l) => a + l.qty, 0) }))
  .filter((r) => r.s))
const active = computed(() => rows.value.filter((r) => Q.isActive(r.o)))
const past = computed(() => rows.value.filter((r) => !Q.isActive(r.o)))
function label(o) {
  if (o.status === 'completed') return o.delivery && !o.fallback ? 'Delivered' : 'Collected'
  if (o.status === 'ready' && o.delivery && o.delivery.status === 'picked_up') return 'On the way'
  return { pending: 'Pending', paid: 'In queue', preparing: 'Cooking', ready: 'Ready', cancelled: 'Cancelled' }[o.status] || o.status
}
</script>

<template>
  <div class="orders-tab scroll">
    <h2 class="tab-title">Your orders</h2>
    <p v-if="!active.length && !past.length" class="empty-note">No orders yet. Find a store on the map to start.</p>
    <h4 v-if="active.length" class="sec">Active</h4>
    <button v-for="r in active" :key="r.o.id" class="order-row panel" @click="A.openTracking(r.o.id)">
      <Mono :store="r.s" :size="40" /><span class="or-main"><strong>{{ r.s.name }}</strong><small>#{{ r.o.code }} · {{ plural(r.n, 'item', 'items') }} · {{ money(r.o.total) }}</small></span><span class="tag info">{{ label(r.o) }}</span>
    </button>
    <h4 v-if="past.length" class="sec">Earlier</h4>
    <button v-for="r in past" :key="r.o.id" class="order-row panel" @click="A.openTracking(r.o.id)">
      <Mono :store="r.s" :size="40" /><span class="or-main"><strong>{{ r.s.name }}</strong><small>{{ E.since(r.o.created_at, S.now) }} · {{ money(r.o.total) }}</small></span><span class="tag muted">{{ label(r.o) }}</span>
    </button>
  </div>
</template>
