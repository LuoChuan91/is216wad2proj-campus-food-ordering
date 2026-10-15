// App state and actions (ported from the prototype's store.js).
// Every screen reads from one reactive object (S), asks questions through Q, and changes things
// only through an action in A. Actions call our Express API (api.js); live.js polls the API so
// changes made in other tabs or by other people show up within a few seconds.
import { reactive } from 'vue'
import * as E from './engine'
import { config as cfg } from './config'
import { api } from './api'
import { getRoute, ensureRoute } from './routing'

// Where "you" are when the browser's location isn't used: the middle of the SMU campus
export const DEFAULT_PLACE = { lat: 1.2966, lng: 103.8499, label: 'SMU campus' }

const PALETTE = ['#d9472b', '#2e8f57', '#3a66cc', '#8a5a2b', '#7b4bb7', '#c2410c', '#0f766e', '#a21caf', '#b7791f', '#2f2f35']
let lineSeq = 0

export function studentUi(tab = 'explore') {
  return {
    tab, page: null, sheet: null, venueId: null, storeId: null, itemId: null,
    draft: { selected: [], qty: 1 },
    cart: { storeId: null, lines: [] },
    checkout: { type: 'pickup', dropoffId: null, note: '' },
    estimate: null, // when the cart would be ready, from the server
    pay: { state: 'idle', orderId: null, error: '', result: null },
    trackOrderId: null, exploreSeen: tab === 'explore', search: '',
    place: null, locating: false, locateError: '',
    list: { filter: 'all', sort: 'recommended', search: '' }, // the Stores tab
  }
}
function staffUi(storeId = null) {
  return { merchantTab: 'orders', adminTab: 'approvals', storeId, venueDraft: { name: '', lat: '', lng: '' }, formError: '', saving: false }
}

// Which account this browser tab is signed in as. Each tab keeps its own (sessionStorage),
// so you can be a student in one tab and the merchant in another.
const SESSION_KEY = 'campus-delights-session'
const session = {
  load() { try { return sessionStorage.getItem(SESSION_KEY) } catch { return null } },
  save(id) { try { if (id) sessionStorage.setItem(SESSION_KEY, id); else sessionStorage.removeItem(SESSION_KEY) } catch { /* private mode */ } },
}
// "Available for delivery jobs" isn't a database column yet, so each browser remembers it
const courierKey = (id) => `campus-delights-courier-${id}`
const loadCourier = (id) => { try { return localStorage.getItem(courierKey(id)) === '1' } catch { return false } }
const saveCourier = (id, on) => { try { localStorage.setItem(courierKey(id), on ? '1' : '0') } catch { /* private mode */ } }

export const S = reactive({
  loaded: false,      // the first load from the server finished
  loadError: '',
  online: true,       // false while the server can't be reached
  now: Date.now(),
  session: { userId: null },
  db: {
    profiles: [], venues: [], destinations: [], stores: [], menu: [],
    orders: [],       // a student's own orders, or a merchant's stores' orders
    jobs: [], expiredJobs: [], myJobs: [], // peer delivery
  },
  waits: { stores: {}, orders: {}, slots: 2 },
  ui: { student: studentUi(), staff: staffUi() },
  courierOn: false,
  notifications: [],  // this tab's notification history (newest first)
  toasts: [],
  menu: null,         // which top-bar dropdown is open
  readId: 0,          // notifications up to this id have been seen in the bell
  mapOffline: false,
  busy: {},           // { [id]: true } while a button's request is running
})

/* ---------- turning server rows into what the screens use ---------- */
const ms = (t) => (t ? Date.parse(t) : null)

function initials(name) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// Adds display fields the database doesn't have: monogram, colour, cuisine (from the menu
// categories) and where in the building the store is
function decorateStores() {
  for (const [i, s] of S.db.stores.entries()) {
    const cats = [...new Set(S.db.menu.filter((m) => m.store_id === s.id).map((m) => m.category))]
    s.mono = initials(s.name)
    s.color = PALETTE[i % PALETTE.length]
    s.cuisine = cats.join(' · ') || s.description || 'Food'
    const v = S.db.venues.find((x) => x.id === s.venue_id)
    s.unit_no = v ? v.address || v.name : ''
  }
}

