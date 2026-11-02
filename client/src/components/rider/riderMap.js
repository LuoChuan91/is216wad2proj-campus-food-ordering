// The 2D campus map behind "Where is my rider" (Leaflet + OpenStreetMap tiles, GSAP glide).
//
// Pieces: campus building names, an amber pin per building with other stores, the walking
// route (solid orange behind the courier, dashed blue ahead), the store and drop-off dots,
// and the courier as a pulsing dot that glides between fixes.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import gsap from 'gsap'
import { config as cfg } from '@/config/index.js'
import { pathLength } from '@/utils/riderPosition.js'

const MAX_NAMES = 4
const MAX_PLACE_M = 650 // buildings and stores further than this from the route's middle are left out

// A text-only marker; textContent keeps store names from the database out of the HTML
function label(at, cls, text, z = 0) {
  const el = document.createElement('span')
  el.className = cls
  el.textContent = text
  return L.marker(at, { icon: L.divIcon({ className: 'rmk', html: el, iconSize: null }), interactive: false, keyboard: false, zIndexOffset: z })
}

// Split the route at `progress` (0..1 of its length): [walked, ahead]
function split(coords, progress) {
  let left = pathLength(coords) * progress
  for (let i = 1; i < coords.length; i++) {
    const seg = pathLength([coords[i - 1], coords[i]])
    if (left <= seg) {
      const t = seg ? left / seg : 0
      const [a, b] = [coords[i - 1], coords[i]]
      const cut = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      return [[...coords.slice(0, i), cut], [cut, ...coords.slice(i)]]
    }
    left -= seg
  }
  return [coords, [coords[coords.length - 1]]]
}

/**
 * @param {HTMLElement} el
 * @param {{ from: {lat,lng,name}, to: {lat,lng,name}, coords: number[][], riderName: string,
 *           buildings: {lat,lng,name,short?}[], stores: {lat,lng,name}[], reducedMotion: boolean }} opts
 */
export function createRiderMap(el, { from, to, coords, riderName, buildings, stores = [], reducedMotion }) {
  const map = L.map(el, { zoomControl: false, attributionControl: true, keyboard: false, scrollWheelZoom: false, zoomSnap: 0.25, tap: false })
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
  L.tileLayer(cfg.tiles.url, { attribution: cfg.tiles.attribution, maxZoom: cfg.tiles.maxZoom }).addTo(map)

  const mid = [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2]
  const near = (p) => pathLength([mid, [p.lat, p.lng]]) <= MAX_PLACE_M

  for (const b of buildings) if (near(b)) label([b.lat, b.lng], 'place place-building', b.short || b.name, -200).addTo(map)

  // the other stores: one amber pin per building, its label listing the outlets there
  const byBuilding = new Map()
  for (const st of stores) {
    const key = `${st.lat},${st.lng}`
    if (!byBuilding.has(key)) byBuilding.set(key, { lat: st.lat, lng: st.lng, names: [] })
    byBuilding.get(key).names.push(st.name)
  }
  for (const b of byBuilding.values()) {
    if (!near(b)) continue
    const more = b.names.length - MAX_NAMES
    L.circleMarker([b.lat, b.lng], { radius: 5, color: '#ffb347', weight: 2, fillColor: '#ffb347', fillOpacity: 0.9, interactive: false }).addTo(map)
    label([b.lat, b.lng], 'place place-store', b.names.slice(0, MAX_NAMES).join('\n') + (more > 0 ? `\n+${more} more` : ''), -100).addTo(map)
  }

  const ahead = L.polyline([], { color: '#8ea2ff', weight: 5, opacity: 0.9, dashArray: '2 10', lineCap: 'round', interactive: false }).addTo(map)
  const walked = L.polyline([], { color: '#ff6a3d', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map)

  L.circleMarker([from.lat, from.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#ff6a3d', fillOpacity: 1, interactive: false }).addTo(map)
  L.circleMarker([to.lat, to.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#2ee59d', fillOpacity: 1, interactive: false }).addTo(map)
  label([from.lat, from.lng], 'tag t-store', from.name, 100).addTo(map)
  label([to.lat, to.lng], 'tag t-drop', to.name, 100).addTo(map)

  const dot = document.createElement('div')
  dot.className = 'courier' + (reducedMotion ? '' : ' live')
  const name = document.createElement('span')
  name.className = 'tag t-rider'
  name.textContent = riderName
  dot.append(document.createElement('i'), name)
  const courier = L.marker([from.lat, from.lng], { icon: L.divIcon({ className: 'rmk', html: dot, iconSize: null }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map)

  let route = coords
  const rider = { lat: from.lat, lng: from.lng, progress: 0, placed: false }
  function draw() {
    const [done, rest] = split(route, rider.progress)
    walked.setLatLngs(done)
    ahead.setLatLngs(rest)
    courier.setLatLng([rider.lat, rider.lng])
  }
  function fit() {
    // room at the top for the heading and at the bottom for the info card
    map.fitBounds(L.latLngBounds([...route, [from.lat, from.lng], [to.lat, to.lng]]), { paddingTopLeft: [30, 70], paddingBottomRight: [30, 170], maxZoom: 18, animate: false })
  }

  return {
    setRoute(next) { route = next.length >= 2 ? next : [[from.lat, from.lng], [to.lat, to.lng]]; draw(); fit() },
    // Glide the courier to a new spot (the first call places them straight away)
    setRider({ lat, lng, progress }) {
      if (!rider.placed || reducedMotion) { Object.assign(rider, { lat, lng, progress, placed: true }); draw(); return }
      gsap.to(rider, { lat, lng, progress, duration: 1.2, ease: 'power2.out', overwrite: true, onUpdate: draw })
    },
    resize() { map.invalidateSize(); fit() },
    dispose() { gsap.killTweensOf(rider); map.remove() },
  }
}
