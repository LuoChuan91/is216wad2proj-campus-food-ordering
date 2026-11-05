<script setup>
import { computed } from 'vue'
import * as E from '@/utils/engine.js'
import Mono from '@/components/icons/Mono.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useOrdersStore } from '@/stores/orders.js'
import { orderStatusLabel } from '@/utils/orderStatus.js'


const orders = useOrdersStore()

const props = defineProps({
  order: { type: Object, required: true },
  store: { type: Object, required: true },
  count: { type: Number, default: 0 },
  // 'active' (default) shows code + item count; 'past' shows how long ago.
  variant: { type: String, default: 'active' },
  // "now" ms, used by the 'past' variant's relative time.
  now: { type: Number, default: 0 },
  busy: { type: Object, default: null },
})
defineEmits(['open'])

const money = E.money
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// The human-facing status label (exact behaviour preserved from OrdersView).
const label = computed(() => orderStatusLabel(props.order))
</script>

<template>
  <button class="order-row panel" @click="$emit('open', order.id)">
    <Mono :store="store" :size="40" />
    <span class="or-main">
      <strong>{{ store.name }}</strong>
      <small v-if="variant === 'active'">#{{ order.code }} · {{ plural(count, 'item', 'items') }} · {{
        money(order.total) }}</small>
      <small v-else>{{ E.since(order.created_at, now) }} · {{ money(order.total) }}</small>
    </span>
    <StatusTag :tone="variant === 'active' ? 'info' : 'muted'">{{ label }}</StatusTag>
    <button v-if="order.type === 'pickup' && order.status != 'completed'" class="btn btn-outline-secondary btn-sm"
      :disabled="order.status != 'ready' || busy[order.id]" @click.stop="orders.markCollected(order.id)">Collected
    </button>
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
  font-size: var(--fs-caption);
}
</style>
