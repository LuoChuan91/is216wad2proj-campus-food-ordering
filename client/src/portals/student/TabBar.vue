<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useSessionStore } from '@/stores/session.js'

const ui = useUiStore()
const orders = useOrdersStore()
const sessionStore = useSessionStore()
const { ui: uiState, courierOn } = storeToRefs(ui)
const { session } = storeToRefs(sessionStore)

const props = defineProps({ top: { type: Boolean, default: false } })

const u = computed(() => uiState.value.student)
const tabs = [
  { id: 'explore', label: 'Explore', icon: 'map' },
  { id: 'stores', label: 'Stores', icon: 'store' },
  { id: 'orders', label: 'Orders', icon: 'receipt' },
  { id: 'deliver', label: 'Deliver', icon: 'bike' },
  { id: 'me', label: 'Me', icon: 'user' },
]
const active = computed(() => orders.ordersOf(session.value.userId).filter(orders.isActive).length)
const jobs = computed(() => (courierOn.value ? orders.openJobs().length : 0))
</script>

<template>
  <nav v-if="props.top" class="nav gap-1" aria-label="Student sections">
    <button v-for="t in tabs" :key="t.id" type="button" class="btn btn-sm text-white rounded-pill d-flex align-items-center gap-2 px-2 px-xl-3"
      :class="u.tab === t.id ? 'bg-white bg-opacity-10' : 'opacity-75'" :title="t.label" :aria-label="t.label" @click="ui.setTab(t.id)">
      <span class="tab-ic"><Icon :name="t.icon" :size="18" /><b v-if="t.id === 'orders' && active" class="tab-dot">{{ active }}</b><b v-if="t.id === 'deliver' && jobs && u.tab !== 'deliver'" class="tab-dot ok">{{ jobs }}</b></span>
      <span class="d-none d-xl-inline">{{ t.label }}</span>
    </button>
  </nav>
  <nav v-else class="tabbar">
    <button v-for="t in tabs" :key="t.id" class="tab" :class="{ on: u.tab === t.id }" @click="ui.setTab(t.id)">
      <span class="tab-ic"><Icon :name="t.icon" :size="22" /><b v-if="t.id === 'orders' && active" class="tab-dot">{{ active }}</b><b v-if="t.id === 'deliver' && jobs && u.tab !== 'deliver'" class="tab-dot ok">{{ jobs }}</b></span>
      <span>{{ t.label }}</span>
    </button>
  </nav>
</template>
