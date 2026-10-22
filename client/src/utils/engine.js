// Pure logic from the prototype: option rules, pricing, time and distance helpers. No Vue in here.
// The server checks the same rules again and works out the real price (services/orders.service.js),
// so these are only for showing things on screen before the order is sent.

const SGT_OFFSET = 8 * 3600e3
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n) => String(n).padStart(2, '0')
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
export const money = (n) => '$' + round2(Number(n) || 0).toFixed(2)
export const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0)
const singular = (w) => (w.endsWith('s') ? w.slice(0, -1) : w)

/* ---------- Option groups ---------- */

// A single-choice group always allows exactly one pick; required groups need at least one.
export function rule(group) {
  const max = group.type === 'single' ? 1 : group.max_select
  const min = group.required ? Math.max(1, group.min_select) : group.min_select
  return { min, max }
}

export function ruleLabel(group) {
  const { min, max } = rule(group)
  if (group.type === 'single') return group.required ? 'Required · pick 1' : 'Optional · pick 1'
  if (min > 0) return min === max ? `Required · pick ${min}` : `Required · pick ${min} to ${max}`
  return `Optional · up to ${max}`
}

export function groupStatus(group, options, selected) {
  const { min, max } = rule(group)
  const count = options.filter((o) => o.group_id === group.id && selected.includes(o.id)).length
  const noun = group.name.toLowerCase()
  let hint = ''
  if (count < min) {
    const need = min - count
    hint = group.type === 'single' ? `Choose a ${noun}` : `Pick ${need} more ${need === 1 ? singular(noun) : noun}`
  }
  return { min, max, count, ok: count >= min && count <= max, full: count >= max, hint }
}

export function validate(groups, options, selected) {
  const byGroup = {}
  let hint = ''
  for (const g of groups) {
    const st = groupStatus(g, options, selected)
    byGroup[g.id] = st
    if (!st.ok && !hint) hint = st.hint || 'Check your choices'
  }
  return { ok: groups.every((g) => byGroup[g.id].ok), byGroup, hint }
}

// unit price = base price + the price delta of every selected option
export function unitPrice(item, options, selected) {
  return round2(Number(item.price) + sum(options.filter((o) => selected.includes(o.id)), (o) => Number(o.price_delta)))
}

// The chosen options with their group names, for showing in the cart
export function snapshot(groups, options, selected) {
  const out = []
  for (const g of groups) {
    for (const o of options.filter((x) => x.group_id === g.id && selected.includes(x.id))) {
      out.push({ option_id: o.id, group_name: g.name, name: o.name, price_delta: Number(o.price_delta) })
    }
  }
  return out
}

// A store's discount on a subtotal: discount_type is 'percentage', 'dollar' or null
export function discountFor(store, subtotal) {
  if (!store) return 0
  if (store.discount_type === 'percentage') return round2((subtotal * Number(store.discount_per)) / 100)
  if (store.discount_type === 'dollar') return round2(Math.min(subtotal, Number(store.discount_dol)))
  return 0
}

// e.g. "10% student discount" or "$1.00 off"
export function discountLabel(store) {
  if (!store || !store.discount_type) return ''
  if (store.discount_type === 'percentage') return `${Number(store.discount_per)}% student discount`
  return `${money(store.discount_dol)} off`
}
export function discountShort(store) {
  if (!store || !store.discount_type) return ''
  return store.discount_type === 'percentage' ? `${Number(store.discount_per)}% off` : `${money(store.discount_dol)} off`
}

// The discount applies to food only, never to the delivery fee
export function totals(lines, store, type, fee) {
  const subtotal = round2(sum(lines, (l) => l.unit_price * l.qty))
  const discount = discountFor(store, subtotal)
  const delivery_fee = type === 'delivery' ? fee : 0
  return { subtotal, discount, delivery_fee, total: round2(subtotal - discount + delivery_fee) }
}

/* ---------- Time (always shown in Singapore time) ---------- */

export function parts(ms) {
  const d = new Date(ms + SGT_OFFSET)
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), day: DAYS[d.getUTCDay()], h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() }
}
const h12 = (h) => ((h + 11) % 12) + 1
export const clock = (ms) => { const p = parts(ms); return `${h12(p.h)}:${pad(p.m)} ${p.h < 12 ? 'am' : 'pm'}` }
export const hhmm = (str) => { const [h, m] = str.split(':').map(Number); return `${h12(h)}:${pad(m)} ${h < 12 ? 'am' : 'pm'}` }
export const dateLabel = (ms) => { const p = parts(ms); return `${p.day[0].toUpperCase()}${p.day.slice(1)} ${p.d} ${MONTHS[p.mo - 1]}` }
export const ymd = (ms) => { const p = parts(ms); return `${p.y}${pad(p.mo)}${pad(p.d)}` }
export const minsUntil = (from, to) => Math.max(0, Math.ceil((to - from) / 60000))
export const countdown = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}` }
export const sameDay = (a, b) => ymd(a) === ymd(b)

export function since(from, now) {
  const m = Math.floor((now - from) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  return sameDay(from, now) ? clock(from) : dateLabel(from)
}

// Today's opening hours. In the database a day is ["08:00", "20:00"] (the prototype allowed
// several ranges, [["10:30", "14:30"], ["15:30", "18:45"]], so both shapes work).
function rangesToday(store, now) {
  const day = (store.open_hours || {})[parts(now).day]
  if (!day || !day.length) return []
  return Array.isArray(day[0]) ? day : [day]
}

export function hoursToday(store, now) {
  const r = rangesToday(store, now)
  return r.length ? r.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(', ') : 'Closed today'
}

// { open, label }: can students order right now, and what to say about it
export function openStatus(store, now, enforceHours) {
  if (!store.is_open) return { open: false, label: 'Paused by the store' }
  const p = parts(now)
  const mins = p.h * 60 + p.m
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const ranges = rangesToday(store, now)
  for (const [a, b] of ranges) if (mins >= toMin(a) && mins < toMin(b)) return { open: true, label: `Open until ${hhmm(b)}` }
  if (!enforceHours) return { open: true, label: ranges.length ? `Taking orders · usual hours ${hoursToday(store, now)}` : 'Taking orders' }
  const next = ranges.find(([a]) => toMin(a) > mins)
  return next ? { open: false, label: `Closed, opens ${hhmm(next[0])}` } : { open: false, label: 'Closed for today' }
}

/* ---------- Distance ---------- */

export function distanceM(a, b) {
  const R = 6371000
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Fallback when the routing API can't be reached: straight line x 1.3 for paths, walking at 75 m/min
export function walkEstimate(a, b) {
  const meters = Math.round(distanceM(a, b) * 1.3)
  return { meters, minutes: Math.max(1, Math.round(meters / 75)), source: 'estimate', coords: [[a.lat, a.lng], [b.lat, b.lng]] }
}
