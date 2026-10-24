<script setup>
// Stores: every store on campus in one list (like Grab's restaurant list), with search,
// quick filters by category and a sort. Uses the same cards as the venue sheet.
//
// Migrated from portals/student/StoresTab.vue. Renders in StudentLayout's persistent
// KeepAlive tab layer. Behaviour unchanged.
import { computed, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import * as E from '@/utils/engine.js'
import { shortName } from '@/utils/landmarks.js'
import { acquireStoreWait, releaseStoreWait, peekStoreWait } from '@/composables/storeWaitCache.js'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const { ui: uiState } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const list = computed(() => u.value.list)

// Live wait minutes per store from the single frontend engine (store:<id>), used
// by the "Shortest wait" sort. The cards themselves render <WaitTimeEstimate>.
const waitStores = new Set()
const storeWaitMins = (storeId) => {
  const entry = peekStoreWait(storeId)
  if (!entry || entry.loading || !entry.seconds) return null
  return Math.max(1, Math.round(entry.seconds / 60))
}
function syncWaits() {
  const wanted = new Set(catalog.db.stores.map((s) => s.id))
  for (const id of wanted) if (!waitStores.has(id)) { acquireStoreWait(id); waitStores.add(id) }
  for (const id of [...waitStores]) if (!wanted.has(id)) { releaseStoreWait(id); waitStores.delete(id) }
}
watch(() => catalog.db.stores.map((s) => s.id).join(','), syncWaits, { immediate: true })
onBeforeUnmount(() => { for (const id of waitStores) releaseStoreWait(id); waitStores.clear() })

// Filter chips: All, Open now, Offers, then every menu category (Noodles, Drinks, Bento Sets…)
const categories = computed(() => [...new Set(catalog.db.menu.map((m) => m.category))].sort())
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

const rows = computed(() => catalog.db.stores.map((s) => {
  const v = catalog.venue(s.venue_id)
  return { s, v, open: ui.open(s), available: catalog.storeAvailable(s), wait: storeWaitMins(s.id), walk: v ? ui.walk(v) : null, cats: catalog.menuOf(s.id).map((m) => m.category) }
}))

const shown = computed(() => {
  const q = list.value.search.trim().toLowerCase()
  const hit = (t) => String(t || '').toLowerCase().includes(q)
  const f = list.value.filter
  let out = rows.value.filter((r) => {
    if (q && !(hit(r.s.name) || hit(r.s.cuisine) || hit(r.s.description) || (r.v && hit(r.v.name)) || catalog.menuOf(r.s.id).some((m) => hit(m.name)))) return false
    if (f === 'open') return r.open.open
    if (f === 'offers') return !!r.s.discount_type
    if (f.startsWith('cat:')) return r.cats.includes(f.slice(4))
    return true
  })
  const waitOf = (r) => (r.open.open && r.wait != null ? r.wait : 999)
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
    <div class="container px-0">
    <h2 class="tab-title">All stores</h2>
    <p class="tab-sub">{{ catalog.db.stores.length }} stores on campus · {{ openCount }} taking orders</p>
    <label class="search"><Icon name="search" :size="16" /><input type="search" placeholder="Search stores, dishes or buildings" aria-label="Search stores" :value="list.search" @input="ui.setListSearch($event.target.value)">
      <button v-if="list.search" type="button" class="icon-btn sm" aria-label="Clear search" @click="ui.setListSearch('')"><Icon name="close" :size="12" /></button></label>
    <div class="filter-row scroll" role="group" aria-label="Filter stores">
      <button v-for="c in chips" :key="c.id" type="button" class="chip filter" :class="{ on: list.filter === c.id }" :aria-pressed="list.filter === c.id" @click="ui.setListFilter(c.id)">{{ c.label }}</button>
    </div>
    <div class="sort-row">
      <span>{{ shown.length }} {{ shown.length === 1 ? 'store' : 'stores' }}</span>
      <label>Sort by
        <select class="form-select form-select-sm" :value="list.sort" @change="ui.setListSort($event.target.value)">
          <option v-for="o in SORTS" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
      </label>
    </div>
    <div class="row g-2">
      <div v-for="r in shown" :key="r.s.id" class="col-12 col-md-6 col-lg-4">
      <button class="store-card d-flex align-items-center gap-3 w-100 h-100 p-2 text-start bg-white border rounded-4" :class="{ 'opacity-75': r.available && !r.open.open, 'opacity-50': !r.available }" :disabled="!r.available" @click="ui.openStore(r.s.id)">
        <Mono :store="r.s" :size="46" />
        <span class="d-flex flex-column flex-grow-1 overflow-hidden">
          <strong>{{ r.s.name }}</strong>
          <small class="text-body-secondary">{{ r.s.cuisine }}</small>
          <small v-if="r.v" class="d-inline-flex align-items-center gap-1 text-body-secondary"><Icon name="walk" :size="12" />{{ r.walk.minutes }} min · {{ shortName(r.v.name) }}</small>
          <span class="d-flex flex-wrap gap-1 mt-1">
            <span v-if="!r.available" class="tag muted">Unavailable</span>
            <span v-else class="tag" :class="r.open.open ? 'ok' : 'muted'">{{ r.open.open ? 'Open' : 'Closed' }}</span>
            <span v-if="r.s.discount_type" class="tag brand">{{ E.discountShort(r.s) }}</span>
          </span>
        </span>
        <span v-if="r.available && r.open.open" class="flex-shrink-0"><WaitTimeEstimate :store-id="r.s.id" /></span>
      </button>
      </div>
      <p v-if="!shown.length" class="empty-note col-12">No stores match. Try another filter.</p>
    </div>
    </div>
  </div>
</template>

<style scoped>
/* Stores list: filter chips + sort row (moved from the global stylesheet).
   Kept global (shared): .stores-tab padding, .tab-title, .search, and the
   .store-card hover rule (also used by the venue sheet). */
.tab-sub {
  color: var(--muted);
  font-size: 13px;
  margin: 2px 0 12px;
}
.stores-tab .search {
  margin-bottom: 10px;
  box-shadow: 0 1px 0 var(--line);
  border: 1px solid var(--line);
}
.filter-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0 8px;
  scrollbar-width: none;
}
.filter-row::-webkit-scrollbar {
  display: none;
}
.chip.filter {
  border: 1.5px solid var(--line);
  background: var(--paper);
  color: var(--ink-2);
  cursor: pointer;
  padding: 5px 12px;
  font-size: 12.5px;
}
.chip.filter:hover {
  border-color: #cfd4e0;
}
.chip.filter.on {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand-600);
}
.sort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 2px 2px 10px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}
.sort-row label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}
.sort-row .form-select {
  width: auto;
  font-size: 12.5px;
  font-weight: 700;
  border-radius: 10px;
  padding-top: 3px;
  padding-bottom: 3px;
}
</style>
