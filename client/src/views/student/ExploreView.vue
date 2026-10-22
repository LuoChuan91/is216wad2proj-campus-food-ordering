<script setup>
// Explore: the campus map, search, and the venues near you.
//
// Migrated from portals/student/ExploreTab.vue. Renders in StudentLayout's
// persistent KeepAlive tab layer (so the Leaflet map survives navigation). The
// venue sheet it shows is driven by S.ui.student (a UI-store overlay, not a route),
// kept in sync with #/student/venue/:venueId by router/sync.js.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { shortName } from '@/utils/landmarks.js'
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
const bestWait = (stores) => { const w = stores.filter((s) => ui.open(s).open).map((s) => orders.storeWait(s.id)).filter(Boolean).map((x) => x.minutes); return w.length ? Math.min(...w) : null }
const openCount = (stores) => stores.filter((s) => ui.open(s).open).length

// Search stores (name, cuisine) and dishes (name, description, category)
const results = computed(() => {
  const q = u.value.search.trim().toLowerCase()
  if (!q) return null
  const hit = (t) => String(t || '').toLowerCase().includes(q)
  const stores = catalog.db.stores.filter((s) => hit(s.name) || hit(s.cuisine) || hit(s.description)).map((s) => ({ s, v: catalog.venue(s.venue_id), open: ui.open(s).open }))
  const dishes = catalog.db.menu.filter((m) => hit(m.name) || hit(m.description) || hit(m.category)).slice(0, 12)
    .map((m) => { const s = catalog.store(m.store_id); return { m, s, v: catalog.venue(s.venue_id), ok: m.available && ui.open(s).open } })
  return { stores, dishes }
})
</script>

<template>
  <div class="explore">
    <MapView />
    <div class="explore-top">
      <div class="hello"><Avatar :name="me.name" :size="36" tone="brand" /><div><small>{{ greeting }}</small><strong>{{ first(me.name) }}</strong></div><span class="brand-pill"><AppMark :size="18" />{{ cfg.appName }}</span></div>
      <label class="search"><Icon name="search" :size="16" /><input type="search" placeholder="Search dishes or stores" aria-label="Search dishes or stores" :value="u.search" @input="ui.setSearch($event.target.value)">
        <button v-if="u.search" type="button" class="icon-btn sm" aria-label="Clear search" @click="ui.setSearch('')"><Icon name="close" :size="12" /></button></label>
    </div>
    <Transition name="sheet" mode="out-in">
      <VenueSheet v-if="u.sheet === 'venue' && catalog.venue(u.venueId)" :key="u.venueId" />
      <div v-else-if="results" key="results" class="peek results">
        <div class="grab"></div>
        <div class="peek-head"><strong>Results for “{{ u.search.trim() }}”</strong></div>
        <div class="results-list scroll">
          <p v-if="!results.stores.length && !results.dishes.length" class="empty-note">Nothing matches. Try "noodles", "kopi" or "bento".</p>
          <button v-for="x in results.stores" :key="x.s.id" class="venue-row" @click="ui.openStore(x.s.id)">
            <Mono :store="x.s" :size="36" />
            <span class="venue-main"><strong>{{ x.s.name }}</strong><small>{{ x.s.cuisine }} · {{ shortName(x.v.name) }}</small></span>
            <span class="tag" :class="x.open ? 'ok' : 'muted'">{{ x.open ? 'Open' : 'Closed' }}</span>
          </button>
          <h4 v-if="results.dishes.length" class="sec">Dishes</h4>
          <button v-for="x in results.dishes" :key="x.m.id" class="venue-row" :disabled="!x.ok" @click="ui.openStoreItem(x.s.id, x.m.id)">
            <span class="venue-ic"><Icon name="bag" :size="16" /></span>
            <span class="venue-main"><strong>{{ x.m.name }}</strong><small>{{ x.s.name }} · {{ shortName(x.v.name) }}</small></span>
            <b v-if="x.ok" class="price">{{ money(x.m.price) }}</b><span v-else class="tag muted">{{ x.m.available ? 'Closed' : 'Sold out' }}</span>
          </button>
        </div>
      </div>
      <div v-else key="peek" class="peek">
        <div class="grab"></div>
        <div class="peek-head"><strong>Near you</strong>
          <button type="button" class="where" :title="u.locateError || 'Use my real location'" @click="ui.locate()"><Icon :name="u.locating ? 'clock' : 'locate'" :size="13" />{{ u.locating ? 'Locating…' : ui.place().label }}</button></div>
        <p v-if="u.locateError" class="locate-err">{{ u.locateError }}</p>
        <button v-for="x in near.slice(0, 4)" :key="x.v.id" class="venue-row" @click="ui.openVenue(x.v.id)">
          <span class="venue-ic"><Icon name="store" :size="18" /></span>
          <span class="venue-main"><strong>{{ shortName(x.v.name) }}</strong><small><Icon name="walk" :size="12" />{{ x.walk.minutes }} min · {{ openCount(x.stores) }} of {{ x.stores.length }} open</small></span>
          <WaitChip v-if="bestWait(x.stores) !== null" :minutes="bestWait(x.stores)" prefix="from" />
        </button>
        <button type="button" class="see-all" @click="ui.setTab('stores')">See all {{ catalog.db.stores.length }} stores<Icon name="chevR" :size="14" /></button>
      </div>
    </Transition>
  </div>
</template>
