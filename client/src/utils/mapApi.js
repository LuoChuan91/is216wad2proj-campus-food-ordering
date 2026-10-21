// Walking time between two campus points, in seconds.
//
// This is the map hook the OrderTracking page needs: tracking has to show a
// walking leg immediately, so it asks for a number synchronously. The estimate
// uses the same model as the map's own fallback (app/engine.js walkEstimate):
// straight line x 1.3 for paths, walking at 75 m/min. When the map has the real
// OSRM route (app/routing.js), that route is used instead by the map itself.

// Used when we don't know both points (e.g. the delivery feature hasn't given us
// real coordinates yet).
export const DEFAULT_WALK_SECONDS = 6 * 60

const DETOUR = 1.3          // walking paths are about 30% longer than a straight line
const METRES_PER_MINUTE = 75

function hasPoint(p) {
  return !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
}

function distanceMetres(a, b) {
  const R = 6371000
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(Number(b.lat) - Number(a.lat))
  const dLng = rad(Number(b.lng) - Number(a.lng))
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(Number(a.lat))) * Math.cos(rad(Number(b.lat))) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function estimateWalkingSeconds(from, to) {
  if (!hasPoint(from) || !hasPoint(to)) return DEFAULT_WALK_SECONDS
  const metres = distanceMetres(from, to)
  if (metres < 1) return 0
  return Math.round(((metres * DETOUR) / METRES_PER_MINUTE) * 60)
}
