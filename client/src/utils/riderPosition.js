// "Where is my rider": where the courier is on the walk from the store to the drop-off.
// From their phone's GPS when we have a recent fix, otherwise an estimate along the
// walking route from the time they picked the food up (same walking speed as utils/mapApi.js).
//
// Routes are arrays of [lat, lng] points, the shape utils/routing.js returns.

const M_PER_DEG = 111320
const WALK_M_PER_S = 75 / 60
export const FIX_FRESH_MS = 45e3 // an older fix means the phone stopped sending: estimate instead
const MAX_ESTIMATE = 0.95 // an estimate never claims the courier has arrived

// Flat metres east (x) and north (y) of `origin`. Fine at campus scale.
export function toMetres(origin, [lat, lng]) {
  return {
    x: (lng - origin[1]) * M_PER_DEG * Math.cos((origin[0] * Math.PI) / 180),
    y: (lat - origin[0]) * M_PER_DEG,
  }
}

function cumulative(coords) {
  const pts = coords.map((c) => toMetres(coords[0], c))
  const acc = [0]
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, acc, total: acc[acc.length - 1] }
}

export function pathLength(coords) {
  return coords.length < 2 ? 0 : cumulative(coords).total
}

// The point `t` (0..1) of the way along the route, by distance
export function pointAt(coords, t) {
  if (coords.length < 2) return coords[0]
  const { acc, total } = cumulative(coords)
  const want = Math.min(1, Math.max(0, t)) * total
  let i = 1
  while (i < acc.length - 1 && acc[i] < want) i++
  const seg = acc[i] - acc[i - 1] || 1
  const f = (want - acc[i - 1]) / seg
  const [a, b] = [coords[i - 1], coords[i]]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

// How far along the route (0..1) the point closest to `p` is
export function progressOf(coords, p) {
  if (coords.length < 2) return 0
  const { pts, acc, total } = cumulative(coords)
  const q = toMetres(coords[0], p)
  let best = { d: Infinity, at: 0 }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const f = Math.min(1, Math.max(0, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2))
    const d = Math.hypot(a.x + dx * f - q.x, a.y + dy * f - q.y)
    if (d < best.d) best = { d, at: acc[i - 1] + Math.sqrt(len2) * f }
  }
  return total ? best.at / total : 0
}

// Everything the tracking map needs about the courier right now.
// status: the delivery's status ('accepted' = on the way to the store, 'picked_up' = on the way to you)
export function riderEstimate({ coords, status, pickedUpAt, now, fix }) {
  const total = pathLength(coords)
  const carrying = status === 'picked_up'
  const fresh = !!fix && now - Date.parse(fix.at) < FIX_FRESH_MS
  let pos, progress
  if (fresh) {
    pos = [fix.lat, fix.lng]
    progress = carrying ? progressOf(coords, pos) : 0
  } else {
    const walked = carrying && pickedUpAt ? ((now - pickedUpAt) / 1000) * WALK_M_PER_S : 0
    progress = total ? Math.min(MAX_ESTIMATE, walked / total) : 0
    pos = pointAt(coords, progress)
  }
  const metresLeft = carrying ? Math.round((1 - progress) * total) : null
  return {
    lat: pos[0], lng: pos[1], progress,
    source: fresh ? 'gps' : 'estimate',
    accuracy: fresh ? fix.accuracy : null,
    metresLeft,
    secondsLeft: metresLeft == null ? null : Math.round(metresLeft / WALK_M_PER_S),
  }
}
