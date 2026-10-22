// TEMPORARY compatibility shim (was app/state.js, the prototype's single state file).
//
// The app's state has been split into Pinia stores (stores/session.js, catalog.js,
// orders.js, ui.js). Portal components, TopNav, SignIn and Toasts still import
// { S, Q, A } from here, so this file re-exports exactly those three (plus notify,
// loadCatalog, loadLive, DEFAULT_PLACE, studentUi) backed by the stores. The shapes
// and behaviour are identical to the old reactive object.
//
// This lets the Pinia migration happen without touching the ~20 consumers. A later
// task migrates each component to use the stores directly; then this file is deleted.
// It lives under stores/ (not app/) so there is no leftover app/ folder.

// Make the shared Pinia instance active FIRST, so the stores below resolve even
// though this module is evaluated before main.js calls app.use(pinia).
import '@/stores/pinia.js'

import { useSessionStore } from '@/stores/session.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useUiStore, studentUi, DEFAULT_PLACE } from '@/stores/ui.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { getRoute } from '@/utils/routing.js'

const sessionStore = useSessionStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const ui = useUiStore()

export { DEFAULT_PLACE, studentUi }

/* ---------- S: one object with the same deep shape as before ---------- */
// db combines the catalog slice (profiles/venues/destinations/stores/menu) and the
// live slice (orders/jobs/expiredJobs/myJobs), delegating to the owning store.
const db = {
  get profiles() { return catalog.db.profiles }, set profiles(v) { catalog.db.profiles = v },
  get venues() { return catalog.db.venues }, set venues(v) { catalog.db.venues = v },
  get destinations() { return catalog.db.destinations }, set destinations(v) { catalog.db.destinations = v },
  get stores() { return catalog.db.stores }, set stores(v) { catalog.db.stores = v },
  get menu() { return catalog.db.menu }, set menu(v) { catalog.db.menu = v },
  get orders() { return orders.db.orders }, set orders(v) { orders.db.orders = v },
  get jobs() { return orders.db.jobs }, set jobs(v) { orders.db.jobs = v },
  get expiredJobs() { return orders.db.expiredJobs }, set expiredJobs(v) { orders.db.expiredJobs = v },
  get myJobs() { return orders.db.myJobs }, set myJobs(v) { orders.db.myJobs = v },
}

export const S = {
  get loaded() { return ui.loaded }, set loaded(v) { ui.loaded = v },
  get loadError() { return ui.loadError }, set loadError(v) { ui.loadError = v },
  get online() { return ui.online }, set online(v) { ui.online = v },
  get now() { return ui.now }, set now(v) { ui.now = v },
  get session() { return sessionStore.session },
  get db() { return db },
  get waits() { return orders.waits },
  set waits(v) { Object.assign(orders.waits, { stores: v.stores || {}, orders: v.orders || {}, slots: v.slots }) },
  get ui() { return ui.ui },
  set ui(v) { ui.ui = v },
  get courierOn() { return ui.courierOn }, set courierOn(v) { ui.courierOn = v },
  get notifications() { return ui.notifications },
  get toasts() { return ui.toasts },
  get menu() { return ui.menu }, set menu(v) { ui.menu = v },
  get readId() { return ui.readId }, set readId(v) { ui.readId = v },
  get mapOffline() { return ui.mapOffline }, set mapOffline(v) { ui.mapOffline = v },
  get busy() { return ui.busy },
}

/* ---------- Q: the query helpers ---------- */
const ACTIVE = ['paid', 'preparing', 'ready']

