// Orders the student switched from peer delivery to pickup themselves (this session).
// The "Switched to pickup" notification reads this so it doesn't say "no courier took
// your order in 10 min" when the student chose to collect it.
const switched = new Set()

export const markSwitchedToPickup = (orderId) => { switched.add(orderId) }
export const wasSwitchedToPickup = (orderId) => switched.has(orderId)
