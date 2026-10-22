<script setup>
import { computed } from 'vue'
import { S, Q, A } from '@/stores/compat.js'

const u = computed(() => S.ui.student)
const tabs = [
  { id: 'explore', label: 'Explore', icon: 'map' },
  { id: 'stores', label: 'Stores', icon: 'store' },
  { id: 'orders', label: 'Orders', icon: 'receipt' },
  { id: 'deliver', label: 'Deliver', icon: 'bike' },
  { id: 'me', label: 'Me', icon: 'user' },
]
const active = computed(() => Q.ordersOf(S.session.userId).filter(Q.isActive).length)
const jobs = computed(() => (S.courierOn ? Q.openJobs().length : 0))
</script>

<template>
  <nav class="tabbar">
    <button v-for="t in tabs" :key="t.id" class="tab" :class="{ on: u.tab === t.id }" @click="A.setTab(t.id)">
      <span class="tab-ic"><Icon :name="t.icon" :size="22" /><b v-if="t.id === 'orders' && active" class="tab-dot">{{ active }}</b><b v-if="t.id === 'deliver' && jobs && u.tab !== 'deliver'" class="tab-dot ok">{{ jobs }}</b></span>
      <span>{{ t.label }}</span>
    </button>
  </nav>
</template>
