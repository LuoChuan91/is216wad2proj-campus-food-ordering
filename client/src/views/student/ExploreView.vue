<script setup>
// Explore: the campus map, search, and the venues near you.
//
// Migrated from portals/student/ExploreTab.vue. Renders in StudentLayout's
// persistent KeepAlive tab layer (so the Leaflet map survives navigation). The
// venue sheet it shows is driven by S.ui.student (a UI-store overlay, not a route),
// kept in sync with #/student/venue/:venueId by router/sync.js.
import { computed, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import StatusTag from '@/components/StatusTag.vue'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { shortName } from '@/utils/landmarks.js'
import { acquireStoreWait, releaseStoreWait, peekStoreWait } from '@/composables/storeWaitCache.js'
import MapView from '@/portals/student/MapView.vue'
import VenueSheet from '@/portals/student/VenueSheet.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { ui: uiState, now } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const me = computed(() => orders.me())
const money = E.money
const first = (name) => name.split(' ')[0]

const near = computed(() => catalog.db.venues
  .map((v) => ({ v, walk: ui.walk(v), stores: catalog.storesAt(v.id) }))
  .filter((x) => x.stores.length)
  .sort((a, b) => a.walk.minutes - b.walk.minutes || a.walk.meters - b.walk.meters))
const greeting = computed(() => { const h = E.parts(now.value).h; return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })

// Live "best wait" per venue from the single frontend engine (store:<id>): the
// lowest wait among its open stores, in minutes (derived from the engine seconds).
const storeWaitMins = (storeId) => {
  const entry = peekStoreWait(storeId)
  if (!entry || entry.loading || !entry.seconds) return null
  return Math.max(1, Math.round(entry.seconds / 60))
}
const bestWait = (stores) => {
  const mins = stores.filter((s) => ui.open(s).open).map((s) => storeWaitMins(s.id)).filter((m) => m != null)
  return mins.length ? Math.min(...mins) : null
}
const openCount = (stores) => stores.filter((s) => ui.open(s).open).length

// Keep a live engine for every store shown in the "near you" list (ref-counted,
// shared with the map's own subscriptions).
const waitStores = new Set()
function syncWaits() {
  const wanted = new Set()
  for (const v of catalog.db.venues) for (const s of catalog.storesAt(v.id)) wanted.add(s.id)
  for (const id of wanted) if (!waitStores.has(id)) { acquireStoreWait(id); waitStores.add(id) }
  for (const id of [...waitStores]) if (!wanted.has(id)) { releaseStoreWait(id); waitStores.delete(id) }
}
watch(() => catalog.db.stores.map((s) => s.id).join(','), syncWaits, { immediate: true })
onBeforeUnmount(() => { for (const id of waitStores) releaseStoreWait(id); waitStores.clear() })

// Search stores (name, cuisine) and dishes (name, description, category)
const results = computed(() => {
  const q = u.value.search.trim().toLowerCase()
  if (!q) return null
  const hit = (t) => String(t || '').toLowerCase().includes(q)
  const stores = catalog.db.stores.filter((s) => hit(s.name) || hit(s.cuisine) || hit(s.description)).map((s) => ({ s, v: catalog.venue(s.venue_id), open: ui.open(s).open, available: catalog.storeAvailable(s) }))
  const dishes = catalog.db.menu.filter((m) => hit(m.name) || hit(m.description) || hit(m.category)).slice(0, 12)
    .map((m) => { const s = catalog.store(m.store_id); return { m, s, v: catalog.venue(s.venue_id), ok: m.available && ui.open(s).open && catalog.storeAvailable(s) } })
  return { stores, dishes }
})
</script>

<template>
  <div class="explore">
    <MapView />
    <div class="explore-top">
      <div class="hello d-flex align-items-center gap-2 mb-2"><Avatar :name="me.name" :size="36" tone="brand" /><div><small>{{ greeting }}</small><strong>{{ first(me.name) }}</strong></div><span class="brand-pill ms-auto d-inline-flex align-items-center gap-2"><AppMark :size="18" />{{ cfg.appName }}</span></div>
      <label class="search d-flex align-items-center gap-2"><Icon name="search" :size="16" /><input type="search" placeholder="Search dishes or stores" aria-label="Search dishes or stores" :value="u.search" @input="ui.setSearch($event.target.value)">
        <button v-if="u.search" type="button" class="icon-btn sm" aria-label="Clear search" @click="ui.setSearch('')"><Icon name="close" :size="12" /></button></label>
    </div>
    <Transition name="sheet" mode="out-in">
      <VenueSheet v-if="u.sheet === 'venue' && catalog.venue(u.venueId)" :key="u.venueId" />
      <div v-else-if="results" key="results" class="peek results col-md-8 col-lg-6 mx-auto">
        <div class="grab"></div>
        <div class="peek-head d-flex justify-content-between align-items-center"><strong>Results for “{{ u.search.trim() }}”</strong></div>
        <div class="results-list scroll">
          <p v-if="!results.stores.length && !results.dishes.length" class="empty-note">Nothing matches. Try "noodles", "kopi" or "bento".</p>
          <button v-for="x in results.stores" :key="x.s.id" class="venue-row d-flex align-items-center gap-3 w-100 text-start" :class="{ unavailable: !x.available }" :disabled="!x.available" @click="ui.openStore(x.s.id)">
            <Mono :store="x.s" :size="36" />
            <span class="venue-main d-flex flex-column flex-grow-1 overflow-hidden"><strong>{{ x.s.name }}</strong><small class="d-inline-flex align-items-center gap-1">{{ x.s.cuisine }} · {{ shortName(x.v.name) }}</small></span>
            <StatusTag v-if="!x.available" tone="muted">Unavailable</StatusTag>
            <StatusTag v-else :tone="x.open ? 'ok' : 'muted'">{{ x.open ? 'Open' : 'Closed' }}</StatusTag>
          </button>
          <h4 v-if="results.dishes.length" class="sec">Dishes</h4>
          <button v-for="x in results.dishes" :key="x.m.id" class="venue-row d-flex align-items-center gap-3 w-100 text-start" :disabled="!x.ok" @click="ui.openStoreItem(x.s.id, x.m.id)">
            <span class="venue-ic d-flex align-items-center justify-content-center flex-shrink-0"><Icon name="bag" :size="16" /></span>
            <span class="venue-main d-flex flex-column flex-grow-1 overflow-hidden"><strong>{{ x.m.name }}</strong><small class="d-inline-flex align-items-center gap-1">{{ x.s.name }} · {{ shortName(x.v.name) }}</small></span>
            <b v-if="x.ok" class="price">{{ money(x.m.price) }}</b><StatusTag v-else tone="muted">{{ x.m.available ? 'Closed' : 'Sold out' }}</StatusTag>
          </button>
        </div>
      </div>
      <div v-else key="peek" class="peek col-md-8 col-lg-6 mx-auto">
        <div class="grab"></div>
        <div class="peek-head d-flex justify-content-between align-items-center"><strong>Near you</strong>
          <button type="button" class="where d-inline-flex align-items-center gap-1" :title="u.locateError || 'Use my real location'" @click="ui.locate()"><Icon :name="u.locating ? 'clock' : 'locate'" :size="13" />{{ u.locating ? 'Locating…' : ui.place().label }}</button></div>
        <p v-if="u.locateError" class="locate-err">{{ u.locateError }}</p>
        <button v-for="x in near.slice(0, 4)" :key="x.v.id" class="venue-row d-flex align-items-center gap-3 w-100 text-start" @click="ui.openVenue(x.v.id)">
          <span class="venue-ic d-flex align-items-center justify-content-center flex-shrink-0"><Icon name="store" :size="18" /></span>
          <span class="venue-main d-flex flex-column flex-grow-1 overflow-hidden"><strong>{{ shortName(x.v.name) }}</strong><small class="d-inline-flex align-items-center gap-1"><Icon name="walk" :size="12" />{{ x.walk.minutes }} min · {{ openCount(x.stores) }} of {{ x.stores.length }} open</small></span>
          <WaitChip v-if="bestWait(x.stores) !== null" :minutes="bestWait(x.stores)" prefix="from" />
        </button>
        <button type="button" class="see-all d-flex align-items-center justify-content-center gap-1 w-100" @click="ui.setTab('stores')">See all {{ catalog.db.stores.length }} stores<Icon name="chevR" :size="14" /></button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Explore header, "Near you" peek sheet and search results (moved from the
   global stylesheet). The map, map-note, leaflet-*, search and vsheet stay
   global — they are shared with the venue sheet / stores list / admin map, or
   are Leaflet-owned DOM. */
.explore-top {
  position: absolute;
  z-index: 5;
  top: 0;
  left: 0;
  right: 0;
  padding: 12px 14px 22px;
  background: linear-gradient(
    180deg,
    rgba(243, 244, 248, 1) 50%,
    rgba(243, 244, 248, 0)
  );
}
.hello small {
  display: block;
  color: var(--muted);
  font-size: var(--fs-caption);
  line-height: 1.1;
}
.hello strong {
  font-size: var(--fs-heading);
  line-height: 1.15;
}
.brand-pill {
  font-weight: 800;
  color: var(--brand);
  background: var(--paper);
  border-radius: 999px;
  padding: 4px 10px 4px 5px;
  box-shadow: 0 1px 0 var(--line);
}
/* "See all stores" at the bottom of the Near you list */
.see-all {
  margin-top: 2px;
  border: 0;
  background: none;
  padding: 8px;
  border-radius: 12px;
  color: var(--brand-600);
  font-weight: 700;
  font-size: var(--fs-desc);
  cursor: pointer;
}
.see-all:hover {
  background: var(--canvas);
}
.peek {
  position: absolute;
  z-index: 6;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--paper);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -10px 30px rgba(20, 24, 40, 0.12);
  display: flex;
  flex-direction: column;
  padding: 0 12px 10px;
}
.peek.results {
  max-height: 62%;
}
.peek-head {
  padding: 2px 6px 6px;
}
.peek-head strong {
  font-size: var(--fs-subheading);
}
.where {
  color: var(--muted);
  font-size: var(--fs-desc);
  font-weight: 600;
  border: 0;
  background: none;
  border-radius: 999px;
  padding: 3px 8px;
  cursor: pointer;
}
.where:hover {
  background: var(--canvas);
  color: var(--ink);
}
.locate-err {
  margin: -2px 6px 6px;
  font-size: var(--fs-caption);
  color: var(--late);
}
.results-list {
  padding-bottom: 6px;
}
.results-list .sec {
  margin: 10px 6px 4px;
}
.venue-row {
  color: inherit;
  border: 0;
  background: none;
  padding: 9px 6px;
  border-radius: 14px;
}
.venue-row:hover {
  background: var(--canvas);
}
.venue-row:disabled {
  opacity: 0.55;
  cursor: default;
}
.venue-row:disabled:hover {
  background: none;
}
.venue-row .price {
  font-size: var(--fs-desc);
}
.venue-ic {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--brand-soft);
  color: var(--brand);
}
.venue-main strong {
  font-size: var(--fs-body);
}
.venue-main small {
  color: var(--muted);
  font-size: var(--fs-desc);
}
</style>
