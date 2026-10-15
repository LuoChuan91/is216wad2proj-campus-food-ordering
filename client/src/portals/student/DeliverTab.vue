<script setup>
// Deliver & earn: student couriers see open jobs, accept one, pick it up and deliver it
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'
import { config as cfg } from '../../app/config'
import { shortName } from '../../app/landmarks'

const money = E.money
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function jobView(d) {
  const s = Q.store(d.pickup_store_id) || { name: 'Store', mono: '?', color: '#767d90', venue_id: null }
  const v = Q.venue(s.venue_id)
  const drop = Q.dropoff(d.destination_id) || { name: 'Drop-off point', lat: v ? v.lat : 0, lng: v ? v.lng : 0 }
  const est = (S.waits.orders[d.order_id] || {}).readyAt
  return { d, o: d.order, s, v, vName: v ? shortName(v.name) : '', drop, walk: v ? E.walkEstimate(v, drop) : { meters: 0 }, items: d.order.items, est, left: d.expires_at - S.now }
}

const on = computed(() => S.courierOn)
const active = computed(() => { const d = Q.activeJob(); return d ? jobView(d) : null })
const jobs = computed(() => (on.value ? Q.openJobs().map(jobView) : []))
const expired = computed(() => (on.value ? S.db.expiredJobs.map(jobView) : []))
const earn = computed(() => Q.earnings())
</script>

<template>
  <div class="deliver scroll">
    <header class="dl-head">
      <div><h2 class="tab-title">Deliver &amp; earn</h2><p>Pick up food on your way and keep the delivery fee.</p></div>
      <label class="avail form-switch"><input class="form-check-input" type="checkbox" role="switch" :checked="on" @change="A.setAvailable($event.target.checked)"><span>{{ on ? 'Available' : 'Offline' }}</span></label>
    </header>
    <div class="panel earn">
      <div><small>Today</small><b>{{ money(earn.today) }}</b><span>{{ plural(earn.todayCount, 'delivery', 'deliveries') }}</span></div>
      <div><small>Last 7 days</small><b>{{ money(earn.week) }}</b><span>{{ plural(earn.weekCount, 'delivery', 'deliveries') }}</span></div>
    </div>
    <template v-if="active">
      <h4 class="sec">Current delivery</h4>
      <div class="panel job active-job">
        <div class="job-top"><Mono :store="active.s" :size="36" /><div class="job-route"><strong>{{ active.s.name }}</strong><small>{{ active.vName }} → {{ active.drop.name }}</small></div><b class="fee">{{ money(active.d.fee) }}</b></div>
        <ol class="mini-steps">
          <li class="done">Accepted</li>
          <li :class="active.d.status === 'picked_up' ? 'done' : 'now'">Picked up</li>
          <li :class="active.d.status === 'picked_up' ? 'now' : ''">Delivered</li>
        </ol>
        <p class="aj-line" v-if="active.d.status === 'accepted' && active.o.status !== 'ready'"><Icon name="flame" :size="14" />Kitchen is cooking<template v-if="active.est">, ready ~{{ E.clock(active.est) }}</template>. Head to {{ active.vName }}.</p>
        <p class="aj-line ok" v-else-if="active.d.status === 'accepted'"><Icon name="check" :size="14" />Food is ready at {{ active.s.name }}.</p>
        <p class="aj-line" v-else><Icon name="walk" :size="14" />Walk {{ active.walk.meters }} m to {{ active.drop.name }}.</p>
        <p v-if="active.d.note" class="aj-line"><Icon name="mail" :size="14" />“{{ active.d.note }}”</p>
        <button v-if="active.d.status === 'accepted'" class="btn btn-primary w-100" :disabled="active.o.status !== 'ready' || S.busy[active.d.id]" @click="A.pickUp(active.d.id)">{{ active.o.status === 'ready' ? 'Picked up the food' : 'Waiting for the kitchen' }}</button>
        <button v-else class="btn btn-success w-100" :disabled="S.busy[active.d.id]" @click="A.deliver(active.d.id)">Mark as delivered</button>
      </div>
    </template>
    <h4 class="sec">Jobs near you <span v-if="on" class="count">{{ jobs.length }}</span></h4>
    <div v-if="!on" class="empty"><Icon name="bike" :size="26" /><p>You're offline. Switch on Available to see jobs.</p></div>
    <div v-else-if="!jobs.length && !expired.length" class="empty"><Icon name="check" :size="26" /><p>No open jobs right now. You'll get a notification when one comes in.</p></div>
    <div v-for="j in jobs" :key="j.d.id" class="panel job">
      <div class="job-top"><Mono :store="j.s" :size="36" /><div class="job-route"><strong>{{ j.s.name }}</strong><small>{{ j.vName }} → {{ j.drop.name }}</small></div><b class="fee">{{ money(j.d.fee) }}</b></div>
      <div class="job-meta"><span>{{ plural(j.items, 'item', 'items') }}</span><span><Icon name="walk" :size="12" />{{ j.walk.meters }} m</span><span :class="{ ok: j.o.status === 'ready' }">{{ j.o.status === 'ready' ? 'Food is ready' : (j.est ? 'Ready ~' + E.clock(j.est) : 'In the kitchen') }}</span></div>
      <div class="job-timer"><div class="meter" :class="j.left < 120e3 ? 'late' : j.left < 300e3 ? 'warn' : 'ok'"><i :style="{ width: Math.max(0, j.left / (cfg.deliveryWindowMin * 600)) + '%' }"></i></div><small>Expires in {{ E.countdown(j.left) }}</small></div>
      <button class="btn btn-primary w-100" :disabled="!!active || S.busy[j.d.id]" @click="A.acceptJob(j.d.id)">{{ active ? 'Finish your current delivery first' : 'Accept job' }}</button>
    </div>
    <div v-for="j in expired" :key="j.d.id" class="panel job expired">
      <div class="job-top"><Mono :store="j.s" :size="36" /><div class="job-route"><strong>{{ j.s.name }}</strong><small>{{ j.vName }} → {{ j.drop.name }}</small></div><span class="tag warn">Expired</span></div>
      <div class="job-timer"><div class="meter late"><i style="width:0"></i></div><small>Expired at {{ E.clock(j.d.expires_at) }}</small></div>
      <p class="aj-line warn"><Icon name="bag" :size="14" />Nobody accepted in {{ cfg.deliveryWindowMin }} min. Switched to pickup.</p>
    </div>
  </div>
</template>
