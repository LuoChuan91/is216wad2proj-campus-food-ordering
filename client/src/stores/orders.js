// Orders store.
//
// The fast-changing, per-user data: a student's own orders (or a merchant's stores'
// orders), the peer-delivery jobs, and the live wait times. Also the order/courier
// actions and the checkout estimate, preserved exactly from the prototype.
// (Admin actions — student status + addVenue — live in stores/admin.js.)
import { defineStore } from "pinia";
import { reactive } from "vue";
import { api } from "@/services/api.js";
import * as E from "@/utils/engine.js";
import { useSessionStore } from "./session.js";
import { useCatalogStore } from "./catalog.js";
import { useUiStore } from "./ui.js";
import { markSwitchedToPickup } from "@/utils/pickupSwitch.js";

const ACTIVE = ["paid", "preparing", "ready"];

const ms = (t) => (t ? Date.parse(t) : null);

function normaliseOrder(o) {
  const d = o.delivery;
  return {
    ...o,
    created_at: ms(o.created_at),
    paid_at: ms(o.paid_at),
    ready_at: ms(o.ready_at),
    completed_at: ms(o.completed_at),
    preparing_at: ms(o.preparing_at),
    items: (o.order_items || []).map((l) => ({
      id: l.id,
      menu_item_id: l.menu_item_id,
      qty: l.qty,
      unit_price: Number(l.unit_price),
      name: (l.menu_items && l.menu_items.name) || "Item",
      option_names: l.option_names || [],
    })),
    delivery: d
      ? {
          ...d,
          created_at: ms(d.created_at),
          expires_at: ms(d.expires_at),
          accepted_at: ms(d.accepted_at),
          picked_up_at: ms(d.picked_up_at),
          delivered_at: ms(d.delivered_at),
        }
      : null,
  };
}

function normaliseJob(j) {
  return {
    ...j,
    created_at: ms(j.created_at),
    expires_at: ms(j.expires_at),
    accepted_at: ms(j.accepted_at),
    picked_up_at: ms(j.picked_up_at),
    delivered_at: ms(j.delivered_at),
    order: { ...j.order, ready_at: ms(j.order.ready_at) },
  };
}