function normaliseOrder(o) {
  const d = o.delivery
  return {
    ...o,
    created_at: ms(o.created_at), paid_at: ms(o.paid_at), ready_at: ms(o.ready_at),
    completed_at: ms(o.completed_at), preparing_at: ms(o.preparing_at),
    items: (o.order_items || []).map((l) => ({
      id: l.id, menu_item_id: l.menu_item_id, qty: l.qty, unit_price: Number(l.unit_price),
      name: (l.menu_items && l.menu_items.name) || 'Item', option_names: l.option_names || [],
    })),
    delivery: d ? {
      ...d, created_at: ms(d.created_at), expires_at: ms(d.expires_at), accepted_at: ms(d.accepted_at),
      picked_up_at: ms(d.picked_up_at), delivered_at: ms(d.delivered_at),
    } : null,
  }
}

function normaliseJob(j) {
  return {
    ...j, created_at: ms(j.created_at), expires_at: ms(j.expires_at), accepted_at: ms(j.accepted_at),
    picked_up_at: ms(j.picked_up_at), delivered_at: ms(j.delivered_at),
    order: { ...j.order, ready_at: ms(j.order.ready_at) },
  }
}

/* ---------- queries ---------- */
const by = (arr, id) => arr.find((x) => x.id === id)
const ACTIVE = ['paid', 'preparing', 'ready']

export const Q = {
  me: () => by(S.db.profiles, S.session.userId),
  user: (id) => by(S.db.profiles, id),
  venue: (id) => by(S.db.venues, id),
  store: (id) => by(S.db.stores, id),
  item: (id) => by(S.db.menu, id),
  order: (id) => by(S.db.orders, id),
  dropoff: (id) => by(S.db.destinations, id),
  // option groups, required ones first (otherwise in the database's order)
  groups(itemId) {
    const item = Q.item(itemId)
    if (!item) return []
    return (item.option_groups || []).slice().sort((a, b) => Number(b.required) - Number(a.required))
  },
  options: (itemId) => Q.groups(itemId).flatMap((g) => (g.options || []).map((o) => ({ ...o, group_id: g.id }))),
  storesAt: (venueId) => S.db.stores.filter((s) => s.venue_id === venueId),
  storesOf: (merchantId) => S.db.stores.filter((s) => s.merchant_id === merchantId),
  menu: (storeId) => S.db.menu.filter((m) => m.store_id === storeId),
  ordersOf: (userId) => S.db.orders.filter((o) => o.student_id === userId).sort((a, b) => b.created_at - a.created_at),
  isActive: (o) => ACTIVE.includes(o.status) && !(o.delivery && o.delivery.status === 'delivered'),
  open: (store) => E.openStatus(store, S.now, cfg.enforceOpeningHours),
  queue: () => S.waits.orders,
  storeWait(storeId) {
    const w = S.waits.stores[storeId]
    return w && w.minutes != null ? w : null
  },
  place() { const u = S.ui.student; return u.place || DEFAULT_PLACE },
  walk: (venue) => getRoute(Q.place(), venue),
  activeJob: () => S.db.myJobs.find((d) => d.status === 'accepted' || d.status === 'picked_up'),
  openJobs: () => S.db.jobs.filter((d) => d.order.student_id !== S.session.userId),
  earnings() {
    const done = S.db.myJobs.filter((d) => d.status === 'delivered')
    const today = done.filter((d) => E.sameDay(d.delivered_at, S.now))
    const week = done.filter((d) => S.now - d.delivered_at < 7 * 864e5)
    return { today: E.sum(today, (d) => d.fee), todayCount: today.length, week: E.sum(week, (d) => d.fee), weekCount: week.length }
  },
  unread: () => S.notifications.filter((n) => n.id > S.readId).length,
}

/* ---------- notifications (pop-ups and the bell) ---------- */
let noteSeq = 0
export function notify(title, body, tone = 'brand') {
  const n = { id: ++noteSeq, title, body, tone, created_at: Date.now() }
  S.notifications.unshift(n)
  if (S.notifications.length > 30) S.notifications.length = 30
  A.pushToast(n)
}

// Runs an API call for a button: marks it busy, shows the server's error as a pop-up if it fails
async function run(key, fn) {
  if (S.busy[key]) return null
  S.busy[key] = true
  try {
    return await fn()
  } catch (err) {
    notify("That didn't work", err.message, 'warn')
    return null
  } finally {
    delete S.busy[key]
  }
}

/* ---------- loading from the server ---------- */
export async function loadCatalog() {
  const [profiles, venues, destinations, stores, menu] = await Promise.all([
    api.profiles(), api.venues(), api.destinations(), api.stores(), api.menu(),
  ])
  S.db.profiles = profiles
  S.db.venues = venues
  S.db.destinations = destinations
  S.db.menu = menu
  S.db.stores = stores
  decorateStores()
}

