<script setup>
// Deliver & earn: student couriers see open jobs, accept one, pick it up and deliver it.
//
// Migrated from portals/student/DeliverTab.vue. Renders in StudentLayout's persistent
// KeepAlive tab layer. Behaviour unchanged.
import { computed, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { shortName } from '@/utils/landmarks.js'
import { acquireStoreWait, releaseStoreWait, peekStoreWait } from '@/composables/storeWaitCache.js'
import StatusTag from '@/components/StatusTag.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { courierOn, now, busy } = storeToRefs(ui)

const money = E.money
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Live per-order ready time from the single frontend engine (store:<id>). We
// ref-count the jobs currently on screen so each order's queue estimate stays
// live, and derive readyAt on the frontend as now + seconds.
const waitKeys = new Set()
const keyStr = (storeId, orderId) => `${storeId}|${orderId}`
function jobReadyAt(storeId, orderId) {
  if (!storeId || !orderId) return null
  const entry = peekStoreWait(storeId, orderId)
  if (!entry || entry.loading || !entry.seconds) return null
  return now.value + entry.seconds * 1000
}

function jobView(d) {
  const s = catalog.store(d.pickup_store_id) || { name: 'Store', mono: '?', color: '#767d90', venue_id: null }
  const v = catalog.venue(s.venue_id)
  const drop = catalog.dropoff(d.destination_id) || { name: 'Drop-off point', lat: v ? v.lat : 0, lng: v ? v.lng : 0 }
  const est = jobReadyAt(d.pickup_store_id, d.order_id)
  return { d, o: d.order, s, v, vName: v ? shortName(v.name) : '', drop, walk: v ? E.walkEstimate(v, drop) : { meters: 0 }, items: d.order.items, est, left: d.expires_at - now.value }
}

const on = computed(() => courierOn.value)
const MAX_JOBS = 4
const activeList = computed(() => orders.activeJobs().map(jobView))
const atLimit = computed(() => activeList.value.length >= MAX_JOBS)
const jobs = computed(() => (on.value ? orders.openJobs().map(jobView) : []))
const expired = computed(() => (on.value ? orders.db.expiredJobs.map(jobView) : []))
const earn = computed(() => orders.earnings())

// Keep one live engine per visible job's (store, order); release the rest.
function syncJobWaits() {
  const wanted = new Map() // key -> { storeId, orderId }
  const add = (d) => { if (d && d.pickup_store_id && d.order_id) wanted.set(keyStr(d.pickup_store_id, d.order_id), { storeId: d.pickup_store_id, orderId: d.order_id }) }
  for (const d of orders.activeJobs()) add(d)
  if (on.value) { for (const d of orders.openJobs()) add(d) }
  for (const [k, { storeId, orderId }] of wanted) if (!waitKeys.has(k)) { acquireStoreWait(storeId, orderId); waitKeys.add(k) }
  for (const k of [...waitKeys]) if (!wanted.has(k)) { const [storeId, orderId] = k.split('|'); releaseStoreWait(storeId, orderId); waitKeys.delete(k) }
}
watch(
  () => [on.value, orders.db.jobs.map((j) => j.id).join(','), orders.db.myJobs.map((j) => j.id).join(',')],
  syncJobWaits,
  { immediate: true },
)
onBeforeUnmount(() => {
  for (const k of waitKeys) { const [storeId, orderId] = k.split('|'); releaseStoreWait(storeId, orderId) }
  waitKeys.clear()
})
</script>

<template>
  <div class="deliver scroll">
    <div class="container px-0">
    <header class="dl-head d-flex align-items-start justify-content-between gap-2 mb-3">
      <div>
        <h2 class="tab-title">Deliver &amp; earn</h2>
        <p class="mt-1 mb-0">Pick up food on your way and keep the delivery fee.</p>
      </div>
      <label class="form-check form-switch mb-0 small fw-bold text-nowrap"><input class="form-check-input" type="checkbox" role="switch" :checked="on"
          @change="orders.setAvailable($event.target.checked)"><span class="form-check-label">{{ on ? 'Available' : 'Offline' }}</span></label>
    </header>
    <div class="panel earn row gx-2 mx-0">
      <div class="col-6 d-flex flex-column"><small>Today</small><b>{{ money(earn.today) }}</b><span>{{ plural(earn.todayCount, 'delivery', 'deliveries')
          }}</span></div>
      <div class="col-6 d-flex flex-column"><small>Last 7 days</small><b>{{ money(earn.week) }}</b><span>{{ plural(earn.weekCount, 'delivery',
          'deliveries') }}</span></div>
    </div>

    <template v-if="activeList.length">
      <h4 class="sec">Current {{ activeList.length === 1 ? 'delivery' : 'deliveries' }} <span class="count">{{
        activeList.length }}/{{ MAX_JOBS }}</span></h4>
      <div class="row g-2">
      <div v-for="active in activeList" :key="active.d.id" class="col-12 col-md-6 col-lg-4">
      <div class="panel job active-job d-grid gap-2 h-100 align-content-start">
        <div class="d-flex align-items-center gap-2">
          <Mono :store="active.s" :size="36" />
          <div class="job-route flex-grow-1 overflow-hidden"><strong class="d-block">{{ active.s.name }}</strong><small>{{ active.vName }} → {{ active.drop.name
              }}</small></div><b class="fee">{{ money(active.d.fee) }}</b>
        </div>
        <strong>Order reference:  #{{ active.o.code }}</strong>
        <ol class="mini-steps list-unstyled d-flex gap-1 m-0">
          <li class="flex-fill done">Accepted</li>
          <li class="flex-fill" :class="active.d.status === 'picked_up' ? 'done' : 'now'">Picked up</li>
          <li class="flex-fill" :class="active.d.status === 'picked_up' ? 'now' : ''">Delivered</li>
        </ol>
        <p class="aj-line d-flex align-items-center gap-2 m-0" v-if="active.d.status === 'accepted' && active.o.status !== 'ready'">
          <Icon name="flame" :size="14" />Kitchen is cooking<template v-if="active.est">, ready ~{{ E.clock(active.est)
            }}</template>.
          Head to {{ active.vName }}.
        </p>
        <p class="aj-line ok d-flex align-items-center gap-2 m-0" v-else-if="active.d.status === 'accepted'">
          <Icon name="check" :size="14" />Food is ready at {{ active.s.name }}.
        </p>
        <p class="aj-line d-flex align-items-center gap-2 m-0" v-else>
          <Icon name="walk" :size="14" />Walk {{ active.walk.meters }} m to {{ active.drop.name }}.
        </p>
        <p v-if="active.d.note" class="aj-line d-flex align-items-center gap-2 m-0">
          <Icon name="mail" :size="14" />“{{ active.d.note }}”
        </p>
        <button v-if="active.d.status === 'accepted'" class="btn btn-primary w-100"
          :disabled="active.o.status !== 'ready' || busy[active.d.id]" @click="orders.pickUp(active.d.id)">{{
            active.o.status
              === 'ready' ? 'Picked up the food' : 'Waiting for the kitchen' }}</button>
        <button v-else class="btn btn-success w-100" :disabled="busy[active.d.id]"
          @click="orders.deliver(active.d.id)">Mark as
          delivered</button>
      </div>
      </div>
      </div>
    </template>

    <h4 class="sec">Jobs near you <span v-if="on" class="count">{{ jobs.length }}</span></h4>
    <div v-if="!on" class="empty">
      <Icon name="bike" :size="26" />
      <p>You're offline. Switch on Available to see jobs.</p>
    </div>
    <div v-else-if="!jobs.length && !expired.length" class="empty">
      <Icon name="check" :size="26" />
      <p>No open jobs right now. You'll get a notification when one comes in.</p>
    </div>
    <div class="row g-2">
    <div v-for="j in jobs" :key="j.d.id" class="col-12 col-md-6 col-lg-4">
    <div class="panel job d-grid gap-2 h-100 align-content-start">
      <div class="d-flex align-items-center gap-2">
        <Mono :store="j.s" :size="36" />
        <div class="job-route flex-grow-1 overflow-hidden"><strong class="d-block">{{ j.s.name }}</strong><small>{{ j.vName }} → {{ j.drop.name }}</small></div><b
          class="fee">{{ money(j.d.fee) }}</b>
      </div>
      <div class="d-flex flex-wrap gap-1"><StatusTag>{{ plural(j.items, 'item', 'items') }}</StatusTag><StatusTag>
          <Icon name="walk" :size="12" />{{ j.walk.meters }} m
        </StatusTag><StatusTag :tone="j.o.status === 'ready' ? 'ok' : ''">{{ j.o.status === 'ready' ? 'Food is ready' : (j.est ? 'Ready~' + E.clock(j.est) : 'In the kitchen') }}</StatusTag></div>
      <div class="job-timer d-flex align-items-center gap-2">
        <div class="meter flex-grow-1" :class="j.left < 120e3 ? 'late' : j.left < 300e3 ? 'warn' : 'ok'"><i
            :style="{ width: Math.max(0, j.left / (cfg.deliveryWindowMin * 600)) + '%' }"></i></div><small>Expires in {{
              E.countdown(j.left) }}</small>
      </div>
      <button class="btn btn-primary w-100" :disabled="atLimit || busy[j.d.id]" @click="orders.acceptJob(j.d.id)">{{
        atLimit
          ? 'Max ' + MAX_JOBS + ' jobs at once' : 'Accept job' }}</button>
    </div>
    </div>
    <div v-for="j in expired" :key="j.d.id" class="col-12 col-md-6 col-lg-4">
    <div class="panel job expired d-grid gap-2 h-100 align-content-start">
      <div class="d-flex align-items-center gap-2">
        <Mono :store="j.s" :size="36" />
        <div class="job-route flex-grow-1 overflow-hidden"><strong class="d-block">{{ j.s.name }}</strong><small>{{ j.vName }} → {{ j.drop.name }}</small></div>
        <StatusTag tone="warn">Expired</StatusTag>
      </div>
      <div class="job-timer d-flex align-items-center gap-2">
        <div class="meter late flex-grow-1"><i style="width:0"></i></div><small>Expired at {{ E.clock(j.d.expires_at) }}</small>
      </div>
      <p class="aj-line warn d-flex align-items-center gap-2 m-0">
        <Icon name="bag" :size="14" />Nobody accepted in {{ cfg.deliveryWindowMin }} min. Switched to pickup.
      </p>
    </div>
    </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
/* Deliver tab (moved from the global prototype stylesheet).
   Shared bits kept global: .deliver padding, .meter*,
   .panel, .sec, .count, .empty/.empty-note. */
.dl-head p {
  color: var(--ink-2);
  font-size: var(--fs-desc);
}

.earn {
  background: var(--navy);
  border: 0;
  color: #fff;
}

.earn small {
  opacity: 0.75;
  font-weight: 600;
}

.earn b {
  font-size: var(--fs-display);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.earn span {
  font-size: var(--fs-caption);
  opacity: 0.8;
}

.job-route strong {
  font-size: var(--fs-body);
}

.job-route small {
  color: var(--muted);
  font-size: var(--fs-caption);
}

.fee {
  font-size: var(--fs-heading);
  color: var(--ok);
}

.job-timer small {
  font-size: var(--fs-caption);
  font-weight: 700;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.job.expired {
  opacity: 0.7;
}

.active-job {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.mini-steps li {
  text-align: center;
  font-size: var(--fs-caption);
  font-weight: 700;
  color: var(--muted);
  padding: 5px 0;
  border-radius: 10px;
  background: var(--canvas);
}

.mini-steps li.done {
  background: var(--ok-soft);
  color: var(--ok);
}

.mini-steps li.now {
  background: var(--brand-soft);
  color: var(--brand-600);
}

.aj-line {
  font-size: var(--fs-desc);
  font-weight: 600;
  color: var(--ink-2);
}

.aj-line.ok {
  color: var(--ok);
}

.aj-line.warn {
  color: var(--warn);
}
</style>
