// App bootstrap.
//
// This performs everything the prototype's start-up did EXCEPT the hand-rolled
// hash/popstate routing (which vue-router takes over in the next task):
//   - loads the catalog, restores this tab's sign-in, then does the first live load
//   - polls the server for news (orders/queues/jobs) and the catalog, with a guard
//   - ticks a 1-second clock for countdowns
//   - keeps the tab title in step with who's signed in
//   - closes menus on outside click, and menus/sheets on Escape
//   - turns poll-diffs into notifications (announceChanges), preserving the
//     meta/dedup contract (meta.kind events are mirror-skipped when realtime is connected)
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
import { buildNotification } from '@/utils/notificationMessages.js'
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
      // Shared context so these messages read exactly like the realtime ones.
      const ctx = () => {
        const drop = d ? catalog.dropoff(d.destination_id) : null
        return {
          order: o,
          storeName: s.name,
          dropoffName: drop ? drop.name : undefined,
          courierName: d ? d.courier_name : undefined,
          // readyAtClock is omitted: the server wait snapshot is gone and the
          // frontend engine is per-component; the message reads fine without it.
          deliveryWindowMin: cfg.deliveryWindowMin,
        }
      }
      // order paid -> preparing: the "cooking" line (realtime fires on paid).
      if (p.status === 'paid' && o.status === 'preparing') {
        ui.notifyView(buildNotification({ kind: 'order', status: 'paid', order_id: o.id }, ctx()))
      }
      if (p.status !== 'ready' && o.status === 'ready') {
        ui.notifyView(buildNotification({ kind: 'order', status: 'ready', order_id: o.id }, ctx()), { kind: 'order', status: 'ready', order_id: o.id })
      }
      if (d && p.d !== d.status) {
        if (d.status === 'accepted') ui.notifyView(buildNotification({ kind: 'delivery', status: 'accepted', order_id: o.id }, ctx()), { kind: 'delivery', status: 'accepted', order_id: o.id })
        if (d.status === 'picked_up') ui.notifyView(buildNotification({ kind: 'delivery', status: 'picked_up', order_id: o.id }, ctx()), { kind: 'delivery', status: 'picked_up', order_id: o.id })
        if (d.status === 'delivered') ui.notifyView(buildNotification({ kind: 'delivery', status: 'delivered', order_id: o.id }, ctx()), { kind: 'delivery', status: 'delivered', order_id: o.id })
      }
      if (!p.fallback && o.fallback) ui.notifyView(buildNotification({ kind: 'delivery', status: 'expired', order_id: o.id }, ctx()), { kind: 'delivery', status: 'expired', order_id: o.id })
    }
    if (ui.courierOn && was.courierOn) {
      for (const j of orders.db.jobs) {
        if (was.jobs.has(j.id) || j.order.student_id === me.id) continue
        const s = catalog.store(j.pickup_store_id)
        const drop = catalog.dropoff(j.destination_id)
        ui.notify(`New delivery job`, `${s ? s.name : 'A store'} → ${drop ? drop.name : 'campus'}`, 'ok')
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

  // Escape closes sheets
  const onKeydown = (e) => {
    if (e.key !== 'Escape') return
    const me = orders.me()
    if (me && me.role === 'student' && ui.ui.student.sheet) ui.closeSheet()
  }
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
