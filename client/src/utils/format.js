// Small helpers for showing values on screen. They don't change any data.

const pad = (n) => String(n).padStart(2, '0')
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 9.8 or "9.80" -> "$9.80"  (Supabase sends numeric columns as text, so this accepts both)
export const money = (amount) => `$${Number(amount || 0).toFixed(2)}`

// A time (a Date, milliseconds, or text like "2026-10-14T04:41:00Z") -> "12:51 pm"
export const clockTime = (time = Date.now()) => {
  const d = new Date(time)
  const h = d.getHours()
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}`
}

// -> "Mon 12 Oct"
export const dateLabel = (time = Date.now()) => {
  const d = new Date(time)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// -> "Good morning", "Good afternoon" or "Good evening"
export const greeting = (time = Date.now()) => {
  const h = new Date(time).getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// "Aiden Tan" -> "Aiden"
export const firstName = (name = '') => name.split(' ')[0]

// "Sakura Bento House" -> "SB"
export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()

// An order's id -> "#E9A3", a short code to read out at the counter
export const orderCode = (id = '') => `#${id.slice(0, 4).toUpperCase()}`

// A store's discount: "15% student discount" (or "15% student" when short), "$1.00 off", or ''
export const discountLabel = (store, short = false) => {
  if (store.discount_type === 'percentage') return `${Number(store.discount_per)}% student${short ? '' : ' discount'}`
  if (store.discount_type === 'dollar') return `${money(store.discount_dol)} off`
  return ''
}

// stores.open_hours ({ mon: ['10:30', '20:30'], ... }) -> today's hours "10:30 – 20:30", or ''
export const todayHours = (openHours = {}) => {
  const hours = (openHours || {})[['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]]
  return hours ? `${hours[0]} – ${hours[1]}` : ''
}

// An option group's rule as a label: "Required · pick 1", "Required · pick 3 to 6", "Optional · up to 2"
export const ruleLabel = (group) => {
  const min = group.required ? Math.max(1, group.min_select) : group.min_select
  const max = group.type === 'single' ? 1 : group.max_select
  if (group.type === 'single') return group.required ? 'Required · pick 1' : 'Optional · pick 1'
  if (min > 0) return min === max ? `Required · pick ${min}` : `Required · pick ${min} to ${max}`
  return `Optional · up to ${max}`
}

// A colour for a store, picked from its name (the database has no colour per store).
// The same name always gets the same colour. Used by StoreMono and the store page's header.
const STORE_COLOURS = ['#c2410c', '#0f766e', '#3a66cc', '#7b4bb7', '#9a3412', '#2e8f57', '#a21caf', '#b7791f', '#d9472b', '#4b8f2a', '#8a5a2b', '#2f2f35']
export const storeColour = (name = '') => STORE_COLOURS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % STORE_COLOURS.length]
