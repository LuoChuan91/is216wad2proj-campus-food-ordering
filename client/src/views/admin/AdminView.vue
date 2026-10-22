<script setup>
// Admin portal shell (campus dining office): the rail and the header.
//
// Migrated from portals/admin/AdminApp.vue. The shell (rail + header) stays here and
// renders the active sub-section (approvals / venues / stores) through <RouterView>,
// which vue-router selects from the URL (#/admin, #/admin/venues, #/admin/stores).
// The pending count the rail badge needs is computed here and provided down.
import { computed, provide } from 'vue'
import { S, Q, A } from '@/stores/compat.js'
import StatCard from '@/components/StatCard.vue'

const t = computed(() => S.ui.staff)
const me = computed(() => Q.me())
const students = computed(() => S.db.profiles.filter((p) => p.role === 'student'))
const pending = computed(() => students.value.filter((p) => p.status === 'inactive'))
const activeStudents = computed(() => students.value.filter((p) => p.status === 'active'))

provide('adminPending', pending)
</script>

<template>
  <div class="app admin">
    <nav class="rail" aria-label="Admin sections">
      <button :class="{ on: t.adminTab === 'approvals' }" @click="A.setAdminTab('approvals')"><span class="tab-ic"><Icon name="users" :size="20" /><b v-if="pending.length" class="tab-dot">{{ pending.length }}</b></span><span>Students</span></button>
      <button :class="{ on: t.adminTab === 'venues' }" @click="A.setAdminTab('venues')"><Icon name="pin" :size="20" /><span>Venues</span></button>
      <button :class="{ on: t.adminTab === 'stores' }" @click="A.setAdminTab('stores')"><Icon name="store" :size="20" /><span>Stores</span></button>
    </nav>
    <div class="m-main">
      <header class="m-top">
        <div class="m-title"><strong>Campus dining admin</strong><small>{{ me.name }} · {{ me.email }}</small></div>
        <StatCard label="Verified students" :value="activeStudents.length" />
        <StatCard label="Venues" :value="S.db.venues.length" />
        <StatCard label="Stores" :value="S.db.stores.length" />
      </header>
      <!-- The active sub-section, selected by the route. -->
      <RouterView />
    </div>
  </div>
</template>
