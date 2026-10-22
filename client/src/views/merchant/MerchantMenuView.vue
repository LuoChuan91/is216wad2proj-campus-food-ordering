<script setup>
// Merchant menu body: the sold-out switches.
//
// Migrated from the menu half of portals/merchant/MerchantApp.vue. The rail, store
// header and realtime layer live in the MerchantView shell; this is the routed body
// for #/merchant/menu. The active store comes from the shell via inject.
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { busy } = storeToRefs(ui)
const money = E.money
const store = inject('merchantStore')
const menu = computed(() => catalog.menuOf(store.value.id).map((m) => ({ m, groups: (m.option_groups || []).length })))
</script>

<template>
  <div class="m-menu scroll">
    <p class="m-hint">Switching an item off hides it from students straight away. Cook time and "at once" feed the wait-time estimate.</p>
    <div v-for="x in menu" :key="x.m.id" class="mrow">
      <div><strong>{{ x.m.name }}</strong><small>{{ money(x.m.price) }} · {{ x.m.category }} · {{ x.groups ? x.groups + (x.groups === 1 ? ' option group' : ' option groups') : 'no options' }} · {{ Math.max(1, Math.round(x.m.cook_time_sec / 60)) }} min, {{ x.m.max_at_once }} at once</small></div>
      <label class="form-switch"><input class="form-check-input" type="checkbox" role="switch" :checked="x.m.available" :disabled="busy[x.m.id]" @change="orders.setItemAvailable(x.m.id, $event.target.checked)"><span>{{ x.m.available ? 'Available' : 'Sold out' }}</span></label>
    </div>
  </div>
</template>

<style scoped>
/* Merchant menu list (moved from the global prototype stylesheet). */
.m-menu {
  flex: 1;
  padding: 14px 18px;
  display: grid;
  gap: 8px;
  align-content: start;
  max-width: 900px;
  width: 100%;
}
.m-hint {
  color: var(--muted);
  margin: 0 0 4px;
}
.mrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 12px 14px;
}
.mrow strong {
  display: block;
  font-size: 14px;
}
.mrow small {
  color: var(--muted);
}
</style>
