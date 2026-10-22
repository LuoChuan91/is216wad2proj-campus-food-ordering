<script setup>
// Your profile, stats and the "available for delivery jobs" switch.
//
// Migrated from portals/student/MeTab.vue. Renders in StudentLayout's persistent
// KeepAlive tab layer. Behaviour unchanged.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
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
    <div class="me-card"><Avatar :name="me.name" :size="64" tone="brand" /><h2>{{ me.name }}</h2><p>{{ me.email }}</p><span class="tag ok"><Icon name="shield" :size="12" />Verified SMU student</span></div>
    <div class="panel me-stats"><div><b>{{ stats.orders }}</b><small>orders</small></div><div><b>{{ stats.earn.weekCount }}</b><small>deliveries this week</small></div><div><b>{{ money(stats.earn.week) }}</b><small>earned this week</small></div></div>
    <div class="panel me-list">
      <label class="me-row form-switch"><span><strong>Delivery jobs</strong><small>Get notified when someone nearby wants food delivered</small></span><input class="form-check-input" type="checkbox" role="switch" :checked="courierOn" @change="orders.setAvailable($event.target.checked)"></label>
      <button type="button" class="me-row" @click="sessionStore.signOut()"><span><strong>Sign out</strong><small>Switch to another account</small></span><Icon name="logout" :size="18" /></button>
    </div>
  </div>
</template>
