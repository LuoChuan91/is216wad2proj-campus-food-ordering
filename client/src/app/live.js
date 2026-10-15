// Start-up and live updates (ported from the prototype's app.js and main.js).
// - loads the stores, menus and accounts from the server, and restores this tab's sign-in
// - asks the server for news every few seconds (polling) and turns changes into notifications
// - keeps the address bar in step with the screen, so the back button and reloading work
import { watch, nextTick } from 'vue'
import { S, Q, A, notify, loadCatalog, loadLive } from './state'
import * as E from './engine'
import { config as cfg } from './config'

const ROLE = { student: 'Student', merchant: 'Merchant', admin: 'Admin' }
const first = (name) => (name || '').split(' ')[0]

/* ---------- notifications: compare what the server says now with what it said last time ---------- */
let prev = null

function snapshot(me) {
  return {
    userId: me.id,
    status: me.status,
    orders: Object.fromEntries(S.db.orders.map((o) => [o.id, { status: o.status, fallback: o.fallback, d: o.delivery && o.delivery.status }])),
    jobs: new Set(S.db.jobs.map((j) => j.id)),
    myJobs: Object.fromEntries(S.db.myJobs.map((j) => [j.id, j.order.status])),
    courierOn: S.courierOn,
  }
}

function announceChanges() {
  const me = Q.me()
  if (!me) { prev = null; return }
  const now = snapshot(me)
  const was = prev
  prev = now
  if (!was || was.userId !== me.id) return // first look after signing in: nothing to announce

  if (me.role === 'student') {
    if (was.status !== 'active' && me.status === 'active') notify('Account approved', 'You can now order food and deliver for others', 'ok')
    for (const o of S.db.orders) {
      const p = was.orders[o.id]
      if (!p) continue
      const s = Q.store(o.store_id) || { name: 'The store' }
      const d = o.delivery
      if (p.status === 'paid' && o.status === 'preparing') {
        const q = S.waits.orders[o.id]
        notify(`${s.name} is cooking your order`, `Order #${o.code}${q ? ' · ready around ' + E.clock(q.readyAt) : ''}`, 'info')
      }
      if (p.status !== 'ready' && o.status === 'ready') {
        if (o.type === 'pickup') notify('Your food is ready', `Collect order #${o.code} at ${s.name}`, 'ok')
        else if (d && d.courier_name) notify('Your food is ready', `${first(d.courier_name)} is picking it up now`, 'ok')
        else notify('Your food is ready', 'Waiting for a student courier to accept', 'ok')
      }
      if (d && p.d !== d.status) {
        const drop = Q.dropoff(d.destination_id)
        if (d.status === 'accepted') notify(`${first(d.courier_name)} accepted your delivery`, `They'll bring it to ${drop ? drop.name : 'you'}`, 'info')
        if (d.status === 'picked_up') notify('Your food is on the way', `${first(d.courier_name)} picked it up from ${s.name}`, 'brand')
        if (d.status === 'delivered') notify('Delivered. Enjoy your meal!', `Dropped at ${drop ? drop.name : 'your drop-off point'}`, 'ok')
      }
      if (!p.fallback && o.fallback) notify('Switched to pickup', `No courier took your order in ${cfg.deliveryWindowMin} min. Collect it at ${s.name}. Delivery fee waived.`, 'warn')
    }
    if (S.courierOn && was.courierOn) {
      for (const j of S.db.jobs) {
        if (was.jobs.has(j.id) || j.order.student_id === me.id) continue
        const s = Q.store(j.pickup_store_id)
        const drop = Q.dropoff(j.destination_id)
        notify(`New delivery job · ${E.money(j.fee)}`, `${s ? s.name : 'A store'} → ${drop ? drop.name : 'campus'}`, 'ok')
      }
    }
    for (const j of S.db.myJobs) {
      if (j.status === 'accepted' && was.myJobs[j.id] && was.myJobs[j.id] !== 'ready' && j.order.status === 'ready') {
        const s = Q.store(j.pickup_store_id)
        notify(`Order #${j.order.code} is ready`, `Pick it up at ${s ? s.name : 'the store'}`, 'ok')
      }
    }
  }

  if (me.role === 'merchant') {
    for (const o of S.db.orders) {
      if (was.orders[o.id] || o.status !== 'paid') continue
      const s = Q.store(o.store_id)
      const n = o.items.reduce((a, l) => a + l.qty, 0)
      notify(`New order #${o.code} · ${s ? s.name : ''}`, `${n} ${n === 1 ? 'item' : 'items'} · ${o.type === 'delivery' ? 'peer delivery' : 'pickup'} · ${first(o.student_name) || 'Student'}`, 'brand')
    }
  }
}

