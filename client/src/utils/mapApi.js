// Synchronous walking-time estimate (seconds) between two campus points, using the
// same model as engine.walkEstimate (straight line x 1.3 at 75 m/min).
import { distanceM } from '@/utils/engine.js'

// Used when we don't know both points (e.g. before real coordinates arrive).
export const DEFAULT_WALK_SECONDS = 6 * 60

const DETOUR = 1.3          // walking paths are about 30% longer than a straight line
const METRES_PER_MINUTE = 75

function hasPoint(p) {
  return !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
}

export function estimateWalkingSeconds(from, to) {
  if (!hasPoint(from) || !hasPoint(to)) return DEFAULT_WALK_SECONDS
  const metres = distanceM(
    { lat: Number(from.lat), lng: Number(from.lng) },
    { lat: Number(to.lat), lng: Number(to.lng) },
  )
  if (metres < 1) return 0
  return Math.round(((metres * DETOUR) / METRES_PER_MINUTE) * 60)
}
