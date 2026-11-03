// UI store: this tab's view state — student tab/page/sheet, cart, checkout, item
// draft, staff tabs, the busy map — plus notify() and the run() busy wrapper.
import { defineStore } from "pinia";
import { reactive, ref } from "vue";
import * as E from "@/utils/engine.js";
import { getRoute, ensureRoute } from "@/utils/routing.js";
import { api } from "@/services/api.js";
import { config as cfg } from "@/config/index.js";
import { useNotificationsStore } from "@/stores/notifications.js";
import { go } from "@/router/nav.js";
import { useSessionStore } from "./session.js";
import { useCatalogStore } from "./catalog.js";
import { useOrdersStore } from "./orders.js";

// Where "you" are when the browser's location isn't used: the middle of the SMU campus
export const DEFAULT_PLACE = {
  lat: 1.2966,
  lng: 103.8499,
  label: "SMU campus",
};

let lineSeq = 0;

// The app's poll-notification tones -> the Bootstrap variants the notifications
// store / toaster use.
const VARIANT = { ok: "success", info: "info", warn: "warning", error: "danger", brand: "secondary" };

export function studentUi(tab = "explore") {
  return {
    tab,
    page: null,
    sheet: null,
    venueId: null,
    storeId: null,
    itemId: null,
    draft: { selected: [], qty: 1 },
    cart: { storeId: null, lines: [] },
    checkout: { type: "pickup", dropoffId: null, note: "" },
    pay: { state: "idle", orderId: null, error: "", result: null },
    trackOrderId: null,
    exploreSeen: tab === "explore",
    search: "",
    place: null,
    locating: false,
    locateError: "",
    list: { filter: "all", sort: "recommended", search: "" }, // the Stores tab
  };
}
export function staffUi(storeId = null) {
  return {
    merchantTab: "orders",
    adminTab: "approvals",
    storeId,
    venueDraft: { name: "", lat: "", lng: "" },
    formError: "",
    saving: false,
  };
}

const by = (arr, id) => arr.find((x) => x.id === id);