/* ---------- polling ---------- */
let polling = false
export async function refresh() {
  if (polling || !Q.me()) return
  polling = true
  try {
    await loadLive()
    S.online = true
    announceChanges()
  } catch {
    S.online = false
  } finally {
    polling = false
  }
}

async function refreshCatalog() {
  try {
    await loadCatalog()
    S.online = true
  } catch {
    S.online = false
  }
}

/* ---------- URL routing ----------
   The address bar follows what's on screen (#/student/store/<id>, #/merchant/menu, #/admin/venues…) */
export const router = {
  hashFor() {
    const me = Q.me()
    if (!me) return '#/'
    if (me.role === 'student') {
      const u = S.ui.student
      if (me.status !== 'active') return '#/student'
      if (u.page === 'track') return '#/student/orders/' + u.trackOrderId
      if (u.page === 'checkout') return '#/student/checkout'
      if (u.page === 'store') return '#/student/store/' + u.storeId
      if (u.tab === 'explore') return u.sheet === 'venue' && u.venueId ? '#/student/venue/' + u.venueId : '#/student'
      return '#/student/' + u.tab
    }
    if (me.role === 'merchant') return S.ui.staff.merchantTab === 'orders' ? '#/merchant' : '#/merchant/' + S.ui.staff.merchantTab
    return S.ui.staff.adminTab === 'approvals' ? '#/admin' : '#/admin/' + S.ui.staff.adminTab
  },
  apply(hash) {
    const me = Q.me()
    if (!me) return
    const [role, a, b] = String(hash || '').replace(/^#\/?/, '').split('/')
    if (role !== me.role) return
    if (me.role === 'student') {
      const u = S.ui.student
      if (u.sheet === 'pay' && u.pay.state === 'processing') return
      u.sheet = null
      if (a === 'store' && Q.store(b)) A.openStore(b)
      else if (a === 'checkout' && u.cart.lines.length) A.openCheckout()
      else if (a === 'orders' && b && Q.order(b)) A.openTracking(b)
      else if (a === 'venue' && Q.venue(b)) A.openVenue(b)
      else if (['stores', 'orders', 'deliver', 'me'].includes(a)) A.setTab(a)
      else A.setTab('explore')
    } else if (me.role === 'merchant') {
      A.setMerchantTab(a === 'menu' ? 'menu' : 'orders')
    } else {
      A.setAdminTab(['venues', 'stores'].includes(a) ? a : 'approvals')
    }
  },
}
function setHash(h, replace) {
  try { history[replace ? 'replaceState' : 'pushState'](null, '', h) } catch { if (replace) location.replace(h); else location.hash = h }
}

/* ---------- start-up (called from main.js) ---------- */
export async function startApp() {
  S.loadError = ''
  try {
    await loadCatalog()
  } catch (err) {
    S.loadError = err.message
    return
  }
  A.restoreSession()
  await refresh()
  S.loaded = true

  // URL <-> screen
  let applying = true
  router.apply(location.hash)
  setHash(router.hashFor(), true)
  nextTick(() => { applying = false })
  watch(router.hashFor, (h) => { if (location.hash !== h) setHash(h, applying) })
  window.addEventListener('popstate', () => {
    applying = true
    router.apply(location.hash)
    if (location.hash !== router.hashFor()) setHash(router.hashFor(), true)
    nextTick(() => { applying = false })
  })

  // After signing in (or switching account), load that person's orders straight away
  watch(() => S.session.userId, (id) => { prev = null; if (id) refresh() })

  // The clock (for countdowns) and polling
  setInterval(A.tick, 1000)
  setInterval(refresh, cfg.pollMs)
  setInterval(refreshCatalog, cfg.catalogPollMs)

  // Close menus on outside click; Escape closes menus and sheets
  document.addEventListener('click', (e) => { if (S.menu && !e.target.closest('.tn-menu')) S.menu = null })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (S.menu) { S.menu = null; return }
    const me = Q.me()
    if (me && me.role === 'student' && S.ui.student.sheet) A.closeSheet()
  })

  // The tab title shows who's signed in, so several tabs are easy to tell apart
  watch(() => { const me = Q.me(); return me ? `${first(me.name)} · ${ROLE[me.role]} · ${cfg.appName}` : `${cfg.appName} · Sign in` },
    (t) => { document.title = t }, { immediate: true })
}

export { ROLE }
