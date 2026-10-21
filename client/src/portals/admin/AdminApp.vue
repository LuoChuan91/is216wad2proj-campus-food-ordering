<script setup>
// Admin portal (campus dining office): approve or block student accounts, add venues on the map,
// and see every store.
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'
import AdminMap from './AdminMap.vue'

const t = computed(() => S.ui.staff)
const me = computed(() => Q.me())
const students = computed(() => S.db.profiles.filter((p) => p.role === 'student'))
const pending = computed(() => students.value.filter((p) => p.status === 'inactive'))
const activeStudents = computed(() => students.value.filter((p) => p.status === 'active'))
const rejected = computed(() => students.value.filter((p) => p.status === 'blocked' || p.status === 'removed'))
const venues = computed(() => S.db.venues.map((v) => ({ v, stores: Q.storesAt(v.id).length })))
const stores = computed(() => S.db.stores.map((s) => {
  const w = S.waits.stores[s.id]
  return { s, v: Q.venue(s.venue_id), m: Q.user(s.merchant_id), open: Q.open(s), waiting: w ? w.ahead : 0 }
}))
</script>

<template>
  <div class="app admin">
    <nav class="rail" aria-label="Admin sections">
      <button :class="{ on: t.adminTab === 'approvals' }" @click="A.setAdminTab('approvals')"><span class="tab-ic"><Icon name="users" :size="20" /><b v-if="pending.length" class="tab-dot">{{ pending.length }}</b></span><span>Students</span></button>
      <button :class="{ on: t.adminTab === 'venues' }" @click="A.setAdminTab('venues')"><Icon name="pin" :size="20" /><span>Venues</span></button>
      <button :class="{ on: t.adminTab === 'stores' }" @click="A.setAdminTab('stores')"><Icon name="store" :size="20" /><span>Stores</span></button>
    </nav>
    <div class="m-main">
      <header class="m-top">
        <div class="m-title"><strong>Campus dining admin</strong><small>{{ me.name }} · {{ me.email }}</small></div>
        <div class="m-stat"><small>Verified students</small><b>{{ activeStudents.length }}</b></div>
        <div class="m-stat"><small>Venues</small><b>{{ S.db.venues.length }}</b></div>
        <div class="m-stat"><small>Stores</small><b>{{ S.db.stores.length }}</b></div>
      </header>
      <div v-if="t.adminTab === 'approvals'" class="adm scroll">
        <h4>Waiting for approval <span class="count">{{ pending.length }}</span></h4>
        <div v-for="p in pending" :key="p.id" class="adm-row">
          <Avatar :name="p.name" :size="40" tone="brand" />
          <div class="adm-who"><strong>{{ p.name }}</strong><small>{{ p.email }}</small></div>
          <span class="tag info">Student</span>
          <div class="adm-actions">
            <button class="btn btn-outline-secondary btn-sm" :disabled="S.busy[p.id]" @click="A.rejectStudent(p.id)">Reject</button>
            <button class="btn btn-primary btn-sm" :disabled="S.busy[p.id]" @click="A.approveStudent(p.id)">Approve</button>
          </div>
        </div>
        <p v-if="!pending.length" class="col-empty">Nobody is waiting. New accounts appear here.</p>
        <h4>Verified students <span class="count">{{ activeStudents.length }}</span></h4>
        <div v-for="p in activeStudents" :key="p.id" class="adm-row done">
          <Avatar :name="p.name" :size="40" />
          <div class="adm-who"><strong>{{ p.name }}</strong><small>{{ p.email }}</small></div>
          <span class="tag ok"><Icon name="check" :size="11" />Approved</span>
          <div class="adm-actions"><button class="btn btn-outline-secondary btn-sm" :disabled="S.busy[p.id]" @click="A.rejectStudent(p.id)">Block</button></div>
        </div>
        <template v-if="rejected.length">
          <h4>Blocked or removed</h4>
          <div v-for="p in rejected" :key="p.id" class="adm-row done">
            <Avatar :name="p.name" :size="40" />
            <div class="adm-who"><strong>{{ p.name }}</strong><small>{{ p.email }} · {{ p.status }}</small></div>
            <button class="btn btn-outline-secondary btn-sm" :disabled="S.busy[p.id]" @click="A.approveStudent(p.id)">Approve after all</button>
          </div>
        </template>
      </div>
      <div v-else-if="t.adminTab === 'venues'" class="adm-venues">
        <div class="av-side scroll">
          <form class="av-form" @submit.prevent="A.addVenue()">
            <strong>Add a venue</strong>
            <label for="venue-name">Name</label>
            <input id="venue-name" class="form-control form-control-sm" placeholder="e.g. SMU Labs" :value="t.venueDraft.name" @input="A.setVenueDraft('name', $event.target.value)">
            <div class="av-ll"><span>{{ t.venueDraft.lat ? t.venueDraft.lat + ', ' + t.venueDraft.lng : 'Click the map to drop the pin' }}</span></div>
            <p v-if="t.formError" class="av-err">{{ t.formError }}</p>
            <button class="btn btn-primary btn-sm w-100" type="submit" :disabled="t.saving">{{ t.saving ? 'Adding…' : 'Add venue' }}</button>
          </form>
          <div v-for="x in venues" :key="x.v.id" class="av-row"><Icon name="pin" :size="14" /><div><strong>{{ x.v.name }}</strong><small>{{ x.stores }} {{ x.stores === 1 ? 'store' : 'stores' }} · {{ Number(x.v.lat).toFixed(4) }}, {{ Number(x.v.lng).toFixed(4) }}</small></div></div>
        </div>
        <AdminMap />
      </div>
      <div v-else class="adm scroll">
        <div class="table-wrap">
          <table class="adm-table">
            <thead><tr><th>Store</th><th>Venue</th><th>Merchant account</th><th>Discount</th><th>Queue</th><th>Status</th></tr></thead>
            <tbody><tr v-for="x in stores" :key="x.s.id"><td><Mono :store="x.s" :size="24" /> {{ x.s.name }}</td><td>{{ x.v ? x.v.name : '–' }}</td><td>{{ x.m ? x.m.email : '–' }}</td><td>{{ E.discountShort(x.s) || '–' }}</td><td>{{ x.waiting }}</td><td><span class="tag" :class="x.open.open ? 'ok' : 'muted'">{{ x.open.open ? 'Open' : 'Closed' }}</span></td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
