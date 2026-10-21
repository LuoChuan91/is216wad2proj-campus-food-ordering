<script setup>
// Stores: every store on campus in one list (like Grab's restaurant list), with search,
// quick filters by category and a sort. Uses the same cards as the venue sheet.
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'
import { shortName } from '../../app/landmarks'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'

const u = computed(() => S.ui.student)
const list = computed(() => u.value.list)

// Filter chips: All, Open now, Offers, then every menu category (Noodles, Drinks, Bento Sets…)
const categories = computed(() => [...new Set(S.db.menu.map((m) => m.category))].sort())
const chips = computed(() => [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open now' },
  { id: 'offers', label: 'Offers' },
  ...categories.value.map((c) => ({ id: 'cat:' + c, label: c })),
])
const SORTS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'nearest', label: 'Nearest' },
  { id: 'wait', label: 'Shortest wait' },
  { id: 'name', label: 'A to Z' },
]

const rows = computed(() => S.db.stores.map((s) => {
  const v = Q.venue(s.venue_id)
  return { s, v, open: Q.open(s), wait: Q.storeWait(s.id), walk: v ? Q.walk(v) : null, cats: Q.menu(s.id).map((m) => m.category) }
}))

const shown = computed(() => {
  const q = list.value.search.trim().toLowerCase()
  const hit = (t) => String(t || '').toLowerCase().includes(q)
  const f = list.value.filter
  let out = rows.value.filter((r) => {
    if (q && !(hit(r.s.name) || hit(r.s.cuisine) || hit(r.s.description) || (r.v && hit(r.v.name)) || Q.menu(r.s.id).some((m) => hit(m.name)))) return false
    if (f === 'open') return r.open.open
    if (f === 'offers') return !!r.s.discount_type
    if (f.startsWith('cat:')) return r.cats.includes(f.slice(4))
    return true
  })
  const waitOf = (r) => (r.open.open && r.wait ? r.wait.minutes : 999)
  const walkOf = (r) => (r.walk ? r.walk.meters : 99999)
  const sorts = {
    recommended: (a, b) => Number(b.open.open) - Number(a.open.open) || (waitOf(a) + (a.walk ? a.walk.minutes : 0)) - (waitOf(b) + (b.walk ? b.walk.minutes : 0)),
    nearest: (a, b) => walkOf(a) - walkOf(b),
    wait: (a, b) => waitOf(a) - waitOf(b),
    name: (a, b) => a.s.name.localeCompare(b.s.name),
  }
  return out.slice().sort(sorts[list.value.sort] || sorts.recommended)
})
const openCount = computed(() => rows.value.filter((r) => r.open.open).length)
</script>

<template>
  <div class="stores-tab scroll">
    <h2 class="tab-title">All stores</h2>
    <p class="tab-sub">{{ S.db.stores.length }} stores on campus · {{ openCount }} taking orders</p>
    <label class="search"><Icon name="search" :size="16" /><input type="search" placeholder="Search stores, dishes or buildings" aria-label="Search stores" :value="list.search" @input="A.setListSearch($event.target.value)">
      <button v-if="list.search" type="button" class="icon-btn sm" aria-label="Clear search" @click="A.setListSearch('')"><Icon name="close" :size="12" /></button></label>
    <div class="filter-row scroll" role="group" aria-label="Filter stores">
      <button v-for="c in chips" :key="c.id" type="button" class="chip filter" :class="{ on: list.filter === c.id }" :aria-pressed="list.filter === c.id" @click="A.setListFilter(c.id)">{{ c.label }}</button>
    </div>
    <div class="sort-row">
      <span>{{ shown.length }} {{ shown.length === 1 ? 'store' : 'stores' }}</span>
      <label>Sort by
        <select class="form-select form-select-sm" :value="list.sort" @change="A.setListSort($event.target.value)">
          <option v-for="o in SORTS" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
      </label>
    </div>
    <div class="store-list">
      <button v-for="r in shown" :key="r.s.id" class="store-card" :class="{ closed: !r.open.open }" @click="A.openStore(r.s.id)">
        <Mono :store="r.s" :size="46" />
        <span class="store-main">
          <strong>{{ r.s.name }}</strong>
          <small>{{ r.s.cuisine }}</small>
          <small v-if="r.v"><Icon name="walk" :size="12" />{{ r.walk.minutes }} min · {{ shortName(r.v.name) }}</small>
          <span class="tags">
            <span class="tag" :class="r.open.open ? 'ok' : 'muted'">{{ r.open.open ? 'Open' : 'Closed' }}</span>
            <span v-if="r.s.discount_type" class="tag brand">{{ E.discountShort(r.s) }}</span>
          </span>
        </span>
        <span class="store-wait" v-if="r.open.open"><WaitTimeEstimate :store-id="r.s.id" /></span>
      </button>
      <p v-if="!shown.length" class="empty-note">No stores match. Try another filter.</p>
    </div>
  </div>
</template>
