<script setup>
// Merchant order board body (New → Cooking → Ready).
//
// Migrated from the orders half of portals/merchant/MerchantApp.vue. The rail, the
// store header and the realtime layer live in the MerchantView shell; this is the
// routed body for #/merchant. The active store and the gone() helper come from the
// shell via inject. The store's live wait estimates still feed each card.
import { computed, inject, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useOrdersStore } from '@/stores/orders.js'
import { useUiStore } from '@/stores/ui.js'
import { useMerchantStore } from '@/stores/merchant.js'
import { waitSettings, MERCHANT_STRATEGIES } from '@/utils/waitSettings.js'
import OrderCard from '@/portals/merchant/OrderCard.vue'

const STRATEGY_LABELS = {
  serial: 'Serial: one dish after another',
  scheduled: 'Scheduled: dishes share the workstations',
}

const orders = useOrdersStore()
const ui = useUiStore()
const merchant = useMerchantStore()
const { busy } = storeToRefs(ui)
const store = inject('merchantStore')
const gone = inject('merchantGone')
// Per-order ready-time estimates from the single frontend engine, provided by the
// MerchantView shell as { [orderId]: { readyAt } }.
const est = inject('merchantEst', computed(() => ({})))
const waiting = (o) => o.status === 'paid' || o.status === 'preparing'
const onBoard = computed(() => orders.db.orders
  .filter((o) => o.store_id === store.value.id)
  .filter((o) => waiting(o) || (o.status === 'ready' && !gone(o)))
  .sort((a, b) => a.created_at - b.created_at))
const saved = computed(() => waitSettings(store.value.id))
const stations = ref(2)
const strategy = ref('scheduled')
watch(() => JSON.stringify(saved.value), () => { stations.value = saved.value.stations; strategy.value = saved.value.strategy }, { immediate: true })
const stationsValid = computed(() => Number.isInteger(stations.value) && stations.value >= 1 && stations.value <= 20)
const dirty = computed(() => stations.value !== saved.value.stations || strategy.value !== saved.value.strategy)
const busyKey = computed(() => store.value.id + ':wait')
const step = (n) => { stations.value = Math.min(20, Math.max(1, (Number(stations.value) || 1) + n)) }

async function saveSettings() {
  if (!stationsValid.value) return
  const ok = await ui.run(busyKey.value, () => merchant.saveStore(store.value.id, { workstations: stations.value, wait_strategy: strategy.value }))
  if (ok) ui.notify('Wait-time settings saved', `${stations.value} workstation${stations.value === 1 ? '' : 's'}, ${strategy.value}`, 'ok')
}

const cols = computed(() => [
  { k: 'paid', title: 'New', list: onBoard.value.filter((o) => o.status === 'paid') },
  { k: 'preparing', title: 'Cooking', list: onBoard.value.filter((o) => o.status === 'preparing') },
  { k: 'ready', title: 'Ready', list: onBoard.value.filter((o) => o.status === 'ready') },
])
</script>

<template>
  <div class="orders d-flex flex-column flex-grow-1">
    <form class="wait-bar d-flex align-items-center flex-wrap gap-3" novalidate @submit.prevent="saveSettings">
      <div class="d-flex align-items-center gap-2">
        <label for="ws-count" class="fw-bold small mb-0">Workstations</label>
        <div class="input-group input-group-sm ws">
          <button type="button" class="btn btn-outline-secondary" aria-label="Fewer workstations" :disabled="stations <= 1" @click="step(-1)">−</button>
          <input id="ws-count" v-model.number="stations" type="number" min="1" max="20" step="1" class="form-control text-center" :class="{ 'is-invalid': !stationsValid }">
          <button type="button" class="btn btn-outline-secondary" aria-label="More workstations" :disabled="stations >= 20" @click="step(1)">+</button>
        </div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <label for="ws-strategy" class="fw-bold small mb-0">Estimate</label>
        <select id="ws-strategy" v-model="strategy" class="form-select form-select-sm w-auto">
          <option v-for="s in MERCHANT_STRATEGIES" :key="s" :value="s">{{ STRATEGY_LABELS[s] }}</option>
        </select>
      </div>
      <button type="submit" class="btn btn-sm btn-primary" :disabled="!dirty || !stationsValid || busy[busyKey]">{{ busy[busyKey] ? 'Saving…' : 'Save' }}</button>
      <small v-if="!stationsValid" class="text-danger">Use a whole number from 1 to 20.</small>
      <small v-else-if="strategy === 'serial'" class="text-body-secondary">Serial estimates ignore the workstation count.</small>
    </form>
    <div class="board">
      <div class="row gx-3 h-100">
        <div v-for="c in cols" :key="c.k" class="col-4 h-100">
          <section class="kcol h-100" :class="'col-' + c.k">
            <h5>{{ c.title }} <span>{{ c.list.length }}</span></h5>
            <div class="col-list scroll">
              <OrderCard v-for="o in c.list" :key="o.id" :o="o" :est="est[o.id]" />
              <p v-if="!c.list.length" class="col-empty">No orders</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Kitchen order board (moved from the global prototype stylesheet).
   .col-empty stays global — it is shared with the admin lists. */
.orders {
  min-height: 0;
}
.wait-bar {
  padding: 10px 14px 0;
}
.ws {
  width: 120px;
}
.board {
  flex: 1;
  min-height: 0;
  padding: 14px;
}
.kcol {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #eaecf3;
  border-radius: 16px;
  padding: 8px;
}
.kcol h5 {
  font-size: 12.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 2px 4px 8px;
  display: flex;
  justify-content: space-between;
  color: var(--ink-2);
  font-weight: 800;
}
.kcol h5 span {
  background: var(--paper);
  border-radius: 999px;
  padding: 0 8px;
  color: var(--ink);
}
.col-preparing h5 {
  color: var(--brand-600);
}
.col-ready h5 {
  color: var(--ok);
}
.col-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
