<script setup>
// Merchant menu body: the sold-out switches.
//
// Migrated from the menu half of portals/merchant/MerchantApp.vue. The rail, store
// header and realtime layer live in the MerchantView shell; this is the routed body
// for #/merchant/menu. The active store comes from the shell via inject.
import { computed, inject } from 'vue'
import { S, Q, A } from '@/stores/compat.js'
import * as E from '@/utils/engine.js'

const money = E.money
const store = inject('merchantStore')
const menu = computed(() => Q.menu(store.value.id).map((m) => ({ m, groups: (m.option_groups || []).length })))
</script>

<template>
  <div class="m-menu scroll">
    <p class="m-hint">Switching an item off hides it from students straight away. Cook time and "at once" feed the wait-time estimate.</p>
    <div v-for="x in menu" :key="x.m.id" class="mrow">
      <div><strong>{{ x.m.name }}</strong><small>{{ money(x.m.price) }} · {{ x.m.category }} · {{ x.groups ? x.groups + (x.groups === 1 ? ' option group' : ' option groups') : 'no options' }} · {{ Math.max(1, Math.round(x.m.cook_time_sec / 60)) }} min, {{ x.m.max_at_once }} at once</small></div>
      <label class="form-switch"><input class="form-check-input" type="checkbox" role="switch" :checked="x.m.available" :disabled="S.busy[x.m.id]" @change="A.setItemAvailable(x.m.id, $event.target.checked)"><span>{{ x.m.available ? 'Available' : 'Sold out' }}</span></label>
    </div>
  </div>
</template>
