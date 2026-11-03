<script setup>
// Admin approvals body: approve or block student accounts.
//
// Migrated from the approvals half of portals/admin/AdminApp.vue. The rail and header
// live in the AdminView shell; this is the routed body for #/admin.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useAdminStore } from '@/stores/admin.js'
import AdmRow from '@/components/AdmRow.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const admin = useAdminStore()
const { busy } = storeToRefs(ui)

const students = computed(() => catalog.db.profiles.filter((p) => p.role === 'student'))
const pending = computed(() => students.value.filter((p) => p.status === 'inactive'))
const activeStudents = computed(() => students.value.filter((p) => p.status === 'active'))
const rejected = computed(() => students.value.filter((p) => p.status === 'blocked' || p.status === 'removed'))
</script>

<template>
  <div class="adm scroll">
    <p v-if="!pending.length" class="col-empty">Nobody is waiting. New accounts appear here.</p>
    <h4>Active / Inactive students <span class="count">{{ activeStudents.length }}</span></h4>
    <AdmRow v-for="p in activeStudents" :key="p.id" :profile="p" done tag-tone="ok" tag-text="Active Student" tag-check>
      <button class="btn btn-outline-warning btn-sm" :disabled="busy[p.id]" @click="admin.blockStudent(p.id)">Block</button>
      <button class="btn btn-outline-danger btn-sm" :disabled="busy[p.id]" @click="admin.removeStudent(p.id)">Remove</button>
    </AdmRow>
    <AdmRow v-for="p in pending" :key="p.id" :profile="p" tone="brand" tag-tone="info" tag-text="Inactive Student">
    </AdmRow>
    <template v-if="rejected.length">
      <h4>Blocked or removed</h4>
      <AdmRow v-for="p in rejected" :key="p.id" :profile="p" done show-status :actions="false">
        <button class="btn btn-outline-secondary btn-sm" :disabled="busy[p.id]" @click="admin.approveStudent(p.id)">Approve after all</button>
      </AdmRow>
    </template>
  </div>
</template>
