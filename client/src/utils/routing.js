// Walking routes from the OSRM routing API (OpenStreetMap data, foot profile), called with fetch.
// If the API is slow or unreachable, the app falls back to a straight-line estimate so nothing breaks.
import { reactive } from 'vue'
import { config as cfg } from '@/config/index.js'
import { walkEstimate } from '@/utils/engine.js'

const routes = reactive({}) // cached routes, so the map and lists update when one arrives
const pending = new Set()
let unreachableUntil = 0 // after a failure, briefly use estimates before trying the API again
const RETRY_COOLDOWN_MS = 8000
const key = (a, b) => [a.lat, a.lng, b.lat, b.lng].map((n) => Number(n).toFixed(5)).join(',')

// Synchronous read: the cached route if we have one, otherwise an estimate
export function getRoute(a, b) {
  return routes[key(a, b)] || walkEstimate(a, b)
}

// Fetch the real route in the background. Safe to call repeatedly: it no-ops while
// a request for the same points is in flight or already cached, and during a short
// cooldown after a failure.
export async function ensureRoute(a, b) {
  const k = key(a, b)
  if (routes[k] || pending.has(k)) return
  if (Date.now() < unreachableUntil || typeof fetch !== 'function') return // getRoute() returns an estimate meanwhile
  pending.add(k)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), cfg.routingTimeoutMs)
  const url = `${cfg.routingUrl}${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const json = await res.json()
    const r = json.routes && json.routes[0]
    if (!r) throw new Error('No route')
    routes[k] = {
      meters: Math.round(r.distance),
      minutes: Math.max(1, Math.round(r.duration / 60)),
      coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      source: 'osrm',
    }
  } catch {
    // Short cooldown so a transient failure/timeout doesn't strand the map on a
    // straight line — a later call (e.g. the next poll/tick) retries soon.
    unreachableUntil = Date.now() + RETRY_COOLDOWN_MS
  } finally {
    clearTimeout(timer)
    pending.delete(k)
  }
}
