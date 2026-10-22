<script setup>
// The campus map (Leaflet + OpenStreetMap tiles).
// - Food venues show a pin with the walking time; hover for their stores and waits, click to open them.
// - Other campus buildings (landmarks) show a small icon; hover for the name, walking time and nearest food.
import { ref, watch, watchEffect, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useUiStore, DEFAULT_PLACE } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { ensureRoute } from '@/utils/routing.js'
import { LANDMARKS, shortName } from '@/utils/landmarks.js'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()

const el = ref(null)
const markers = {}
const stops = []
let map = null, route = null, ro = null, campus = null, meMarker = null

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const ICON = {
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 1.5 4 2 6 2s4-.5 6-2v-5"/>',
  building: '<path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-4h6v4M8 8h2M14 8h2M8 12h2M14 12h2"/>',
  library: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
}
const svg = (kind) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON[kind] || ICON.building}</svg>`

const here = () => ui.place()
// Only frame the map around you when you're on or near campus
const onCampus = () => E.distanceM(here(), DEFAULT_PLACE) < 2500
const foodVenues = () => catalog.db.venues.filter((v) => catalog.storesAt(v.id).length)

// Landmarks: database venues without stores, plus the other SMU buildings (landmarks.js)
function landmarks() {
  const fromDb = catalog.db.venues.filter((v) => !catalog.storesAt(v.id).length).map((v) => ({
    id: v.id, name: v.name, short: shortName(v.name), address: v.address || '', lat: v.lat, lng: v.lng,
    kind: /library/i.test(v.name) ? 'library' : /school/i.test(v.name) ? 'school' : 'building',
  }))
  return fromDb.concat(LANDMARKS)
}

function nearestFood(p) {
  const list = foodVenues().map((v) => ({ v, m: E.distanceM(p, v) })).sort((a, b) => a.m - b.m)
  return list[0] || null
}

/* ---------- marker HTML ---------- */
function pinHtml(v, selected) {
  const w = ui.walk(v)
  return `<div class="vpin${selected ? ' on' : ''}">${selected ? `<b>${esc(shortName(v.name))}</b>` : ''}<span>${w.minutes} min</span></div>`
}
function venueTip(v) {
  const stores = catalog.storesAt(v.id)
  const open = stores.filter((s) => ui.open(s).open).length
  const rows = stores.map((s) => {
    const w = orders.storeWait(s.id)
    const isOpen = ui.open(s).open
    return `<li><i style="background:${s.color}"></i>${esc(s.name)}<em class="${isOpen ? '' : 'off'}">${isOpen ? (w ? `~${w.minutes} min` : 'Open') : 'Closed'}</em></li>`
  }).join('')
  const walk = ui.walk(v)
  return `<div class="map-tip-card"><strong>${esc(v.name)}</strong><small>${walk.minutes} min walk · ${open} of ${stores.length} open</small><ul>${rows}</ul><span class="tip-hint">Click to see the menus</span></div>`
}
function landmarkHtml(l) {
  return `<div class="lmk lmk-${l.kind}"><span class="lmk-ic">${svg(l.kind)}</span><b class="lmk-name">${esc(l.short)}</b></div>`
}
function landmarkTip(l) {
  const walk = ui.walk(l)
  const food = nearestFood(l)
  const foodLine = food ? `<span class="tip-food">Nearest food: <b>${esc(shortName(food.v.name))}</b>, ${Math.max(1, Math.round((food.m * 1.3) / 75))} min away</span>` : ''
  return `<div class="map-tip-card"><strong>${esc(l.name)}</strong><small>${esc(l.address)}</small><span>${walk.minutes} min walk from you · ${walk.meters} m</span>${foodLine}</div>`
}

/* ---------- keep the markers in step with the data ---------- */
function upsert(id, latlng, html, tip, opts) {
  const m = markers[id]
  if (!m) {
    const mk = L.marker(latlng, { icon: L.divIcon({ className: opts.className, html, iconSize: null }), keyboard: false, riseOnHover: true, zIndexOffset: opts.z || 0 })
    mk.bindTooltip(tip, { direction: 'top', offset: [0, opts.tipOffset], className: 'map-tip', opacity: 1 })
    // Near the top of the map the search bar would cover the pop-up, so show it below the marker there
    mk.on('tooltipopen', (e) => {
      const below = map.latLngToContainerPoint(mk.getLatLng()).y < 300
      Object.assign(e.tooltip.options, below ? { direction: 'bottom', offset: [0, 12] } : { direction: 'top', offset: [0, opts.tipOffset] })
      e.tooltip.update()
    })
    if (opts.onClick) mk.on('click', opts.onClick)
    else mk.on('click', () => mk.toggleTooltip()) // phones have no hover: tap shows the pop-up
    mk.addTo(map)
    markers[id] = { mk, html, tip }
    return markers[id]
  }
  if (m.html !== html) { m.mk.setIcon(L.divIcon({ className: opts.className, html, iconSize: null })); m.html = html }
  if (m.tip !== tip) { m.mk.setTooltipContent(tip); m.tip = tip }
  return m
}

function sync() {
  if (!map) return
  const u = ui.ui.student
  const sel = u.sheet === 'venue' ? u.venueId : null
  const seen = new Set()
  for (const l of landmarks()) {
    seen.add(l.id)
    upsert(l.id, [l.lat, l.lng], landmarkHtml(l), landmarkTip(l), { className: 'lmk-wrap', tipOffset: -12, z: -100 })
  }
  for (const v of foodVenues()) {
    seen.add(v.id)
    const m = upsert(v.id, [v.lat, v.lng], pinHtml(v, v.id === sel), venueTip(v), { className: 'vpin-wrap', tipOffset: -34, onClick: () => ui.openVenue(v.id) })
    m.mk.setZIndexOffset(v.id === sel ? 1000 : 0)
  }
  for (const id of Object.keys(markers)) if (!seen.has(id)) { markers[id].mk.remove(); delete markers[id] }

  const v = sel && catalog.venue(sel)
  const w = v && ui.walk(v)
  const sig = w ? JSON.stringify(w.coords) : ''
  if (route && route.sig !== sig) { route.line.remove(); route = null }
  if (w && !route) {
    const line = L.polyline(w.coords, { color: '#e5512d', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round', dashArray: w.source === 'osrm' ? null : '1 10', interactive: false }).addTo(map)
    route = { line, sig }
  }
}

function frame(animate) {
  if (!map) return
  const me = here(), near = onCampus()
  const u = ui.ui.student
  const sel = u.sheet === 'venue' && u.venueId ? catalog.venue(u.venueId) : null
  if (sel) {
    const pts = [[sel.lat, sel.lng]].concat(near ? [[me.lat, me.lng]] : [])
    map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [60, 150], paddingBottomRight: [60, 380], maxZoom: 18, animate, duration: 0.6 })
  } else {
    const pts = foodVenues().map((x) => [x.lat, x.lng]).concat(near ? [[me.lat, me.lng]] : [])
    if (!pts.length) return
    map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [24, 110], paddingBottomRight: [24, 300], maxZoom: 18, animate, duration: 0.6 })
  }
}

// Rounded outline around campus, drawn when map tiles can't load
function campusOutline() {
  const pts = []
  for (const v of catalog.db.venues.concat(LANDMARKS)) {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 2 * Math.PI; pts.push([v.lat + 0.00042 * Math.sin(a), v.lng + 0.00042 * Math.cos(a)]) }
  }
  pts.sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const cross = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])
  const lower = [], upper = []
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p) }
  for (const p of pts.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p) }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1))
  return L.layerGroup([L.polygon(hull, { stroke: true, color: '#b9d3b8', weight: 2, fillColor: '#dcebd8', fillOpacity: 0.9, interactive: false, smoothFactor: 2 })])
}

function fetchRoutes() {
  // One request first: if the routing API is unreachable, the rest use estimates without retrying
  const me = here()
  const places = catalog.db.venues.concat(LANDMARKS)
  if (!places.length) return
  ensureRoute(me, places[0]).then(() => places.slice(1).forEach((v) => ensureRoute(me, v)))
}

onMounted(() => {
  map = L.map(el.value, { zoomControl: false, attributionControl: true, keyboard: false, zoomSnap: 0.25, zoomDelta: 0.5, tap: false })
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
  const tiles = L.tileLayer(cfg.tiles.url, { attribution: cfg.tiles.attribution, maxZoom: cfg.tiles.maxZoom }).addTo(map)
  // No map tiles at all (offline, or a network that blocks them)? Draw a simple campus outline instead.
  let loaded = 0, failed = 0
  tiles.on('tileload', () => { loaded++ })
  tiles.on('tileerror', () => { if (++failed >= 4 && !loaded && map) { ui.mapOffline = true; tiles.remove() } })
  if (ui.mapOffline) tiles.remove()
  stops.push(watch(() => ui.mapOffline, (off) => { if (off && map && !campus) { campus = campusOutline().addTo(map); campus.eachLayer((l) => l.bringToBack && l.bringToBack()) } }, { immediate: true }))
  // Building names appear once you zoom in far enough for them to fit
  const labels = () => el.value && el.value.classList.toggle('show-labels', map.getZoom() >= 17)
  map.on('zoomend', labels)
  meMarker = L.marker([here().lat, here().lng], { icon: L.divIcon({ className: 'me-wrap', html: '<div class="me"><i></i><span>You</span></div>', iconSize: null }), interactive: false, keyboard: false, zIndexOffset: -500 }).addTo(map)
  frame(false)
  labels()
  fetchRoutes()
  stops.push(watchEffect(sync))
  stops.push(watch(() => [ui.ui.student.venueId, ui.ui.student.sheet === 'venue'], () => frame(true)))
  stops.push(watch(() => catalog.db.venues.length, (n, o) => { fetchRoutes(); if (n > o) frame(true) }))
  stops.push(watch(() => { const p = here(); return p.lat + ',' + p.lng }, () => {
    meMarker.setLatLng([here().lat, here().lng])
    fetchRoutes()
    frame(true)
  }))
  ro = new ResizeObserver(() => { if (map) map.invalidateSize({ animate: false }) })
  ro.observe(el.value)
})
onBeforeUnmount(() => {
  stops.forEach((s) => s())
  if (ro) ro.disconnect()
  if (map) map.remove()
  map = null; campus = null; meMarker = null
})
</script>

<template>
  <div class="map" ref="el" role="region" aria-label="Campus map"></div>
  <span v-if="ui.mapOffline" class="map-note">Map tiles unavailable here</span>
</template>
