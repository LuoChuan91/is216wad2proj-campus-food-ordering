<script setup>
// Merchant order board body (New → Cooking → Ready).
//
// Migrated from the orders half of portals/merchant/MerchantApp.vue. The rail, the
// store header and the realtime layer live in the MerchantView shell; this is the
// routed body for #/merchant. The active store and the gone() helper come from the
// shell via inject. The store's live wait estimates still feed each card.
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useOrdersStore } from '@/stores/orders.js'
import OrderCard from '@/portals/merchant/OrderCard.vue'

const orders = useOrdersStore()
const { waits } = storeToRefs(orders)
const store = inject('merchantStore')
const gone = inject('merchantGone')
const waiting = (o) => o.status === 'paid' || o.status === 'preparing'
const est = computed(() => waits.value.orders)
const onBoard = computed(() => orders.db.orders
  .filter((o) => o.store_id === store.value.id)
  .filter((o) => waiting(o) || (o.status === 'ready' && !gone(o)))
  .sort((a, b) => a.created_at - b.created_at))
const cols = computed(() => [
  { k: 'paid', title: 'New', list: onBoard.value.filter((o) => o.status === 'paid') },
  { k: 'preparing', title: 'Cooking', list: onBoard.value.filter((o) => o.status === 'preparing') },
  { k: 'ready', title: 'Ready', list: onBoard.value.filter((o) => o.status === 'ready') },
])
</script>

<template>
  <div class="board">
    <section v-for="c in cols" :key="c.k" class="kcol" :class="'col-' + c.k">
      <h5>{{ c.title }} <span>{{ c.list.length }}</span></h5>
      <div class="col-list scroll">
        <OrderCard v-for="o in c.list" :key="o.id" :o="o" :est="est[o.id]" />
        <p v-if="!c.list.length" class="col-empty">No orders</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Kitchen order board (moved from the global prototype stylesheet).
   .col-empty stays global — it is shared with the admin lists. */
.board {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 14px;
}
.kcol {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #eaecf3;
  border-radius: 16px;
  padding: 8px;
}
.kcol h5 {
  font-size: 12.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 2px 4px 8px;
  display: flex;
  justify-content: space-between;
  color: var(--ink-2);
  font-weight: 800;
}
.kcol h5 span {
  background: var(--paper);
  border-radius: 999px;
  padding: 0 8px;
  color: var(--ink);
}
.col-preparing h5 {
  color: var(--brand-600);
}
.col-ready h5 {
  color: var(--ok);
}
.col-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