export const useOrdersStore = defineStore("orders", () => {
  // Preserves the live slice of S.db
  const db = reactive({
    orders: [], // a student's own orders, or a merchant's stores' orders
    jobs: [],
    expiredJobs: [],
    myJobs: [], // peer delivery
  });

  function order(id) {
    return db.orders.find((o) => o.id === id);
  }

  /* ---------- query helpers ---------- */
  // The signed-in user's profile row (via the catalog store)
  function me() {
    return useCatalogStore().user(useSessionStore().session.userId);
  }
  // A user's own orders, newest first
  function ordersOf(userId) {
    return db.orders
      .filter((o) => o.student_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
  }
  // An order is "active" while it is still paid/preparing/ready and not yet delivered
  function isActive(o) {
    return (
      ACTIVE.includes(o.status) &&
      !(o.delivery && o.delivery.status === "delivered")
    );
  }
  // The courier's current job (accepted or picked up), if any
  function activeJob() {
    return db.myJobs.find(
      (d) => d.status === "accepted" || d.status === "picked_up",
    );
  }
  // ALL of the courier's in-progress jobs (a courier may carry up to 4 at once)
  function activeJobs() {
    return db.myJobs.filter(
      (d) => d.status === "accepted" || d.status === "picked_up",
    );
  }
  // Open delivery jobs the courier may take (not their own orders)
  function openJobs() {
    return db.jobs.filter(
      (d) => d.order.student_id !== useSessionStore().session.userId,
    );
  }
  // Today's and this week's delivery earnings from the courier's delivered jobs
  function earnings() {
    const now = useUiStore().now;
    const done = db.myJobs.filter((d) => d.status === "delivered");
    const today = done.filter((d) => E.sameDay(d.delivered_at, now));
    const week = done.filter((d) => now - d.delivered_at < 7 * 864e5);
    return {
      today: E.sum(today, (d) => d.fee),
      todayCount: today.length,
      week: E.sum(week, (d) => d.fee),
      weekCount: week.length,
    };
  }

  // Refetch ONE store's orders and merge them into db.orders (replacing that
  // store's rows, keeping other stores untouched). Used by the merchant live
  // layer so a realtime order_change updates the board without a whole-app poll.
  // Returns the normalised rows for the store.
  async function loadStoreOrders(storeId) {
    if (!storeId) return [];
    const list = (await api.storeOrders(storeId)).map(normaliseOrder);
    db.orders = [...db.orders.filter((o) => o.store_id !== storeId), ...list];
    return list;
  }

  // Everything that changes from minute to minute, for whoever is signed in
  async function loadLive() {
    const catalog = useCatalogStore();
    const ui = useUiStore();
    const me = catalog.user(useSessionStore().session.userId);
    if (!me) return;
    const jobs = [];
    if (me.role === "student") {
      jobs.push(api.profile(me.id).then((p) => Object.assign(me, p)));
      jobs.push(
        api.studentOrders(me.id).then((list) => {
          db.orders = list.map(normaliseOrder);
        }),
      );
      jobs.push(
        api.myJobs(me.id).then((list) => {
          db.myJobs = list.map(normaliseJob);
        }),
      );
      if (ui.courierOn) {
        jobs.push(
          api.openJobs().then((list) => {
            db.jobs = list.map(normaliseJob);
          }),
        );
        jobs.push(
          api.expiredJobs().then((list) => {
            db.expiredJobs = list.map(normaliseJob);
          }),
        );
      } else {
        db.jobs = [];
        db.expiredJobs = [];
      }
    } else if (me.role === "merchant") {
      const mine = catalog.storesOf(me.id);
      jobs.push(
        Promise.all(mine.map((s) => api.storeOrders(s.id))).then((lists) => {
          db.orders = lists.flat().map(normaliseOrder);
        }),
      );
    } else {
      jobs.push(
        api.profiles().then((list) => {
          catalog.db.profiles = list;
        }),
      );
    }
    await Promise.all(jobs);
  }

  /* merchant: move an order along */
  async function setOrderStatus(orderId, status) {
    const ui = useUiStore();
    const saved = await ui.run(orderId, () =>
      api.setOrderStatus(orderId, status),
    );
    if (saved) {
      const i = db.orders.findIndex((o) => o.id === orderId);
      if (i >= 0) db.orders[i] = normaliseOrder(saved);
      loadLive().catch(() => {});
    }
  }
  const startPreparing = (orderId) => setOrderStatus(orderId, "preparing");
  const markReady = (orderId) => setOrderStatus(orderId, "ready");
  const markCollected = (orderId) => setOrderStatus(orderId, "completed");

  async function setItemAvailable(itemId, available) {
    const ui = useUiStore();
    const catalog = useCatalogStore();
    const saved = await ui.run(itemId, () =>
      api.setItemAvailable(itemId, available),
    );
    if (saved) catalog.item(itemId).available = saved.available;
  }
  async function setStoreOpen(storeId, open) {
    const ui = useUiStore();
    const catalog = useCatalogStore();
    const saved = await ui.run(storeId, () =>
      api.updateStore(storeId, { is_open: open }),
    );
    if (saved) catalog.store(storeId).is_open = saved.is_open;
  }

  /* courier */
  function setAvailable(on) {
    const ui = useUiStore();
    ui.courierOn = on;
    useSessionStore()._saveCourier(useSessionStore().session.userId, on);
    loadLive().catch(() => {});
  }
  async function courierAction(jobId, action) {
    const ui = useUiStore();
    const saved = await ui.run(jobId, () =>
      api.delivery(jobId, action, useSessionStore().session.userId),
    );
    if (saved) await loadLive().catch(() => {});
  }
  const acceptJob = (jobId) => courierAction(jobId, "accept");
  const pickUp = (jobId) => courierAction(jobId, "pickup");
  const deliver = (jobId) => courierAction(jobId, "deliver");

  /* student: stop waiting for a courier and collect the order yourself */
  async function switchToPickup(orderId) {
    const ui = useUiStore();
    const o = order(orderId);
    if (!o || !o.delivery || o.delivery.status !== "open") return;
    // remembered first: the "Switched to pickup" message can arrive before the reply does
    markSwitchedToPickup(orderId);
    const saved = await ui.run(`switch:${orderId}`, () =>
      api.switchToPickup(o.delivery.id, useSessionStore().session.userId),
    );
    if (saved) await loadLive().catch(() => {});
  }

  // Ask the server's wait-time engine when the current cart would be ready
  // (removed: checkout now computes this on the frontend via useCartEstimate).
  // Admin actions (approve/block/remove students, addVenue) moved to stores/admin.js.

  return {
    db,
    order,
    me,
    ordersOf,
    isActive,
    activeJob,
    activeJobs,
    openJobs,
    earnings,
    loadLive,
    loadStoreOrders,
    setOrderStatus,
    startPreparing,
    markReady,
    markCollected,
    setItemAvailable,
    setStoreOpen,
    setAvailable,
    courierAction,
    acceptJob,
    pickUp,
    deliver,
    switchToPickup,
    _normaliseOrder: normaliseOrder,
    _normaliseJob: normaliseJob,
  };
});
