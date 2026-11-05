// Notifications store: the history list + the active-toast queue. receive() (realtime)
// and pushLocal() (poll-diff) both build text via notificationMessages.js.
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { buildNotification } from '@/utils/notificationMessages.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { config as cfg } from '@/config/index.js'

let seq = 0
const nextId = () => `n${Date.now()}_${seq++}`

// Collapses the same notification arriving within DEDUP_WINDOW_MS (e.g. a status
// event delivered by both the realtime and poll-diff paths around a connect/
// disconnect transition).
const DEDUP_WINDOW_MS = 3000
function dupKey(n) {
  // Status events are keyed by kind|status|order (matches even if wording differs);
  // plain messages fall back to their title+body.
  if (n.kind) return `k:${n.kind}|${n.status || ''}|${n.orderId ?? ''}`
  return `t:${n.title || ''}|${n.body || ''}`
}

// Per-user sessionStorage for the notification HISTORY
const notesKey = (userId) => `campus-delights-notes-${userId}`
function loadNotes(userId) {
  if (!userId) return []
  try {
    const raw = sessionStorage.getItem(notesKey(userId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
function saveNotes(userId, items) {
  if (!userId) return
  try {
    sessionStorage.setItem(notesKey(userId), JSON.stringify(items))
  } catch {
    /* private mode / quota */
  }
}
function dropNotes(userId) {
  if (!userId) return
  try {
    sessionStorage.removeItem(notesKey(userId))
  } catch {
    /* ignore */
  }
}

// Resolve the order-aware context so very-early or orphaned
// events still produce a sensible generic line.
function resolveContext(payload) {
  const ctx = { deliveryWindowMin: cfg?.deliveryWindowMin }
  try {
    const orders = useOrdersStore()
    const catalog = useCatalogStore()
    const order = payload.order_id ? orders.order(payload.order_id) : null
    if (order) {
      ctx.order = order
      const store = catalog.store(order.store_id)
      if (store) ctx.storeName = store.name
      const d = order.delivery
      if (d) {
        if (d.courier_name) ctx.courierName = d.courier_name
        const drop = catalog.dropoff(d.destination_id)
        if (drop) ctx.dropoffName = drop.name
      }
    }
  } catch {
    // Stores not ready (e.g. a bare unit test): fall back to generic wording.
  }
  return ctx
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref([]) // full history, newest first
  const toasts = ref([]) // currently visible toasts
  let currentUserId = null
  const realtimeConnected = ref(false)
  function setRealtimeConnected(v) { realtimeConnected.value = !!v }

  // Per-instance de-dup state: key -> last-seen epoch ms. Reset by clear().
  const seen = new Map()
  function isDuplicate(n) {
    const key = dupKey(n)
    const now = Date.now()
    const last = seen.get(key)
    if (last !== undefined && now - last < DEDUP_WINDOW_MS) return true
    seen.set(key, now)
    // Prune lazily so the map can't grow unbounded over a long session.
    if (seen.size > 200) {
      for (const [k, t] of seen) if (now - t >= DEDUP_WINDOW_MS) seen.delete(k)
    }
    return false
  }

  // Load this user's persisted history 
  function hydrate(userId, { fresh = false } = {}) {
    currentUserId = userId || null
    if (fresh) {
      dropNotes(currentUserId)
      items.value = []
    } else {
      items.value = loadNotes(currentUserId)
    }
    toasts.value = []
  }

  // Persist history on every change (receive/markRead).
  watch(
    items,
    (list) => { if (currentUserId) saveNotes(currentUserId, list) },
    { deep: true, flush: 'sync' },
  )

  /**
   * Handle one raw realtime payload { kind, status, order_id, at }.
   * Returns the created notification, or null
   */
  function receive(payload) {
    const view = buildNotification(payload, resolveContext(payload))
    if (!view) return null

    const notification = {
      id: nextId(),
      kind: view.kind,
      status: view.status,
      orderId: view.order_id ?? null,
      title: view.title,
      body: view.body,
      variant: view.variant,
      at: view.at || new Date().toISOString(),
      read: false,
    }

    if (isDuplicate(notification)) return null
    items.value.unshift(notification)
    if (view.toast) toasts.value.push(notification)
    return notification
  }

  /**
   * Add a notification from the poll-diff path (ui.js). Skips status events (those
   * with meta.kind) while realtime is connected, since the realtime path delivers
   * them; plain messages always go through. Returns the notification, or null if
   * skipped / de-duplicated.
   */
  function pushLocal({ title, body, variant = 'secondary', toast = true, meta = null }) {
    if (realtimeConnected.value && meta?.kind) return null

    const notification = {
      id: nextId(),
      kind: meta?.kind ?? null,
      status: meta?.status ?? null,
      orderId: meta?.order_id ?? null,
      title,
      body,
      variant,
      at: new Date().toISOString(),
      read: false,
    }

    if (isDuplicate(notification)) return null
    items.value.unshift(notification)
    if (toast) toasts.value.push(notification)
    return notification
  }

  /** Remove a toast once it has been shown/dismissed (keeps it in history). */
  function dismissToast(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  /** Mark a history item read. */
  function markRead(id) {
    const n = items.value.find((i) => i.id === id)
    if (n) n.read = true
  }

  function markAllRead() {
    items.value.forEach((n) => {
      n.read = true
    })
  }

  function clear() {
    dropNotes(currentUserId)
    currentUserId = null
    items.value = []
    toasts.value = []
    seen.clear()
  }

  return { items, toasts, realtimeConnected, setRealtimeConnected, hydrate, receive, pushLocal, dismissToast, markRead, markAllRead, clear }
})
