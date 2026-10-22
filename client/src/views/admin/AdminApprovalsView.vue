<script setup>
// Admin approvals body: approve or block student accounts.
//
// Migrated from the approvals half of portals/admin/AdminApp.vue. The rail and header
// live in the AdminView shell; this is the routed body for #/admin.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import AdmRow from '@/components/AdmRow.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { busy } = storeToRefs(ui)

const students = computed(() => catalog.db.profiles.filter((p) => p.role === 'student'))
const pending = computed(() => students.value.filter((p) => p.status === 'inactive'))
const activeStudents = computed(() => students.value.filter((p) => p.status === 'active'))
const rejected = computed(() => students.value.filter((p) => p.status === 'blocked' || p.status === 'removed'))
</script>

<template>
  <div class="adm scroll">
    <h4>Waiting for approval <span class="count">{{ pending.length }}</span></h4>
    <AdmRow v-for="p in pending" :key="p.id" :profile="p" tone="brand" tag-tone="info" tag-text="Student">
      <button class="btn btn-outline-secondary btn-sm" :disabled="busy[p.id]" @click="orders.rejectStudent(p.id)">Reject</button>
      <button class="btn btn-primary btn-sm" :disabled="busy[p.id]" @click="orders.approveStudent(p.id)">Approve</button>
    </AdmRow>
    <p v-if="!pending.length" class="col-empty">Nobody is waiting. New accounts appear here.</p>
    <h4>Verified students <span class="count">{{ activeStudents.length }}</span></h4>
    <AdmRow v-for="p in activeStudents" :key="p.id" :profile="p" done tag-tone="ok" tag-text="Approved" tag-check>
      <button class="btn btn-outline-secondary btn-sm" :disabled="busy[p.id]" @click="orders.rejectStudent(p.id)">Block</button>
    </AdmRow>
    <template v-if="rejected.length">
      <h4>Blocked or removed</h4>
      <AdmRow v-for="p in rejected" :key="p.id" :profile="p" done show-status :actions="false">
        <button class="btn btn-outline-secondary btn-sm" :disabled="busy[p.id]" @click="orders.approveStudent(p.id)">Approve after all</button>
      </AdmRow>
    </template>
  </div>
</template>
