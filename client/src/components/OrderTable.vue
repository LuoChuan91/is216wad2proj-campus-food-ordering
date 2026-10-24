<script setup>
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'
import { orderStatusLabel } from '@/utils/orderStatus.js'
import StatusTag from '@/components/StatusTag.vue'

defineProps({
  rows: { type: Array, required: true },
  active: { type: Boolean, default: false },
})
defineEmits(['open'])

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { busy } = storeToRefs(ui)

const money = E.money
const placed = (ms) => `${E.dateLabel(ms)}, ${E.clock(ms)}`
const isDelivery = (o) => o.type === 'delivery' && !o.fallback
function typeDetail(o) {
  if (o.fallback) return 'No courier, switched to pickup'
  if (!isDelivery(o) || !o.delivery) return ''
  const drop = catalog.dropoff(o.delivery.destination_id)
  return [drop && drop.name, o.delivery.courier_name && `by ${o.delivery.courier_name}`].filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="table-responsive bg-white border rounded-4">
    <table class="table table-hover align-middle mb-0">
      <thead class="table-light">
        <tr class="small text-body-secondary">
          <th scope="col">Store</th>
          <th scope="col">Order</th>
          <th scope="col">Items</th>
          <th scope="col" class="d-none d-lg-table-cell">Type</th>
          <th scope="col" class="text-end">Total</th>
          <th scope="col">Status</th>
          <th v-if="active" scope="col"><span class="visually-hidden">Action</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.o.id" role="button" tabindex="0" @click="$emit('open', r.o.id)" @keydown.enter="$emit('open', r.o.id)">
          <td>
            <div class="d-flex align-items-center gap-2">
              <Mono :store="r.s" :size="32" /><strong>{{ r.s.name }}</strong>
            </div>
          </td>
          <td class="text-nowrap">
            <div class="fw-semibold">#{{ r.o.code }}</div>
            <small class="d-block text-body-secondary">{{ placed(r.o.created_at) }}</small>
            <small class="d-block d-lg-none text-body-secondary">{{ isDelivery(r.o) ? 'Delivery' : 'Pickup' }}</small>
          </td>
          <td class="small">
            <div v-for="l in r.o.items.slice(0, 2)" :key="l.id">
              {{ l.qty }}× {{ l.name }}<span v-if="l.option_names.length" class="text-body-secondary"> · {{ l.option_names.join(', ') }}</span>
            </div>
            <div v-if="r.o.items.length > 2" class="text-body-secondary">+{{ r.o.items.length - 2 }} more</div>
          </td>
          <td class="d-none d-lg-table-cell small">
            <div class="d-flex align-items-center gap-1 fw-semibold"><Icon :name="isDelivery(r.o) ? 'bike' : 'bag'" :size="14" />{{ isDelivery(r.o) ? 'Delivery' : 'Pickup' }}</div>
            <div v-if="typeDetail(r.o)" class="text-body-secondary">{{ typeDetail(r.o) }}</div>
          </td>
          <td class="text-end fw-semibold text-nowrap">{{ money(r.o.total) }}</td>
          <td><StatusTag :tone="active ? 'info' : 'muted'">{{ orderStatusLabel(r.o) }}</StatusTag></td>
          <td v-if="active" class="text-end">
            <button v-if="r.o.type === 'pickup' && r.o.status !== 'completed'" type="button" class="btn btn-outline-secondary btn-sm"
              :disabled="r.o.status !== 'ready' || busy[r.o.id]" @click.stop="orders.markCollected(r.o.id)">Collected</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
