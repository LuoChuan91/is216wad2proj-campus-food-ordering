<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '@/services/api.js'
import { useSessionStore } from '@/stores/session.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useUiStore } from '@/stores/ui.js'

const session = useSessionStore()
const orders = useOrdersStore()
const ui = useUiStore()

const previous = ref([])
const studentId = computed(() => session.session.userId)
const ordersKey = computed(() => orders.db.orders.map((o) => o.id).join(','))

async function load() {
  if (!studentId.value) {
    previous.value = []
    return
  }
  try {
    previous.value = await api.previousOrders(studentId.value)
  } catch {
    previous.value = []
  }
}
watch([studentId, ordersKey], load, { immediate: true })

const summary = (order) => order.items.map((i) => `${i.qty}× ${i.name || 'Item'}`).join(', ')
const count = (order) => order.items.reduce((n, i) => n + i.qty, 0)
</script>

<template>
  <section v-if="previous.length" class="mb-3" aria-labelledby="previously-ordered-title">
    <h3 id="previously-ordered-title" class="fs-6 fw-bold mb-2">Order again</h3>
    <div class="row g-2">
      <div v-for="order in previous" :key="order.id" class="col-12 col-md-4">
        <button
          type="button"
          class="reorder-card w-100 h-100 d-flex align-items-center gap-2 text-start p-2 rounded-3"
          :aria-label="`Add ${order.store_name || 'this'} order to cart: ${summary(order)}`"
          @click="ui.reorder(order)"
        >
          <span class="flex-grow-1 overflow-hidden">
            <span class="d-block fw-bold text-truncate">{{ order.store_name || 'Store' }}</span>
            <small class="d-block text-body-secondary text-truncate">{{ summary(order) }}</small>
          </span>
          <span class="add-pill d-inline-flex align-items-center gap-1 rounded-pill px-2 py-1 small fw-bold text-nowrap">
            <i class="bi bi-plus-lg" aria-hidden="true"></i>{{ count(order) }}
          </span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.reorder-card {
  border: 1px solid var(--line);
  background: var(--paper);
  color: inherit;
  cursor: pointer;
}
.reorder-card:hover {
  border-color: var(--brand);
}
.add-pill {
  background: var(--brand-soft);
  color: var(--brand-600);
}
</style>