// Everything that changes from minute to minute, for whoever is signed in
export async function loadLive() {
  const me = Q.me()
  if (!me) return
  const jobs = []
  jobs.push(api.waitTimes().then((w) => { S.waits = w }))
  if (me.role === 'student') {
    jobs.push(api.profile(me.id).then((p) => Object.assign(me, p)))
    jobs.push(api.studentOrders(me.id).then((list) => { S.db.orders = list.map(normaliseOrder) }))
    jobs.push(api.myJobs(me.id).then((list) => { S.db.myJobs = list.map(normaliseJob) }))
    if (S.courierOn) {
      jobs.push(api.openJobs().then((list) => { S.db.jobs = list.map(normaliseJob) }))
      jobs.push(api.expiredJobs().then((list) => { S.db.expiredJobs = list.map(normaliseJob) }))
    } else {
      S.db.jobs = []
      S.db.expiredJobs = []
    }
  } else if (me.role === 'merchant') {
    const mine = Q.storesOf(me.id)
    jobs.push(Promise.all(mine.map((s) => api.storeOrders(s.id))).then((lists) => { S.db.orders = lists.flat().map(normaliseOrder) }))
  } else {
    jobs.push(api.profiles().then((list) => { S.db.profiles = list }))
  }
  await Promise.all(jobs)
}

