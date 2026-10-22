<script setup>
// Admin stores body: every store on campus.
//
// Migrated from the stores half of portals/admin/AdminApp.vue. The rail and header
// live in the AdminView shell; this is the routed body for #/admin/stores.
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'
import StatusTag from '@/components/StatusTag.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()

const stores = computed(() => catalog.db.stores.map((s) => {
  const w = orders.waits.stores[s.id]
  return { s, v: catalog.venue(s.venue_id), m: catalog.user(s.merchant_id), open: ui.open(s), waiting: w ? w.ahead : 0 }
}))
</script>

<template>
  <div class="adm scroll">
    <div class="table-wrap">
      <table class="adm-table">
        <thead><tr><th>Store</th><th>Venue</th><th>Merchant account</th><th>Discount</th><th>Queue</th><th>Status</th></tr></thead>
        <tbody><tr v-for="x in stores" :key="x.s.id"><td><Mono :store="x.s" :size="24" /> {{ x.s.name }}</td><td>{{ x.v ? x.v.name : '–' }}</td><td>{{ x.m ? x.m.email : '–' }}</td><td>{{ E.discountShort(x.s) || '–' }}</td><td>{{ x.waiting }}</td><td><StatusTag :tone="x.open.open ? 'ok' : 'muted'">{{ x.open.open ? 'Open' : 'Closed' }}</StatusTag></td></tr></tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* Admin stores table (moved from the global prototype stylesheet).
   The .adm wrapper + .scroll stay global (shared with the approvals view). */
.table-wrap {
  overflow-x: auto;
  margin-top: 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper);
}
.adm-table {
  width: 100%;
  min-width: 640px;
  border-collapse: separate;
  border-spacing: 0;
}
.adm-table th {
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  background: #f8f9fc;
}
.adm-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}
.adm-table td :deep(.mono) {
  vertical-align: middle;
  margin-right: 6px;
}
.adm-table tr:last-child td {
  border-bottom: 0;
}
</style>
