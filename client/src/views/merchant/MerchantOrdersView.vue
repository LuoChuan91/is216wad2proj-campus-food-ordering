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