/* ---------- actions ---------- */
export const A = {
  /* sign-in is simulated: pick an account from the database. Supabase Auth replaces this later. */
  signIn(userId) {
    const p = Q.user(userId)
    if (!p) return
    S.session.userId = userId
    session.save(userId)
    S.toasts.splice(0)
    S.notifications.splice(0)
    S.menu = null
    S.readId = 0
    S.db.orders = []
    S.db.jobs = []
    S.db.expiredJobs = []
    S.db.myJobs = []
    S.courierOn = p.role === 'student' && loadCourier(userId)
    if (p.role === 'student') S.ui.student = studentUi('explore')
    else S.ui.staff = staffUi(p.role === 'merchant' ? (Q.storesOf(userId)[0] || {}).id || null : null)
  },
  signOut() { S.session.userId = null; session.save(null); S.toasts.splice(0); S.menu = null },
  restoreSession() { const id = session.load(); if (id && Q.user(id)) A.signIn(id) },

  tick() { S.now = Date.now() },

  /* pop-up notifications in this tab */
  pushToast(n) {
    if (S.toasts.some((t) => t.id === n.id)) return
    S.toasts.push({ id: n.id, title: n.title, body: n.body, tone: n.tone })
    const max = window.innerWidth < 720 ? 1 : 3 // phones show the newest one only
    while (S.toasts.length > max) S.toasts.shift()
    setTimeout(() => A.dismissToast(n.id), 6000)
  },
  dismissToast(id) { const i = S.toasts.findIndex((t) => t.id === id); if (i >= 0) S.toasts.splice(i, 1) },
  toggleMenu(name) {
    S.menu = S.menu === name ? null : name
    if (S.menu === 'bell') S.readId = S.notifications.length ? S.notifications[0].id : 0
  },

  /* student navigation */
  setTab(tab) { const u = S.ui.student; u.tab = tab; u.page = null; u.sheet = null; if (tab === 'explore') u.exploreSeen = true },
  setSearch(q) { const u = S.ui.student; u.search = q.slice(0, 40); if (q && u.sheet === 'venue') { u.sheet = null; u.venueId = null } },
  setListSearch(q) { S.ui.student.list.search = q.slice(0, 40) },
  setListFilter(f) { S.ui.student.list.filter = f },
  setListSort(s) { S.ui.student.list.sort = s },
  openStoreItem(storeId, itemId) { A.openStore(storeId); A.openItem(itemId) },
  openVenue(venueId) {
    const u = S.ui.student
    u.tab = 'explore'; u.exploreSeen = true; u.page = null; u.venueId = venueId; u.sheet = 'venue'
    ensureRoute(Q.place(), Q.venue(venueId))
  },
  locate() {
    const u = S.ui.student
    if (!navigator.geolocation) { u.locateError = "Location isn't available in this browser."; return }
    u.locating = true; u.locateError = ''
    navigator.geolocation.getCurrentPosition((pos) => {
      u.locating = false
      u.place = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your location' }
      for (const v of S.db.venues) ensureRoute(u.place, v)
    }, () => { u.locating = false; u.locateError = "Couldn't get your location. Allow location access and try again." }, { enableHighAccuracy: true, timeout: 8000 })
  },
  closeSheet() {
    const u = S.ui.student
    if (u.sheet === 'pay' && u.pay.state === 'processing') return
    if (u.sheet === 'pay' && u.pay.state === 'done') { A.openTracking(u.pay.orderId); return }
    if (u.sheet === 'venue') u.venueId = null
    u.sheet = null
  },
  openStore(storeId) { const u = S.ui.student; u.storeId = storeId; u.page = 'store'; u.sheet = null },
  back() {
    const u = S.ui.student
    if (u.sheet === 'item' || u.sheet === 'pay') { A.closeSheet(); return }
    if (u.page === 'checkout') { u.page = 'store'; u.storeId = u.cart.storeId || u.storeId; return }
    if (u.page === 'track') { u.page = null; return }
    if (u.page === 'store') { u.page = null; u.sheet = u.venueId && u.tab === 'explore' ? 'venue' : null; return }
    u.sheet = null
  },
  openItem(itemId) {
    const u = S.ui.student
    const item = Q.item(itemId)
    if (!item || !item.available) return
    u.itemId = itemId; u.draft = { selected: [], qty: 1 }; u.sheet = 'item'
  },
  toggleOption(optionId) {
    const u = S.ui.student
    const opts = Q.options(u.itemId)
    const o = by(opts, optionId)
    const g = Q.groups(u.itemId).find((x) => x.id === o.group_id)
    if (!o.available) return
    const sel = u.draft.selected
    const inGroup = (id) => (by(opts, id) || {}).group_id === g.id
    if (g.type === 'single') {
      u.draft.selected = sel.includes(optionId) && !g.required ? sel.filter((id) => id !== optionId) : sel.filter((id) => !inGroup(id)).concat(optionId)
    } else if (sel.includes(optionId)) {
      u.draft.selected = sel.filter((id) => id !== optionId)
    } else if (sel.filter(inGroup).length < E.rule(g).max) {
      u.draft.selected = sel.concat(optionId)
    }
  },
  setDraftQty(q) { S.ui.student.draft.qty = Math.max(1, Math.min(9, q)) },
  addToCart() {
    const u = S.ui.student
    const item = Q.item(u.itemId)
    const groups = Q.groups(item.id)
    const opts = Q.options(item.id)
    if (!E.validate(groups, opts, u.draft.selected).ok) return
    if (u.cart.storeId && u.cart.storeId !== item.store_id) u.cart.lines = [] // one store per order
    u.cart.storeId = item.store_id
    u.cart.lines.push({ key: `line-${++lineSeq}`, menu_item_id: item.id, qty: u.draft.qty, selected: u.draft.selected.slice(), unit_price: E.unitPrice(item, opts, u.draft.selected) })
    u.sheet = null
  },
  setLineQty(key, qty) {
    const u = S.ui.student
    const line = u.cart.lines.find((l) => l.key === key)
    if (!line) return
    if (qty <= 0) u.cart.lines = u.cart.lines.filter((l) => l.key !== key); else line.qty = Math.min(9, qty)
    if (!u.cart.lines.length) { u.cart.storeId = null; if (u.page === 'checkout') u.page = 'store' }
    else A.refreshEstimate()
  },
  openCheckout() {
    const u = S.ui.student
    if (!u.cart.lines.length) return
    u.page = 'checkout'; u.sheet = null
    if (!u.checkout.dropoffId && S.db.destinations.length) {
      const me = Q.place()
      u.checkout.dropoffId = S.db.destinations.slice().sort((a, b) => E.distanceM(me, a) - E.distanceM(me, b))[0].id
    }
    A.refreshEstimate()
  },
  // Ask the server's wait-time engine when this cart would be ready
  async refreshEstimate() {
    const u = S.ui.student
    if (!u.cart.lines.length) { u.estimate = null; return }
    try {
      u.estimate = await api.estimate(u.cart.storeId, u.cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, qty: l.qty })))
    } catch { u.estimate = null }
  },
  setFulfilment(type) { S.ui.student.checkout.type = type },
  setDropoff(id) { S.ui.student.checkout.dropoffId = id },
  setNote(note) { S.ui.student.checkout.note = note.slice(0, 80) },
  openPay() { const u = S.ui.student; if (!u.cart.lines.length) return; u.pay = { state: 'idle', orderId: null, error: '', result: null }; u.sheet = 'pay' },
  // Payment is simulated: the server checks and prices the order, then saves it with a payment record
  async confirmPay() {
    const u = S.ui.student
    if (!u.cart.lines.length || u.pay.state === 'processing' || u.pay.state === 'done') return
    u.pay.state = 'processing'; u.pay.error = ''
    const body = {
      student_id: S.session.userId,
      type: u.checkout.type,
      items: u.cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, qty: l.qty, option_ids: l.selected })),
    }
    if (u.checkout.type === 'delivery') { body.destination_id = u.checkout.dropoffId; body.note = u.checkout.note }
    try {
      const [saved] = await Promise.all([api.placeOrder(body), new Promise((r) => setTimeout(r, 900))])
      await loadLive().catch(() => {}) // so the new order is there when the tracking page opens
      u.pay = { state: 'done', orderId: saved.id, error: '', result: saved } // the cart empties when the tracking page opens
    } catch (err) {
      u.pay.state = 'error'
      u.pay.error = err.message
    }
  },
  openTracking(orderId) {
    const u = S.ui.student
    if (u.pay.state === 'done') { u.cart = { storeId: null, lines: [] }; u.checkout.note = ''; u.estimate = null; u.pay = { state: 'idle', orderId: null, error: '', result: null } }
    u.sheet = null; u.page = 'track'; u.trackOrderId = orderId
  },

  /* merchant */
  setMerchantTab(tab) { S.ui.staff.merchantTab = tab },
  setMerchantStore(storeId) { S.ui.staff.storeId = storeId },
  async setOrderStatus(orderId, status) {
    const saved = await run(orderId, () => api.setOrderStatus(orderId, status))
    if (saved) {
      const i = S.db.orders.findIndex((o) => o.id === orderId)
      if (i >= 0) S.db.orders[i] = normaliseOrder(saved)
      loadLive().catch(() => {})
    }
  },
  startPreparing: (orderId) => A.setOrderStatus(orderId, 'preparing'),
  markReady: (orderId) => A.setOrderStatus(orderId, 'ready'),
  markCollected: (orderId) => A.setOrderStatus(orderId, 'completed'),
  async setItemAvailable(itemId, available) {
    const saved = await run(itemId, () => api.setItemAvailable(itemId, available))
    if (saved) Q.item(itemId).available = saved.available
  },
  async setStoreOpen(storeId, open) {
    const saved = await run(storeId, () => api.updateStore(storeId, { is_open: open }))
    if (saved) Q.store(storeId).is_open = saved.is_open
  },

  /* courier */
  setAvailable(on) {
    S.courierOn = on
    saveCourier(S.session.userId, on)
    loadLive().catch(() => {})
  },
  async courierAction(jobId, action) {
    const saved = await run(jobId, () => api.delivery(jobId, action, S.session.userId))
    if (saved) await loadLive().catch(() => {})
  },
  acceptJob: (jobId) => A.courierAction(jobId, 'accept'),
  pickUp: (jobId) => A.courierAction(jobId, 'pickup'),
  deliver: (jobId) => A.courierAction(jobId, 'deliver'),

  /* admin */
  setAdminTab(tab) { S.ui.staff.adminTab = tab },
  async setStudentStatus(userId, status) {
    const saved = await run(userId, () => api.setProfileStatus(userId, status))
    if (saved) Object.assign(Q.user(userId), saved)
  },
  approveStudent: (id) => A.setStudentStatus(id, 'active'),
  rejectStudent: (id) => A.setStudentStatus(id, 'blocked'),
  setVenueDraft(field, value) { S.ui.staff.venueDraft[field] = value; S.ui.staff.formError = '' },
  async addVenue() {
    const t = S.ui.staff
    const d = t.venueDraft
    const lat = parseFloat(d.lat)
    const lng = parseFloat(d.lng)
    if (!d.name.trim()) { t.formError = 'Give the venue a name.'; return }
    if (!(lat > 1.15 && lat < 1.48 && lng > 103.6 && lng < 104.1)) { t.formError = 'Click the map to place the pin inside Singapore.'; return }
    t.saving = true
    try {
      const v = await api.addVenue({ name: d.name.trim(), lat, lng, type: 'eatery' })
      S.db.venues.push(v)
      t.venueDraft = { name: '', lat: '', lng: '' }
    } catch (err) {
      t.formError = err.message
    } finally {
      t.saving = false
    }
  },
}
