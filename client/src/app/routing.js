// Walking routes from the OSRM routing API (OpenStreetMap data, foot profile), called with fetch.
// If the API is slow or unreachable, the app falls back to a straight-line estimate so nothing breaks.
import { reactive } from 'vue'
import { config as cfg } from './config'
import { walkEstimate } from './engine'

const routes = reactive({}) // cached routes, so the map and lists update when one arrives
const pending = new Set()
let unreachableUntil = 0 // after a failure, use estimates for a minute before trying the API again
const key = (a, b) => [a.lat, a.lng, b.lat, b.lng].map((n) => Number(n).toFixed(5)).join(',')

// Synchronous read: the cached route if we have one, otherwise an estimate
export function getRoute(a, b) {
  return routes[key(a, b)] || walkEstimate(a, b)
}

// Fetch the real route in the background
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
    unreachableUntil = Date.now() + 60e3
  } finally {
    clearTimeout(timer)
    pending.delete(k)
  }
}
