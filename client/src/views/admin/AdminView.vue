<script setup>
// Admin portal shell: rail + header, rendering the active sub-section (approvals /
// venues / stores) via <RouterView>. The rail's pending count is provide()d down.
import { computed, provide } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import StatCard from '@/components/StatCard.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { ui: uiState } = storeToRefs(ui)

const t = computed(() => uiState.value.staff)
const me = computed(() => orders.me())
const students = computed(() => catalog.db.profiles.filter((p) => p.role === 'student'))
const pending = computed(() => students.value.filter((p) => p.status === 'inactive'))
const activeStudents = computed(() => students.value.filter((p) => p.status === 'active'))
const venues = computed(() => catalog.db.venues)
const stores = computed(() => catalog.db.stores)

provide('adminPending', pending)
</script>

<template>
  <div class="app admin">
    <nav class="rail" aria-label="Admin sections">
      <button :class="{ on: t.adminTab === 'approvals' }" @click="ui.setAdminTab('approvals')"><span class="tab-ic"><Icon name="users" :size="20" /><b v-if="pending.length" class="tab-dot">{{ pending.length }}</b></span><span>Students</span></button>
      <button :class="{ on: t.adminTab === 'venues' }" @click="ui.setAdminTab('venues')"><Icon name="pin" :size="20" /><span>Venues</span></button>
      <button :class="{ on: t.adminTab === 'stores' }" @click="ui.setAdminTab('stores')"><Icon name="store" :size="20" /><span>Stores</span></button>
    </nav>
    <div class="m-main">
      <header class="m-top d-flex align-items-center flex-wrap gap-3">
        <div class="m-title d-flex flex-column flex-grow-1 overflow-hidden"><strong>Campus dining admin</strong><small>{{ me.name }} · {{ me.email }}</small></div>
        <StatCard label="Verified students" :value="activeStudents.length" />
        <StatCard label="Venues" :value="venues.length" />
        <StatCard label="Stores" :value="stores.length" />
      </header>
      <!-- The active sub-section, selected by the route. -->
      <RouterView />
    </div>
  </div>
</template>
