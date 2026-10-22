<script setup>
// Admin stores body: every store on campus.
//
// Migrated from the stores half of portals/admin/AdminApp.vue. The rail and header
// live in the AdminView shell; this is the routed body for #/admin/stores.
import { computed } from 'vue'
import { S, Q } from '@/stores/compat.js'
import * as E from '@/utils/engine.js'
import StatusTag from '@/components/StatusTag.vue'

const stores = computed(() => S.db.stores.map((s) => {
  const w = S.waits.stores[s.id]
  return { s, v: Q.venue(s.venue_id), m: Q.user(s.merchant_id), open: Q.open(s), waiting: w ? w.ahead : 0 }
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
