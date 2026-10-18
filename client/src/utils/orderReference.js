// Turn a database UUID into a short, human-readable reference.
//
// The schema only has UUID primary keys (no friendly order/delivery number), so
// we derive a readable reference on the client for display. It is deterministic:
// the same id always yields the same reference.
//   toOrderReference('3f2a1b9c-...')        -> 'ORD-3F2A1B'
//   toOrderReference('3f2a1b9c-...', 'DLV')  -> 'DLV-3F2A1B'

/**
 * @param {string} uuid
 * @param {string} [prefix='ORD']
 * @returns {string}
 */
export function toOrderReference(uuid, prefix = 'ORD') {
  if (!uuid || typeof uuid !== 'string') return `${prefix}-??????`
  // First 6 hex chars of the uuid (strip dashes), uppercased.
  const hex = uuid.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `${prefix}-${hex.padEnd(6, '0')}`
}
