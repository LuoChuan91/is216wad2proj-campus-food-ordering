<script setup>
// One row in the student's orders list, with the human status label.
//
// Extracted from views/student/OrdersView.vue. The label logic is the same the
// prototype used: completed -> Delivered/Collected (depending on delivery and
// whether it fell back to pickup), ready+picked_up -> On the way, otherwise a map
// of the raw status. The row's subtitle differs between active ("#code · N items ·
// price") and earlier ("<since> · price"), so the caller passes `variant`.
import { computed } from 'vue'
import * as E from '@/utils/engine.js'
import Mono from '@/components/icons/Mono.vue'
import StatusTag from '@/components/StatusTag.vue'

const props = defineProps({
  order: { type: Object, required: true },
  store: { type: Object, required: true },
  count: { type: Number, default: 0 },
  // 'active' (default) shows code + item count; 'past' shows how long ago.
  variant: { type: String, default: 'active' },
  // "now" ms, used by the 'past' variant's relative time.
  now: { type: Number, default: 0 },
})
defineEmits(['open'])

const money = E.money
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// The human-facing status label (exact behaviour preserved from OrdersView).
const label = computed(() => {
  const o = props.order
  if (o.status === 'completed') return o.delivery && !o.fallback ? 'Delivered' : 'Collected'
  if (o.status === 'ready' && o.delivery && o.delivery.status === 'picked_up') return 'On the way'
  return { pending: 'Pending', paid: 'In queue', preparing: 'Cooking', ready: 'Ready', cancelled: 'Cancelled' }[o.status] || o.status
})
</script>

<template>
  <button class="order-row panel" @click="$emit('open', order.id)">
    <Mono :store="store" :size="40" />
    <span class="or-main">
      <strong>{{ store.name }}</strong>
      <small v-if="variant === 'active'">#{{ order.code }} · {{ plural(count, 'item', 'items') }} · {{ money(order.total) }}</small>
      <small v-else>{{ E.since(order.created_at, now) }} · {{ money(order.total) }}</small>
    </span>
    <StatusTag :tone="variant === 'active' ? 'info' : 'muted'">{{ label }}</StatusTag>
  </button>
</template>

<style scoped>
/* Orders-list row (moved from the global prototype stylesheet).
   .panel stays global (shared card helper). */
.order-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  margin-bottom: 8px;
  cursor: pointer;
}
.or-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.or-main small {
  color: var(--muted);
  font-size: 12px;
}
</style>
