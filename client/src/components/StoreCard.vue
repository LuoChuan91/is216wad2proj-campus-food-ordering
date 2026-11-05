<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui.js'
import { useStoreWait } from '@/composables/storeWaitCache.js'
import StatusTag from '@/components/StatusTag.vue'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'
import * as E from '@/utils/engine.js'

const props = defineProps({
  store: { type: Object, required: true },
  open: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
})

const ui = useUiStore()
const taking = computed(() => props.available && props.open)
const wait = useStoreWait(() => (taking.value ? props.store.id : null))
const aheadLabel = computed(() => {
  if (!taking.value || wait.entry.loading) return ''
  const n = wait.entry.ahead
  if (!n) return 'No orders before you'
  return `${n} ${n === 1 ? 'order' : 'orders'} before you`
})
</script>

<template>
  <button class="store-card d-flex align-items-center gap-3 w-100 p-2 text-start bg-white border rounded-4"
    :class="{ 'opacity-75': available && !open, 'opacity-50': !available }"
    :disabled="!available" @click="ui.openStore(store.id)">
    <Mono :store="store" :size="46" />
    <span class="d-flex flex-column flex-grow-1 overflow-hidden">
      <strong>{{ store.name }}</strong>
      <slot />
      <span class="d-flex flex-wrap gap-1 mt-1">
        <StatusTag v-if="!available" tone="muted">Unavailable</StatusTag>
        <StatusTag v-else :tone="open ? 'ok' : 'muted'">{{ open ? 'Open' : 'Closed' }}</StatusTag>
        <StatusTag v-if="store.discount_type" tone="brand">{{ E.discountShort(store) }}</StatusTag>
        <StatusTag v-if="aheadLabel" tone="info"><i class="bi bi-people" aria-hidden="true"></i>{{ aheadLabel }}</StatusTag>
      </span>
    </span>
    <span v-if="available && open" class="flex-shrink-0">
      <WaitTimeEstimate :store-id="store.id" />
    </span>
  </button>
</template>

<style scoped>
.store-card:hover {
  --bs-border-color: #cfd4e0;
}
</style>
