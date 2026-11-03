<script setup>
// Explore: the campus map, search, and the venues near you.
//
// Migrated from portals/student/ExploreTab.vue. Renders in StudentLayout's
// persistent KeepAlive tab layer (so the Leaflet map survives navigation). The
// venue sheet it shows is driven by S.ui.student (a UI-store overlay, not a route),
// kept in sync with #/student/venue/:venueId by router/sync.js.
import { computed, watch, onBeforeUnmount, onMounted, ref, reactive, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import StatusTag from '@/components/StatusTag.vue'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { acquireStoreWait, releaseStoreWait, peekStoreWait } from '@/composables/storeWaitCache.js'
import MapView from '@/portals/student/MapView.vue'
import VenueSheet from '@/portals/student/VenueSheet.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { ui: uiState, now } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const me = computed(() => orders.me())

const near = computed(() => catalog.db.venues
  .map((v) => ({ v, walk: ui.walk(v), stores: catalog.storesAt(v.id) }))
  .filter((x) => x.stores.length)
  .sort((a, b) => a.walk.minutes - b.walk.minutes || a.walk.meters - b.walk.meters))
const greeting = computed(() => { const h = E.parts(now.value).h; return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })

/* ---------- Draggable bottom sheet (Google Maps / Apple Maps pattern) ----------
   Three snap points: peek, half, full. Drag the handle to move it. Tap the map
   and it drops back to peek. The list inside scrolls on its own, so a long list
   never swallows the map. Works with mouse (laptop) and touch (phone). */
const rootEl = ref(null)
const listEl = ref(null)
const headEl = ref(null)
const grabEl = ref(null)
const viewportH = ref(700)
const viewportW = ref(900)
const contentH = ref(0)
const chromeH = ref(60)
// Laptop screens are taller, so show more of the list there.
const wide = computed(() => viewportW.value >= 768)
const peekH = computed(() => Math.round(Math.max(wide.value ? 260 : 200, viewportH.value * (wide.value ? 0.32 : 0.28))))
const collapsedH = computed(() => (wide.value ? 48 : 38))
// Never taller than 72% of the screen, so the greeting + search bar stay visible.
const maxH = computed(() => Math.round(viewportH.value * 0.72))
// Fit the content: a short list gets a short sheet, a long one scrolls at the cap.
const fullH = computed(() => Math.min(maxH.value, Math.max(peekH.value, contentH.value || Math.round(viewportH.value * 0.5))))
// Hidden (thin bar) -> peek -> half -> full. The peek is taller on laptops,
// so more rows are visible before you drag.
const snaps = computed(() => {
  const p = peekH.value
  const f = Math.max(fullH.value, p)
  return [collapsedH.value, p, Math.round((p + f) / 2), f]
})
const midIndex = 2
const snapIndex = ref(1)
function measureContent() {
  const el = listEl.value
  if (!el) return
  const chrome = (grabEl.value ? grabEl.value.offsetHeight : 22) + (headEl.value ? headEl.value.offsetHeight : 28) + 10
  chromeH.value = chrome
  contentH.value = el.scrollHeight + chrome
}
const drag = reactive({ active: false, startY: 0, startOff: 0, off: 0 })
const offsetOf = (height) => fullH.value - height
const sheetOffset = computed(() => (drag.active ? drag.off : offsetOf(snaps.value[snapIndex.value])))
// How much of the sheet is on screen right now. The list gets exactly this much
// (minus the header), so it scrolls at EVERY snap, including peek.
const visibleH = computed(() => fullH.value - sheetOffset.value)
const listStyle = computed(() => ({ maxHeight: Math.max(80, visibleH.value - chromeH.value) + 'px' }))

// The sheet's height is fixed at the tallest snap; only `transform` moves. Animating
// transform runs on the GPU (smooth); animating height re-lays-out every frame (choppy).
const sheetStyle = computed(() => ({
  height: fullH.value + 'px',
  transform: `translateY(${sheetOffset.value}px)`,
  transition: drag.active ? 'none' : 'transform .34s cubic-bezier(.22,.8,.24,1)',
}))

function measure() {
  if (rootEl.value) {
    viewportH.value = rootEl.value.clientHeight
    viewportW.value = rootEl.value.clientWidth
  } else {
    viewportH.value = window.innerHeight
    viewportW.value = window.innerWidth
  }
}
onMounted(() => {
  measure()
  snapIndex.value = 1 // start at peek on both
  nextTick(measureContent)
  window.addEventListener('resize', () => { measure(); measureContent() })
})
// Re-measure when the list changes (search results, venues loading) or its element mounts.
watch([listEl, () => u.value.search, () => near.value.length], () => nextTick(measureContent))

function onGrabDown(e) {
  drag.active = true
  drag.startY = e.clientY
  drag.startOff = sheetOffset.value
  drag.off = drag.startOff
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onGrabMove(e) {
  if (!drag.active) return
  const maxOff = offsetOf(snaps.value[0]) // can't drag below peek
  drag.off = Math.min(maxOff, Math.max(0, drag.startOff + (e.clientY - drag.startY)))
}
function onGrabUp() {
  if (!drag.active) return
  drag.active = false
  lastSheetDrag = Date.now()
  const o = drag.off
  let best = 0
  snaps.value.forEach((h, i) => { if (Math.abs(offsetOf(h) - o) < Math.abs(offsetOf(snaps.value[best]) - o)) best = i })
  snapIndex.value = best
}

// A finger that moves is dragging, not tapping. Without this, releasing after a
// drag counts as a click on whatever row (or map pin) is under the finger.
const press = reactive({ x: 0, y: 0, moved: false })
let lastSheetDrag = 0
function onSheetDown(e) { press.x = e.clientX; press.y = e.clientY; press.moved = false }
function onSheetMove(e) { if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true }
function onSheetClickCapture(e) {
  if (press.moved) { e.stopPropagation(); e.preventDefault(); press.moved = false }
}

// Tapping the map: close an open venue sheet, otherwise hide the list completely.
function onMapClick() {
  if (Date.now() - lastSheetDrag < 350) return // this was the end of a sheet drag, not a tap
  if (u.value.sheet) ui.closeSheet()
  else snapIndex.value = 0
}
// Panning / zooming the map hides the list (handle only), like Google Maps.
function onMapInteract() {
  if (Date.now() - lastSheetDrag < 350) return
  if (!u.value.sheet) snapIndex.value = 0
}
// Searching opens the sheet to the middle so results are visible.
watch(() => u.value.search, (q) => { snapIndex.value = q.trim() ? midIndex : 1 })

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
  <div class="explore" ref="rootEl">
    <MapView @map-click="onMapClick" @map-interact="onMapInteract" />
    <div class="explore-top">
      <div class="hello d-flex align-items-center gap-2 mb-2"><Avatar :name="me.name" :size="36" tone="brand" /><div><small>{{ greeting }}</small><strong>{{ E.firstName(me.name) }}</strong></div><span class="brand-pill ms-auto d-inline-flex align-items-center gap-2"><AppMark :size="18" />{{ cfg.appName }}</span></div>
      <label class="search d-flex align-items-center gap-2"><Icon name="search" :size="16" /><input type="search" placeholder="Search dishes or stores" aria-label="Search dishes or stores" :value="u.search" @input="ui.setSearch($event.target.value)">
        <button v-if="u.search" type="button" class="icon-btn sm" aria-label="Clear search" @click="ui.setSearch('')"><Icon name="close" :size="12" /></button></label>
    </div>
    <VenueSheet v-if="u.sheet === 'venue' && catalog.venue(u.venueId)" :key="u.venueId" />
      <div v-else-if="results" key="results" class="peek results col-md-8 col-lg-6 mx-auto" :class="{ 'is-collapsed': snapIndex === 0 }" :style="sheetStyle"
        @pointerdown="onSheetDown" @pointermove="onSheetMove" @click.capture="onSheetClickCapture">
        <div class="sheet-grab" ref="grabEl" @pointerdown="onGrabDown" @pointermove="onGrabMove" @pointerup="onGrabUp" @pointercancel="onGrabUp"><span class="grab"></span></div>
        <div class="peek-head d-flex justify-content-between align-items-center" ref="headEl"><strong>Results for “{{ u.search.trim() }}”</strong></div>
        <div class="results-list scroll sheet-scroll" ref="listEl" :style="listStyle">
          <p v-if="!results.stores.length && !results.dishes.length" class="empty-note">Nothing matches. Try "noodles", "kopi" or "bento".</p>
          <button v-for="x in results.stores" :key="x.s.id" class="venue-row d-flex align-items-center gap-3 w-100 text-start" :class="{ unavailable: !x.available }" :disabled="!x.available" @click="ui.openStore(x.s.id)">
            <Mono :store="x.s" :size="36" />
            <span class="venue-main d-flex flex-column flex-grow-1 overflow-hidden"><strong>{{ x.s.name }}</strong><small class="d-inline-flex align-items-center gap-1">{{ x.s.cuisine }} · {{ E.venueLabel(x.v) }}</small></span>
            <StatusTag v-if="!x.available" tone="muted">Unavailable</StatusTag>
            <StatusTag v-else :tone="x.open ? 'ok' : 'muted'">{{ x.open ? 'Open' : 'Closed' }}</StatusTag>
          </button>
          <h4 v-if="results.dishes.length" class="sec">Dishes</h4>
          <button v-for="x in results.dishes" :key="x.m.id" class="venue-row d-flex align-items-center gap-3 w-100 text-start" :disabled="!x.ok" @click="ui.openStoreItem(x.s.id, x.m.id)">
            <span class="venue-ic d-flex align-items-center justify-content-center flex-shrink-0"><Icon name="bag" :size="16" /></span>
            <span class="venue-main d-flex flex-column flex-grow-1 overflow-hidden"><strong>{{ x.m.name }}</strong><small class="d-inline-flex align-items-center gap-1">{{ x.s.name }} · {{ E.venueLabel(x.v) }}</small></span>
            <b v-if="x.ok" class="price">{{ E.money(x.m.price) }}</b><StatusTag v-else tone="muted">{{ x.m.available ? 'Closed' : 'Sold out' }}</StatusTag>
          </button>
        </div>
      </div>
      <div v-else key="peek" class="peek col-md-8 col-lg-6 mx-auto" :class="{ 'is-collapsed': snapIndex === 0 }" :style="sheetStyle"
        @pointerdown="onSheetDown" @pointermove="onSheetMove" @click.capture="onSheetClickCapture">
        <div class="sheet-grab" ref="grabEl" @pointerdown="onGrabDown" @pointermove="onGrabMove" @pointerup="onGrabUp" @pointercancel="onGrabUp"><span class="grab"></span></div>
        <div class="peek-head d-flex justify-content-between align-items-center" ref="headEl"><strong>Near you</strong>
          <button type="button" class="where d-inline-flex align-items-center gap-1" :title="u.locateError || 'Use my real location'" @click="ui.locate()"><Icon :name="u.locating ? 'clock' : 'locate'" :size="13" />{{ u.locating ? 'Locating…' : ui.place().label }}</button></div>
        <p v-if="u.locateError" class="locate-err">{{ u.locateError }}</p>
        <div class="near-list sheet-scroll" ref="listEl" :style="listStyle">
          <button v-for="x in near" :key="x.v.id" class="venue-row d-flex align-items-center gap-3 w-100 text-start" @click="ui.openVenue(x.v.id)">
            <span class="venue-ic d-flex align-items-center justify-content-center flex-shrink-0"><Icon name="store" :size="18" /></span>
            <span class="venue-main d-flex flex-column flex-grow-1 overflow-hidden"><strong>{{ E.venueLabel(x.v) }}</strong><small class="d-inline-flex align-items-center gap-1"><Icon name="walk" :size="12" />{{ x.walk.minutes }} min · {{ openCount(x.stores) }} of {{ x.stores.length }} open</small></span>
            <WaitChip v-if="bestWait(x.stores) !== null" :minutes="bestWait(x.stores)" prefix="from" />
          </button>
          <button type="button" class="see-all d-flex align-items-center justify-content-center gap-1 w-100" @click="ui.setTab('stores')">See all {{ catalog.db.stores.length }} stores<Icon name="chevR" :size="14" /></button>
        </div>
      </div>
  </div>
</template>

<style scoped>
/* Explore header, "Near you" peek sheet and search results (moved from the
   global stylesheet). The map, map-note, leaflet-*, search and vsheet stay
   global — they are shared with the venue sheet / stores list / admin map, or
   are Leaflet-owned DOM. */
.explore-top {
  position: absolute;
  z-index: 2;
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
  z-index: 8;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 92%;
  overflow: hidden;
  background: var(--paper);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -10px 30px rgba(20, 24, 40, 0.12);
  display: flex;
  flex-direction: column;
  padding: 0 12px 10px;
  will-change: transform;
  backface-visibility: hidden;
}
/* Laptop: centred sheet instead of a full-width white slab */
@media (min-width: 768px) {
  .peek {
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
  }
}
/* Height is set inline by the drag logic, so the old fixed cap is dropped */
.peek.results {
  max-height: none;
}
/* Collapsed: only the handle reacts (nothing inside can be clicked by accident).
   The content stays visible, so it slides into view as you drag up. */
.peek.is-collapsed {
  pointer-events: none;
}
.peek.is-collapsed .sheet-grab {
  pointer-events: auto;
}
/* Drag handle. Only this small centred area starts a drag, so clicking the
   header or the list never grabs (and therefore never moves) the sheet. */
.sheet-grab {
  position: relative;
  z-index: 2;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: fit-content;
  margin: 0 auto;
  padding: 9px 24px 5px;
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.sheet-grab:active {
  cursor: grabbing;
}
.sheet-grab .grab {
  margin: 0;
}
/* Only this part scrolls, so a long list can never cover the map */
.sheet-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}
.near-list {
  padding-bottom: 4px;
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
