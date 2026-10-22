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
  <nav class="tabbar">
    <button v-for="t in tabs" :key="t.id" class="tab" :class="{ on: u.tab === t.id }" @click="ui.setTab(t.id)">
      <span class="tab-ic"><Icon :name="t.icon" :size="22" /><b v-if="t.id === 'orders' && active" class="tab-dot">{{ active }}</b><b v-if="t.id === 'deliver' && jobs && u.tab !== 'deliver'" class="tab-dot ok">{{ jobs }}</b></span>
      <span>{{ t.label }}</span>
    </button>
  </nav>
</template>
