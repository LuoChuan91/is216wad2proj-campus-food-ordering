<script setup>
// The admin's venue map: every venue as a dot; click anywhere to place a new one
import { ref, watchEffect, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { S, A } from '@/stores/compat.js'
import { config as cfg } from '@/config/index.js'

const el = ref(null)
const stops = []
const pins = {}
let map = null, draft = null

onMounted(() => {
  map = L.map(el.value, { zoomControl: true, attributionControl: true, keyboard: false, zoomSnap: 0.25 })
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
  const tiles = L.tileLayer(cfg.tiles.url, { attribution: cfg.tiles.attribution, maxZoom: cfg.tiles.maxZoom }).addTo(map)
  let loaded = 0, failed = 0
  tiles.on('tileload', () => { loaded++ })
  tiles.on('tileerror', () => { if (++failed >= 4 && !loaded && map) { S.mapOffline = true; tiles.remove() } })
  if (S.mapOffline) tiles.remove()
  if (S.db.venues.length) map.fitBounds(L.latLngBounds(S.db.venues.map((v) => [v.lat, v.lng])), { padding: [60, 60], animate: false, maxZoom: 18 })
  else map.setView([1.2966, 103.8499], 17)
  map.on('click', (e) => { A.setVenueDraft('lat', e.latlng.lat.toFixed(6)); A.setVenueDraft('lng', e.latlng.lng.toFixed(6)) })
  stops.push(watchEffect(() => {
    for (const v of S.db.venues) {
      if (!pins[v.id]) pins[v.id] = L.circleMarker([v.lat, v.lng], { radius: 7, color: '#fff', weight: 2, fillColor: v.type === 'building' ? '#767d90' : '#1e2a5a', fillOpacity: 1 }).bindTooltip(v.name, { direction: 'top', offset: [0, -6] }).addTo(map)
    }
    const d = S.ui.staff.venueDraft
    const lat = parseFloat(d.lat), lng = parseFloat(d.lng)
    if (draft) { draft.remove(); draft = null }
    if (!isNaN(lat) && !isNaN(lng)) draft = L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#e5512d', fillOpacity: 1 }).addTo(map)
  }))
  const ro = new ResizeObserver(() => map && map.invalidateSize({ animate: false }))
  ro.observe(el.value)
  stops.push(() => ro.disconnect())
})
onBeforeUnmount(() => { stops.forEach((s) => s()); if (map) map.remove(); map = null })
</script>

<template>
  <div class="admin-map-wrap">
    <div class="admin-map" ref="el" role="region" aria-label="Venue map. Click to place a new venue."></div>
    <span v-if="S.mapOffline" class="map-note">Map tiles unavailable here</span>
  </div>
</template>
