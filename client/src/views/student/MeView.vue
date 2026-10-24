<script setup>
// Your profile, stats and the "available for delivery jobs" switch.
//
// Migrated from portals/student/MeTab.vue. Renders in StudentLayout's persistent
// KeepAlive tab layer. Behaviour unchanged.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import StatusTag from '@/components/StatusTag.vue'
import { useOrdersStore } from '@/stores/orders.js'
import { useSessionStore } from '@/stores/session.js'
import * as E from '@/utils/engine.js'

const ui = useUiStore()
const orders = useOrdersStore()
const sessionStore = useSessionStore()
const { courierOn } = storeToRefs(ui)

const money = E.money
const me = computed(() => orders.me())
const stats = computed(() => ({ orders: orders.ordersOf(me.value.id).length, earn: orders.earnings() }))
</script>

<template>
  <div class="me-tab scroll">
    <div class="row justify-content-center mx-0">
    <div class="col-12 col-md-8 col-lg-6 px-0">
    <div class="me-card text-center"><Avatar :name="me.name" :size="64" tone="brand" /><h2>{{ me.name }}</h2><p>{{ me.email }}</p><StatusTag tone="ok"><Icon name="shield" :size="12" />Verified SMU student</StatusTag></div>
    <div class="panel me-stats row gx-2 mx-0"><div class="col-4"><b>{{ stats.orders }}</b><small>orders</small></div><div class="col-4"><b>{{ stats.earn.weekCount }}</b><small>deliveries this week</small></div><div class="col-4"><b>{{ money(stats.earn.week) }}</b><small>earned this week</small></div></div>
    <div class="panel me-list">
      <label class="me-row form-switch d-flex align-items-center justify-content-between gap-3 w-100"><span><strong class="d-block">Delivery jobs</strong><small class="d-block">Get notified when someone nearby wants food delivered</small></span><input class="form-check-input" type="checkbox" role="switch" :checked="courierOn" @change="orders.setAvailable($event.target.checked)"></label>
      <button type="button" class="me-row d-flex align-items-center justify-content-between gap-3 w-100 text-start" @click="sessionStore.signOut()"><span><strong class="d-block">Sign out</strong><small class="d-block">Switch to another account</small></span><Icon name="logout" :size="18" /></button>
    </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
/* Me tab: profile card, stats and the switch list (moved from the global
   stylesheet). The .me-tab padding + .panel stay global (shared). */
.me-card {
  padding: 20px 10px;
}
.me-card h2 {
  font-size: 21px;
  font-weight: 800;
  margin: 12px 0 2px;
}
.me-card p {
  color: var(--muted);
  margin: 0 0 10px;
}
.me-card :deep(.avatar) {
  margin: 0 auto;
}
.me-stats {
  text-align: center;
}
.me-stats b {
  display: block;
  font-size: 18px;
}
.me-stats small {
  color: var(--muted);
  font-size: 11.5px;
}
.me-tab .panel + .panel {
  margin-top: 10px;
}
.me-list {
  padding: 4px 14px;
}
.me-row {
  padding: 12px 0;
  border: 0;
  background: none;
  color: var(--ink);
  cursor: pointer;
  font-size: 14px;
}
.me-row + .me-row {
  border-top: 1px solid var(--line);
}
.me-row small {
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
  white-space: normal;
}
</style>
