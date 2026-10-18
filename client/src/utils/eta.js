// Pure ETA maths. Turns "now + how long to wait" into clock times.
//
//   readyAt     = now + waitSeconds                     (kitchen done)
//   deliveredAt = now + waitSeconds + walkingSeconds    (courier arrives)
//
// For self-pickup there is no walking leg, so pass walkingSeconds = 0 (default)
// and ignore deliveredAt.

function formatClock(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * @param {number} nowMs           current time in ms (Date.now())
 * @param {number} waitSeconds     kitchen wait estimate in seconds
 * @param {number} [walkingSeconds=0] walking leg for delivery, in seconds
 * @returns {{ readyAt: Date, deliveredAt: Date, readyAtLabel: string, deliveredAtLabel: string, readyInSeconds: number, deliveredInSeconds: number }}
 */
export function computeEta(nowMs, waitSeconds, walkingSeconds = 0) {
  const wait = Math.max(0, Number(waitSeconds) || 0)
  const walk = Math.max(0, Number(walkingSeconds) || 0)
  const base = Number(nowMs) || Date.now()

  const readyAt = new Date(base + wait * 1000)
  const deliveredAt = new Date(base + (wait + walk) * 1000)

  return {
    readyAt,
    deliveredAt,
    readyAtLabel: formatClock(readyAt),
    deliveredAtLabel: formatClock(deliveredAt),
    readyInSeconds: wait,
    deliveredInSeconds: wait + walk,
  }
}

export { formatClock }
