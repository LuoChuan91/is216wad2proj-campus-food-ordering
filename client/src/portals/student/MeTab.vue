<script setup>
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'

const money = E.money
const me = computed(() => Q.me())
const stats = computed(() => ({ orders: Q.ordersOf(me.value.id).length, earn: Q.earnings() }))
</script>

<template>
  <div class="me-tab scroll">
    <div class="me-card"><Avatar :name="me.name" :size="64" tone="brand" /><h2>{{ me.name }}</h2><p>{{ me.email }}</p><span class="tag ok"><Icon name="shield" :size="12" />Verified SMU student</span></div>
    <div class="panel me-stats"><div><b>{{ stats.orders }}</b><small>orders</small></div><div><b>{{ stats.earn.weekCount }}</b><small>deliveries this week</small></div><div><b>{{ money(stats.earn.week) }}</b><small>earned this week</small></div></div>
    <div class="panel me-list">
      <label class="me-row form-switch"><span><strong>Delivery jobs</strong><small>Get notified when someone nearby wants food delivered</small></span><input class="form-check-input" type="checkbox" role="switch" :checked="S.courierOn" @change="A.setAvailable($event.target.checked)"></label>
      <button type="button" class="me-row" @click="A.signOut()"><span><strong>Sign out</strong><small>Switch to another account</small></span><Icon name="logout" :size="18" /></button>
    </div>
  </div>
</template>
