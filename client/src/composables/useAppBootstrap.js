// App bootstrap (the non-routing half of the old app/live.js).
//
// This performs everything the prototype's start-up did EXCEPT the hand-rolled
// hash/popstate routing (which vue-router takes over in the next task):
//   - loads the catalog, restores this tab's sign-in, then does the first live load
//   - polls the server for news (orders/queues/jobs) and the catalog, with a guard
//   - ticks a 1-second clock for countdowns
//   - keeps the tab title in step with who's signed in
//   - closes menus on outside click, and menus/sheets on Escape
//   - turns poll-diffs into notifications (announceChanges), preserving the
//     meta/dedup contract with notifyBridge (meta.kind events are mirrored-skipped)
//
// The realtime bridges (auth bridge + realtime notifications) are started in
// App.vue's setup, not here, so App.vue's "Try again" button can re-run startApp()
// without re-subscribing.
//
// Behaviour is identical to the prototype's app/live.js; only the routing has been
// left out (vue-router owns navigation now).
// The polling vs realtime notification paths are intentionally BOTH kept (not
// de-duplicated) — that is a separate later task.
import { watch } from 'vue'
import { S, Q, A, notify, loadCatalog, loadLive } from '@/stores/compat.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { startRouting } from '@/router/sync.js'

const ROLE = { student: 'Student', merchant: 'Merchant', admin: 'Admin' }
const first = (name) => (name || '').split(' ')[0]

/* ---------- notifications: compare what the server says now with what it said last time ---------- */
let prev = null

function resetSnapshot() {
  prev = null
}

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
        const meta = { kind: 'order', status: 'ready', order_id: o.id }
        if (o.type === 'pickup') notify('Your food is ready', `Collect order #${o.code} at ${s.name}`, 'ok', meta)
        else if (d && d.courier_name) notify('Your food is ready', `${first(d.courier_name)} is picking it up now`, 'ok', meta)
        else notify('Your food is ready', 'Waiting for a student courier to accept', 'ok', meta)
      }
      if (d && p.d !== d.status) {
        const drop = Q.dropoff(d.destination_id)
        if (d.status === 'accepted') notify(`${first(d.courier_name)} accepted your delivery`, `They'll bring it to ${drop ? drop.name : 'you'}`, 'info', { kind: 'delivery', status: 'accepted', order_id: o.id })
        if (d.status === 'picked_up') notify('Your food is on the way', `${first(d.courier_name)} picked it up from ${s.name}`, 'brand', { kind: 'delivery', status: 'picked_up', order_id: o.id })
        if (d.status === 'delivered') notify('Delivered. Enjoy your meal!', `Dropped at ${drop ? drop.name : 'your drop-off point'}`, 'ok', { kind: 'delivery', status: 'delivered', order_id: o.id })
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

export async function refreshCatalog() {
  try {
    await loadCatalog()
    S.online = true
  } catch {
    S.online = false
  }
}

/* ---------- start-up (called from App.vue / main.js) ---------- */
// Returns the live timers/listeners so a caller (or test) can tear them down.
//
// The realtime bridges (realtimeAuthBridge + useRealtimeNotifications) are started
// in App.vue's setup (once, during component setup so onBeforeUnmount can bind),
// not here, so that App.vue's "Try again" button can re-invoke startApp() without
// re-subscribing. See App.vue.
export async function startApp() {
  S.loadError = ''
  try {
    await loadCatalog()
  } catch (err) {
    S.loadError = err.message
    return {}
  }
  A.restoreSession()
  await refresh()
  S.loaded = true

  // URL <-> screen sync (router/sync.js). vue-router owns the URL; this keeps the
  // ui-store tab/page fields in step with it for the portal components.
  startRouting()

  // After signing in (or switching account), load that person's orders straight away
  const stopSessionWatch = watch(() => S.session.userId, (id) => { prev = null; if (id) refresh() })

  // The clock (for countdowns) and polling
  const tickTimer = setInterval(A.tick, 1000)
  const refreshTimer = setInterval(refresh, cfg.pollMs)
  const catalogTimer = setInterval(refreshCatalog, cfg.catalogPollMs)

  // Close menus on outside click; Escape closes menus and sheets
  const onClick = (e) => { if (S.menu && !e.target.closest('.tn-menu')) S.menu = null }
  const onKeydown = (e) => {
    if (e.key !== 'Escape') return
    if (S.menu) { S.menu = null; return }
    const me = Q.me()
    if (me && me.role === 'student' && S.ui.student.sheet) A.closeSheet()
  }
  document.addEventListener('click', onClick)
  document.addEventListener('keydown', onKeydown)

  // The tab title shows who's signed in, so several tabs are easy to tell apart
  const stopTitleWatch = watch(
    () => { const me = Q.me(); return me ? `${first(me.name)} · ${ROLE[me.role]} · ${cfg.appName}` : `${cfg.appName} · Sign in` },
    (t) => { document.title = t },
    { immediate: true },
  )

  function stop() {
    clearInterval(tickTimer)
    clearInterval(refreshTimer)
    clearInterval(catalogTimer)
    document.removeEventListener('click', onClick)
    document.removeEventListener('keydown', onKeydown)
    stopSessionWatch()
    stopTitleWatch()
  }

  return { stop, refresh, refreshCatalog }
}

// Composable wrapper so App.vue can simply call useAppBootstrap().
export function useAppBootstrap() {
  return { startApp, refresh, refreshCatalog, announceChanges, resetSnapshot }
}

export { ROLE, announceChanges }