export const useUiStore = defineStore("ui", () => {
  const loaded = ref(false); // the first load from the server finished
  const loadError = ref("");
  const online = ref(true); // false while the server can't be reached
  const now = ref(Date.now());
  const ui = reactive({ student: studentUi(), staff: staffUi() });
  const courierOn = ref(false);
  const mapOffline = ref(false);
  const busy = reactive({}); // { [id]: true } while a button's request is running

  /* ---------- notifications (pop-ups and the bell) ----------
     This tab has ONE notification surface: the Pinia notifications store, shown
     by NotificationToaster.vue (pop-ups) and NotificationPanel.vue (bell panel /
     full-screen page).

     Two entry points, both from the poll-diff path (useAppBootstrap):
       notify(title, body, tone, meta)  — plain messages that have no realtime
                 equivalent (account approved, a new delivery job, etc.). Always
                 shown as a toast + history item.
       notifyView(view, meta)           — order/delivery STATUS events, where
                 `view` is the shared builder's output ({ title, body, variant,
                 toast }) so the wording matches the realtime path exactly.

     `meta` carries the order/delivery status for realtime-owned events: when the
     Supabase channel is connected those arrive via realtime, so we skip them here
     to avoid a duplicate; when it is down (or Supabase isn't configured) we mirror
     them so nothing is lost. */
  function pushView(view, meta, toast) {
    try {
      const store = useNotificationsStore();
      // One surface, one de-dup gate: the store collapses an event that the
      // realtime channel also delivers (matched by kind/status/order via meta)
      store.pushLocal({
        title: view.title,
        body: view.body,
        variant: view.variant || "secondary",
        toast,
        meta,
      });
    } catch (err) {
      // Pinia not ready yet (very early start-up): skip rather than break the app.
      console.warn("[notify] skipped:", err.message);
    }
  }

  function notify(title, body, tone = "brand", meta = null) {
    pushView({ title, body, variant: VARIANT[tone] || "secondary" }, meta, true);
  }

  // Push a prebuilt view from buildNotification() (shared wording with realtime).
  function notifyView(view, meta = null) {
    if (!view) return;
    pushView(view, meta, view.toast !== false);
  }

  // Runs an API call for a button: marks it busy, shows the server's error as a pop-up if it fails
  async function run(key, fn) {
    if (busy[key]) return null;
    busy[key] = true;
    try {
      return await fn();
    } catch (err) {
      notify("That didn't work", err.message, "warn");
      return null;
    } finally {
      delete busy[key];
    }
  }

  function tick() {
    now.value = Date.now();
  }

  /* ---------- place / walk helpers ---------- */
  function place() {
    const u = ui.student;
    return u.place || DEFAULT_PLACE;
  }
  const walk = (venue) => getRoute(place(), venue);

  // Whether a store is open now (respecting the opening-hours config flag)
  function open(store) {
    return E.openStatus(store, now.value, cfg.enforceOpeningHours);
  }

  /* student navigation */
  function setTab(tab) {
    const u = ui.student;
    u.tab = tab;
    u.page = null;
    u.sheet = null;
    if (tab === "explore") u.exploreSeen = true;
    go("/student/" + tab);
  }
  function setSearch(q) {
    const u = ui.student;
    u.search = q.slice(0, 40);
    if (q && u.sheet === "venue") {
      u.sheet = null;
      u.venueId = null;
      go("/student/explore");
    }
  }
  function setListSearch(q) {
    ui.student.list.search = q.slice(0, 40);
  }
  function setListFilter(f) {
    ui.student.list.filter = f;
  }
  function setListSort(s) {
    ui.student.list.sort = s;
  }
  function openStoreItem(storeId, itemId) {
    const catalog = useCatalogStore();
    if (!catalog.storeAvailable(catalog.store(storeId))) return;
    openStore(storeId);
    openItem(itemId);
  }
  function openVenue(venueId) {
    const catalog = useCatalogStore();
    const u = ui.student;
    u.tab = "explore";
    u.exploreSeen = true;
    u.page = null;
    u.venueId = venueId;
    u.sheet = "venue";
    ensureRoute(place(), catalog.venue(venueId));
    go("/student/venue/" + venueId);
  }
  function locate() {
    const catalog = useCatalogStore();
    const u = ui.student;
    if (!navigator.geolocation) {
      u.locateError = "Location isn't available in this browser.";
      return;
    }
    u.locating = true;
    u.locateError = "";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        u.locating = false;
        u.place = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Your location",
        };
        for (const v of catalog.db.venues) ensureRoute(u.place, v);
      },
      () => {
        u.locating = false;
        u.locateError =
          "Couldn't get your location. Allow location access and try again.";
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }
  function closeSheet() {
    const u = ui.student;
    if (u.sheet === "pay" && u.pay.state === "processing") return;
    if (u.sheet === "pay" && u.pay.state === "done") {
      openTracking(u.pay.orderId);
      return;
    }
    if (u.sheet === "venue") {
      u.venueId = null;
      u.sheet = null;
      go("/student/explore");
      return;
    }
    u.sheet = null;
  }
  function openStore(storeId) {
    const catalog = useCatalogStore();
    // A store whose merchant is blocked/removed is not orderable — ignore clicks.
    if (!catalog.storeAvailable(catalog.store(storeId))) return;
    const u = ui.student;
    u.storeId = storeId;
    u.page = "store";
    u.sheet = null;
    go("/student/store/" + storeId);
  }
  function back() {
    const u = ui.student;
    if (u.sheet === "item" || u.sheet === "pay") {
      closeSheet();
      return;
    }
    if (u.page === "checkout") {
      u.page = "store";
      u.storeId = u.cart.storeId || u.storeId;
      go("/student/store/" + u.storeId);
      return;
    }
    if (u.page === "track") {
      u.page = null;
      go("/student/" + u.tab);
      return;
    }
    if (u.page === "store") {
      u.page = null;
      if (u.venueId && u.tab === "explore") {
        u.sheet = "venue";
        go("/student/venue/" + u.venueId);
      } else {
        u.sheet = null;
        go("/student/" + u.tab);
      }
      return;
    }
    u.sheet = null;
  }
  function openItem(itemId) {
    const catalog = useCatalogStore();
    const u = ui.student;
    const item = catalog.item(itemId);
    if (!item || !item.available) return;
    u.itemId = itemId;
    u.draft = { selected: [], qty: 1 };
    u.sheet = "item";
  }
  function toggleOption(optionId) {
    const catalog = useCatalogStore();
    const u = ui.student;
    const opts = catalog.options(u.itemId);
    const o = by(opts, optionId);
    const g = catalog.groups(u.itemId).find((x) => x.id === o.group_id);
    if (!o.available) return;
    const sel = u.draft.selected;
    const inGroup = (id) => (by(opts, id) || {}).group_id === g.id;
    if (g.type === "single") {
      u.draft.selected =
        sel.includes(optionId) && !g.required
          ? sel.filter((id) => id !== optionId)
          : sel.filter((id) => !inGroup(id)).concat(optionId);
    } else if (sel.includes(optionId)) {
      u.draft.selected = sel.filter((id) => id !== optionId);
    } else if (sel.filter(inGroup).length < E.rule(g).max) {
      u.draft.selected = sel.concat(optionId);
    }
  }
  function setDraftQty(q) {
    ui.student.draft.qty = Math.max(1, Math.min(9, q));
  }
  function addToCart() {
    const catalog = useCatalogStore();
    const u = ui.student;
    const item = catalog.item(u.itemId);
    const groups = catalog.groups(item.id);
    const opts = catalog.options(item.id);
    if (!E.validate(groups, opts, u.draft.selected).ok) return;
    if (u.cart.storeId && u.cart.storeId !== item.store_id) u.cart.lines = []; // one store per order
    u.cart.storeId = item.store_id;
    u.cart.lines.push({
      key: `line-${++lineSeq}`,
      menu_item_id: item.id,
      qty: u.draft.qty,
      selected: u.draft.selected.slice(),
      unit_price: E.unitPrice(item, opts, u.draft.selected),
    });
    u.sheet = null;
  }
  function reorder(order) {
    const catalog = useCatalogStore();
    const u = ui.student;
    const store = catalog.store(order.store_id);
    if (!catalog.storeAvailable(store) || !open(store).open) {
      notify("Can't order again", `${order.store_name || "This store"} isn't taking orders right now`, "warn");
      return;
    }
    const lines = [];
    for (const line of order.items) {
      const item = catalog.item(line.menu_item_id);
      if (!item || item.available === false) continue;
      const opts = catalog.options(item.id);
      const selected = line.selected_options;
      const optionsOk = selected.every((id) => opts.some((o) => o.id === id && o.available !== false));
      if (!optionsOk || !E.validate(catalog.groups(item.id), opts, selected).ok) continue;
      lines.push({
        key: `line-${++lineSeq}`,
        menu_item_id: item.id,
        qty: line.qty,
        selected: selected.slice(),
        unit_price: E.unitPrice(item, opts, selected),
      });
    }
    if (!lines.length) {
      notify("Can't order again", "None of these items are available any more", "warn");
      return;
    }
    if (u.cart.storeId && u.cart.storeId !== order.store_id) u.cart.lines = [];
    u.cart.storeId = order.store_id;
    u.cart.lines.push(...lines);
    const skipped = order.items.length - lines.length;
    notify(
      "Added to cart",
      skipped ? `${skipped} item${skipped === 1 ? " is" : "s are"} no longer available and ${skipped === 1 ? "was" : "were"} left out` : `${order.store_name || "Your"} order is in your cart`,
      skipped ? "warn" : "ok",
    );
  }
  function setLineQty(key, qty) {
    const u = ui.student;
    const line = u.cart.lines.find((l) => l.key === key);
    if (!line) return;
    if (qty <= 0) u.cart.lines = u.cart.lines.filter((l) => l.key !== key);
    else line.qty = Math.min(9, qty);
    if (!u.cart.lines.length) {
      u.cart.storeId = null;
      if (u.page === "checkout") {
        u.page = "store";
        if (u.storeId) go("/student/store/" + u.storeId);
      }
    }
  }
  function openCheckout() {
    const catalog = useCatalogStore();
    const u = ui.student;
    if (!u.cart.lines.length) return;
    u.page = "checkout";
    u.sheet = null;
    go("/student/checkout");
    if (!u.checkout.dropoffId && catalog.db.destinations.length) {
      const me = place();
      u.checkout.dropoffId = catalog.db.destinations
        .slice()
        .sort((a, b) => E.distanceM(me, a) - E.distanceM(me, b))[0].id;
    }
  }
  function setFulfilment(type) {
    ui.student.checkout.type = type;
  }
  function setDropoff(id) {
    ui.student.checkout.dropoffId = id;
  }
  function setNote(note) {
    ui.student.checkout.note = note.slice(0, 80);
  }
  function openPay() {
    const u = ui.student;
    if (!u.cart.lines.length) return;
    u.pay = { state: "idle", orderId: null, error: "", result: null };
    u.sheet = "pay";
  }
  // Payment is simulated: the server checks and prices the order, then saves it with a payment record
  async function confirmPay() {
    const orders = useOrdersStore();
    const u = ui.student;
    if (
      !u.cart.lines.length ||
      u.pay.state === "processing" ||
      u.pay.state === "done"
    )
      return;
    u.pay.state = "processing";
    u.pay.error = "";
    const body = {
      student_id: useSessionStore().session.userId,
      type: u.checkout.type,
      items: u.cart.lines.map((l) => ({
        menu_item_id: l.menu_item_id,
        qty: l.qty,
        option_ids: l.selected,
      })),
    };
    if (u.checkout.type === "delivery") {
      body.destination_id = u.checkout.dropoffId;
      body.note = u.checkout.note;
    }
    try {
      const [saved] = await Promise.all([
        api.placeOrder(body),
        new Promise((r) => setTimeout(r, 900)),
      ]);
      await orders.loadLive().catch(() => {}); // so the new order is there when the tracking page opens
      u.pay = { state: "done", orderId: saved.id, error: "", result: saved }; // the cart empties when the tracking page opens
    } catch (err) {
      u.pay.state = "error";
      u.pay.error = err.message;
    }
  }
  function openTracking(orderId) {
    const u = ui.student;
    if (u.pay.state === "done") {
      u.cart = { storeId: null, lines: [] };
      u.checkout.note = "";
      u.pay = { state: "idle", orderId: null, error: "", result: null };
    }
    u.sheet = null;
    u.page = "track";
    u.trackOrderId = orderId;
    go("/student/orders/" + orderId);
  }

  /* merchant */
  function setMerchantTab(tab) {
    ui.staff.merchantTab = tab;
    go(tab === "orders" ? "/merchant" : "/merchant/" + tab);
  }
  function setMerchantStore(storeId) {
    ui.staff.storeId = storeId;
  }

  /* admin */
  function setAdminTab(tab) {
    ui.staff.adminTab = tab;
    go(tab === "approvals" ? "/admin" : "/admin/" + tab);
  }
  function setVenueDraft(field, value) {
    ui.staff.venueDraft[field] = value;
    ui.staff.formError = "";
  }

  return {
    loaded, loadError, online, now, ui, courierOn, mapOffline, busy,
    notify, notifyView, run, tick, place, walk, open,
    setTab, setSearch, setListSearch, setListFilter, setListSort, openStoreItem, openVenue, locate,
    closeSheet, openStore, back, openItem, toggleOption, setDraftQty, addToCart, reorder, setLineQty,
    openCheckout, setFulfilment, setDropoff, setNote, openPay, confirmPay, openTracking,
    setMerchantTab, setMerchantStore, setAdminTab, setVenueDraft,
  }
});