export const Q = {
  me: () => catalog.user(sessionStore.session.userId),
  user: (id) => catalog.user(id),
  venue: (id) => catalog.venue(id),
  store: (id) => catalog.store(id),
  item: (id) => catalog.item(id),
  order: (id) => orders.order(id),
  dropoff: (id) => catalog.dropoff(id),
  groups: (itemId) => catalog.groups(itemId),
  options: (itemId) => catalog.options(itemId),
  storesAt: (venueId) => catalog.storesAt(venueId),
  storesOf: (merchantId) => catalog.storesOf(merchantId),
  menu: (storeId) => catalog.menuOf(storeId),
  ordersOf: (userId) => orders.db.orders.filter((o) => o.student_id === userId).sort((a, b) => b.created_at - a.created_at),
  isActive: (o) => ACTIVE.includes(o.status) && !(o.delivery && o.delivery.status === 'delivered'),
  open: (store) => E.openStatus(store, ui.now, cfg.enforceOpeningHours),
  queue: () => orders.waits.orders,
  storeWait(storeId) {
    const w = orders.waits.stores[storeId]
    return w && w.minutes != null ? w : null
  },
  place() { return ui.place() },
  walk: (venue) => getRoute(ui.place(), venue),
  activeJob: () => orders.db.myJobs.find((d) => d.status === 'accepted' || d.status === 'picked_up'),
  openJobs: () => orders.db.jobs.filter((d) => d.order.student_id !== sessionStore.session.userId),
  earnings() {
    const done = orders.db.myJobs.filter((d) => d.status === 'delivered')
    const today = done.filter((d) => E.sameDay(d.delivered_at, ui.now))
    const week = done.filter((d) => ui.now - d.delivered_at < 7 * 864e5)
    return { today: E.sum(today, (d) => d.fee), todayCount: today.length, week: E.sum(week, (d) => d.fee), weekCount: week.length }
  },
  unread: () => ui.notifications.filter((n) => n.id > ui.readId).length,
}

/* ---------- A: the actions ---------- */
export const A = {
  signIn: (userId) => sessionStore.signIn(userId),
  signOut: () => sessionStore.signOut(),
  restoreSession: () => sessionStore.restoreSession(),

  tick: () => ui.tick(),

  pushToast: (n) => ui.pushToast(n),
  dismissToast: (id) => ui.dismissToast(id),
  toggleMenu: (name) => ui.toggleMenu(name),

  setTab: (tab) => ui.setTab(tab),
  setSearch: (q) => ui.setSearch(q),
  setListSearch: (q) => ui.setListSearch(q),
  setListFilter: (f) => ui.setListFilter(f),
  setListSort: (s) => ui.setListSort(s),
  openStoreItem: (storeId, itemId) => ui.openStoreItem(storeId, itemId),
  openVenue: (venueId) => ui.openVenue(venueId),
  locate: () => ui.locate(),
  closeSheet: () => ui.closeSheet(),
  openStore: (storeId) => ui.openStore(storeId),
  back: () => ui.back(),
  openItem: (itemId) => ui.openItem(itemId),
  toggleOption: (optionId) => ui.toggleOption(optionId),
  setDraftQty: (q) => ui.setDraftQty(q),
  addToCart: () => ui.addToCart(),
  setLineQty: (key, qty) => ui.setLineQty(key, qty),
  openCheckout: () => ui.openCheckout(),
  refreshEstimate: () => orders.refreshEstimate(),
  setFulfilment: (type) => ui.setFulfilment(type),
  setDropoff: (id) => ui.setDropoff(id),
  setNote: (note) => ui.setNote(note),
  openPay: () => ui.openPay(),
  confirmPay: () => ui.confirmPay(),
  openTracking: (orderId) => ui.openTracking(orderId),

  setMerchantTab: (tab) => ui.setMerchantTab(tab),
  setMerchantStore: (storeId) => ui.setMerchantStore(storeId),
  setOrderStatus: (orderId, status) => orders.setOrderStatus(orderId, status),
  startPreparing: (orderId) => orders.startPreparing(orderId),
  markReady: (orderId) => orders.markReady(orderId),
  markCollected: (orderId) => orders.markCollected(orderId),
  setItemAvailable: (itemId, available) => orders.setItemAvailable(itemId, available),
  setStoreOpen: (storeId, open) => orders.setStoreOpen(storeId, open),

  setAvailable: (on) => orders.setAvailable(on),
  courierAction: (jobId, action) => orders.courierAction(jobId, action),
  acceptJob: (jobId) => orders.acceptJob(jobId),
  pickUp: (jobId) => orders.pickUp(jobId),
  deliver: (jobId) => orders.deliver(jobId),

  setAdminTab: (tab) => ui.setAdminTab(tab),
  setStudentStatus: (userId, status) => orders.setStudentStatus(userId, status),
  approveStudent: (id) => orders.approveStudent(id),
  rejectStudent: (id) => orders.rejectStudent(id),
  setVenueDraft: (field, value) => ui.setVenueDraft(field, value),
  addVenue: () => orders.addVenue(),
}

/* ---------- notify + loaders re-exported for the bootstrap and components ---------- */
export const notify = (...args) => ui.notify(...args)
export const loadCatalog = () => catalog.loadCatalog()
export const loadLive = () => orders.loadLive()
