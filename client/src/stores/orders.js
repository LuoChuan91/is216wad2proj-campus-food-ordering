// Orders store (ported from app/state.js).
//
// The fast-changing, per-user data: a student's own orders (or a merchant's stores'
// orders), the peer-delivery jobs, and the live wait times. Also the order/courier/
// admin actions and the checkout estimate, preserved exactly from the prototype.
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { api } from '@/services/api.js'
import { useSessionStore } from './session.js'
import { useCatalogStore } from './catalog.js'
import { useUiStore } from './ui.js'

const ms = (t) => (t ? Date.parse(t) : null)

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

export const useOrdersStore = defineStore('orders', () => {
  // Preserves the live slice of S.db, plus S.waits
  const db = reactive({
    orders: [],       // a student's own orders, or a merchant's stores' orders
    jobs: [], expiredJobs: [], myJobs: [], // peer delivery
  })
  const waits = reactive({ stores: {}, orders: {}, slots: 2 })

  function order(id) { return db.orders.find((o) => o.id === id) }

  // Everything that changes from minute to minute, for whoever is signed in
  async function loadLive() {
    const catalog = useCatalogStore()
    const ui = useUiStore()
    const me = catalog.user(useSessionStore().session.userId)
    if (!me) return
    const jobs = []
    jobs.push(api.waitTimes().then((w) => { Object.assign(waits, { stores: w.stores || {}, orders: w.orders || {}, slots: w.slots }) }))
    if (me.role === 'student') {
      jobs.push(api.profile(me.id).then((p) => Object.assign(me, p)))
      jobs.push(api.studentOrders(me.id).then((list) => { db.orders = list.map(normaliseOrder) }))
      jobs.push(api.myJobs(me.id).then((list) => { db.myJobs = list.map(normaliseJob) }))
      if (ui.courierOn) {
        jobs.push(api.openJobs().then((list) => { db.jobs = list.map(normaliseJob) }))
        jobs.push(api.expiredJobs().then((list) => { db.expiredJobs = list.map(normaliseJob) }))
      } else {
        db.jobs = []
        db.expiredJobs = []
      }
    } else if (me.role === 'merchant') {
      const mine = catalog.storesOf(me.id)
      jobs.push(Promise.all(mine.map((s) => api.storeOrders(s.id))).then((lists) => { db.orders = lists.flat().map(normaliseOrder) }))
    } else {
      jobs.push(api.profiles().then((list) => { catalog.db.profiles = list }))
    }
    await Promise.all(jobs)
  }

  /* merchant: move an order along */
  async function setOrderStatus(orderId, status) {
    const ui = useUiStore()
    const saved = await ui.run(orderId, () => api.setOrderStatus(orderId, status))
    if (saved) {
      const i = db.orders.findIndex((o) => o.id === orderId)
      if (i >= 0) db.orders[i] = normaliseOrder(saved)
      loadLive().catch(() => {})
    }
  }
  const startPreparing = (orderId) => setOrderStatus(orderId, 'preparing')
  const markReady = (orderId) => setOrderStatus(orderId, 'ready')
  const markCollected = (orderId) => setOrderStatus(orderId, 'completed')

  async function setItemAvailable(itemId, available) {
    const ui = useUiStore()
    const catalog = useCatalogStore()
    const saved = await ui.run(itemId, () => api.setItemAvailable(itemId, available))
    if (saved) catalog.item(itemId).available = saved.available
  }
  async function setStoreOpen(storeId, open) {
    const ui = useUiStore()
    const catalog = useCatalogStore()
    const saved = await ui.run(storeId, () => api.updateStore(storeId, { is_open: open }))
    if (saved) catalog.store(storeId).is_open = saved.is_open
  }

  /* courier */
  function setAvailable(on) {
    const ui = useUiStore()
    ui.courierOn = on
    useSessionStore()._saveCourier(useSessionStore().session.userId, on)
    loadLive().catch(() => {})
  }
  async function courierAction(jobId, action) {
    const ui = useUiStore()
    const saved = await ui.run(jobId, () => api.delivery(jobId, action, useSessionStore().session.userId))
    if (saved) await loadLive().catch(() => {})
  }
  const acceptJob = (jobId) => courierAction(jobId, 'accept')
  const pickUp = (jobId) => courierAction(jobId, 'pickup')
  const deliver = (jobId) => courierAction(jobId, 'deliver')

  /* admin */
  async function setStudentStatus(userId, status) {
    const ui = useUiStore()
    const catalog = useCatalogStore()
    const saved = await ui.run(userId, () => api.setProfileStatus(userId, status))
    if (saved) Object.assign(catalog.user(userId), saved)
  }
  const approveStudent = (id) => setStudentStatus(id, 'active')
  const rejectStudent = (id) => setStudentStatus(id, 'blocked')

  async function addVenue() {
    const ui = useUiStore()
    const catalog = useCatalogStore()
    const t = ui.ui.staff
    const d = t.venueDraft
    const lat = parseFloat(d.lat)
    const lng = parseFloat(d.lng)
    if (!d.name.trim()) { t.formError = 'Give the venue a name.'; return }
    if (!(lat > 1.15 && lat < 1.48 && lng > 103.6 && lng < 104.1)) { t.formError = 'Click the map to place the pin inside Singapore.'; return }
    t.saving = true
    try {
      const v = await api.addVenue({ name: d.name.trim(), lat, lng, type: 'eatery' })
      catalog.db.venues.push(v)
      t.venueDraft = { name: '', lat: '', lng: '' }
    } catch (err) {
      t.formError = err.message
    } finally {
      t.saving = false
    }
  }

  // Ask the server's wait-time engine when the current cart would be ready
  async function refreshEstimate() {
    const ui = useUiStore()
    const u = ui.ui.student
    if (!u.cart.lines.length) { u.estimate = null; return }
    try {
      u.estimate = await api.estimate(u.cart.storeId, u.cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, qty: l.qty })))
    } catch { u.estimate = null }
  }

  return {
    db, waits,
    order, loadLive, refreshEstimate,
    setOrderStatus, startPreparing, markReady, markCollected,
    setItemAvailable, setStoreOpen,
    setAvailable, courierAction, acceptJob, pickUp, deliver,
    setStudentStatus, approveStudent, rejectStudent, addVenue,
    _normaliseOrder: normaliseOrder, _normaliseJob: normaliseJob,
  }
})
