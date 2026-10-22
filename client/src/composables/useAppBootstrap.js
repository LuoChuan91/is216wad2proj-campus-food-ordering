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
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useSessionStore } from '@/stores/session.js'
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
  const orders = useOrdersStore()
  const ui = useUiStore()
  return {
    userId: me.id,
    status: me.status,
    orders: Object.fromEntries(orders.db.orders.map((o) => [o.id, { status: o.status, fallback: o.fallback, d: o.delivery && o.delivery.status }])),
    jobs: new Set(orders.db.jobs.map((j) => j.id)),
    myJobs: Object.fromEntries(orders.db.myJobs.map((j) => [j.id, j.order.status])),
    courierOn: ui.courierOn,
  }
}

function announceChanges() {
  const ui = useUiStore()
  const catalog = useCatalogStore()
  const orders = useOrdersStore()
  const me = orders.me()
  if (!me) { prev = null; return }
  const now = snapshot(me)
  const was = prev
  prev = now
  if (!was || was.userId !== me.id) return // first look after signing in: nothing to announce

  if (me.role === 'student') {
    if (was.status !== 'active' && me.status === 'active') ui.notify('Account approved', 'You can now order food and deliver for others', 'ok')
    for (const o of orders.db.orders) {
      const p = was.orders[o.id]
      if (!p) continue
      const s = catalog.store(o.store_id) || { name: 'The store' }
      const d = o.delivery
      if (p.status === 'paid' && o.status === 'preparing') {
        const q = orders.waits.orders[o.id]
        ui.notify(`${s.name} is cooking your order`, `Order #${o.code}${q ? ' · ready around ' + E.clock(q.readyAt) : ''}`, 'info')
      }
      if (p.status !== 'ready' && o.status === 'ready') {
        const meta = { kind: 'order', status: 'ready', order_id: o.id }
        if (o.type === 'pickup') ui.notify('Your food is ready', `Collect order #${o.code} at ${s.name}`, 'ok', meta)
        else if (d && d.courier_name) ui.notify('Your food is ready', `${first(d.courier_name)} is picking it up now`, 'ok', meta)
        else ui.notify('Your food is ready', 'Waiting for a student courier to accept', 'ok', meta)
      }
      if (d && p.d !== d.status) {
        const drop = catalog.dropoff(d.destination_id)
        if (d.status === 'accepted') ui.notify(`${first(d.courier_name)} accepted your delivery`, `They'll bring it to ${drop ? drop.name : 'you'}`, 'info', { kind: 'delivery', status: 'accepted', order_id: o.id })
        if (d.status === 'picked_up') ui.notify('Your food is on the way', `${first(d.courier_name)} picked it up from ${s.name}`, 'brand', { kind: 'delivery', status: 'picked_up', order_id: o.id })
        if (d.status === 'delivered') ui.notify('Delivered. Enjoy your meal!', `Dropped at ${drop ? drop.name : 'your drop-off point'}`, 'ok', { kind: 'delivery', status: 'delivered', order_id: o.id })
      }
      if (!p.fallback && o.fallback) ui.notify('Switched to pickup', `No courier took your order in ${cfg.deliveryWindowMin} min. Collect it at ${s.name}. Delivery fee waived.`, 'warn', { kind: 'delivery', status: 'expired', order_id: o.id })
    }
    if (ui.courierOn && was.courierOn) {
      for (const j of orders.db.jobs) {
        if (was.jobs.has(j.id) || j.order.student_id === me.id) continue
        const s = catalog.store(j.pickup_store_id)
        const drop = catalog.dropoff(j.destination_id)
        ui.notify(`New delivery job · ${E.money(j.fee)}`, `${s ? s.name : 'A store'} → ${drop ? drop.name : 'campus'}`, 'ok')
      }
    }
    for (const j of orders.db.myJobs) {
      if (j.status === 'accepted' && was.myJobs[j.id] && was.myJobs[j.id] !== 'ready' && j.order.status === 'ready') {
        const s = catalog.store(j.pickup_store_id)
        ui.notify(`Order #${j.order.code} is ready`, `Pick it up at ${s ? s.name : 'the store'}`, 'ok')
      }
    }
  }

  // Merchant: new paid orders appear on the live board directly (driven by the
  // Supabase merchant-store realtime channel via useStoreOrdersLive), so we do
  // NOT raise a notification/toast for them — the board is the single surface.
  // (Decision 2b: merchant new order is realtime board-only, no notification.)
}

/* ---------- polling ---------- */
let polling = false
export async function refresh() {
  const ui = useUiStore()
  const orders = useOrdersStore()
  if (polling || !orders.me()) return
  polling = true
  try {
    await orders.loadLive()
    ui.online = true
    announceChanges()
  } catch {
    ui.online = false
  } finally {
    polling = false
  }
}

export async function refreshCatalog() {
  const ui = useUiStore()
  const catalog = useCatalogStore()
  try {
    await catalog.loadCatalog()
    ui.online = true
  } catch {
    ui.online = false
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
  const ui = useUiStore()
  const catalog = useCatalogStore()
  const orders = useOrdersStore()
  const session = useSessionStore()

  ui.loadError = ''
  try {
    await catalog.loadCatalog()
  } catch (err) {
    ui.loadError = err.message
    return {}
  }
  session.restoreSession()
  await refresh()
  ui.loaded = true

  // URL <-> screen sync (router/sync.js). vue-router owns the URL; this keeps the
  // ui-store tab/page fields in step with it for the portal components.
  startRouting()

  // After signing in (or switching account), load that person's orders straight away
  const stopSessionWatch = watch(() => session.session.userId, (id) => { prev = null; if (id) refresh() })

  // The clock (for countdowns). Live data refreshes are owned by useLiveSync
  // (realtime-primary, polling-fallback), started in App.vue's setup — NOT a
  // fixed interval here. The catalog (stores/menus/venues) changes rarely and is
  // not covered by realtime, so it keeps its own slow poll.
  const tickTimer = setInterval(() => ui.tick(), 1000)
  const catalogTimer = setInterval(refreshCatalog, cfg.catalogPollMs)

  // Close menus on outside click; Escape closes menus and sheets
  const onClick = (e) => { if (ui.menu && !e.target.closest('.tn-menu')) ui.menu = null }
  const onKeydown = (e) => {
    if (e.key !== 'Escape') return
    if (ui.menu) { ui.menu = null; return }
    const me = orders.me()
    if (me && me.role === 'student' && ui.ui.student.sheet) ui.closeSheet()
  }
  document.addEventListener('click', onClick)
  document.addEventListener('keydown', onKeydown)

  // The tab title shows who's signed in, so several tabs are easy to tell apart
  const stopTitleWatch = watch(
    () => { const me = orders.me(); return me ? `${first(me.name)} · ${ROLE[me.role]} · ${cfg.appName}` : `${cfg.appName} · Sign in` },
    (t) => { document.title = t },
    { immediate: true },
  )

  function stop() {
    clearInterval(tickTimer)
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
