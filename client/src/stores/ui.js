// UI store.
//
// Everything that is purely about what THIS tab is showing and doing: the student's
// tab/page/sheet, the cart, checkout, item draft, the staff tabs, the busy map (so a
// button can't fire twice), the top-bar dropdown, and this tab's own toasts and
// notification history. Also notify() and the run() busy wrapper, preserved exactly from the prototype.
import { defineStore } from "pinia";
import { reactive, ref } from "vue";
import * as E from "@/utils/engine.js";
import { getRoute, ensureRoute } from "@/utils/routing.js";
import { api } from "@/services/api.js";
import { config as cfg } from "@/config/index.js";
import { mirrorNotification } from "@/composables/notifyBridge.js";
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
let noteSeq = 0;

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
    estimate: null, // when the cart would be ready, // TODO from the server (should not from server)
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
  const notifications = reactive([]); // this tab's notification history (newest first)
  const toasts = reactive([]);
  const menu = ref(null); // which top-bar dropdown is open
  const readId = ref(0); // notifications up to this id have been seen in the bell
  const mapOffline = ref(false);
  const busy = reactive({}); // { [id]: true } while a button's request is running

  /* ---------- notifications (pop-ups and the bell) ---------- */
  function notify(title, body, tone = "brand", meta = null) {
    const n = { id: ++noteSeq, title, body, tone, created_at: Date.now() };
    notifications.unshift(n);
    if (notifications.length > 30) notifications.length = 30;
    pushToast(n);
    // Also hand it notifications store, so bell panel and toasts show it.
    mirrorNotification(n, meta);
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

  /* pop-up notifications in this tab */
  function pushToast(n) {
    if (toasts.some((t) => t.id === n.id)) return;
    toasts.push({ id: n.id, title: n.title, body: n.body, tone: n.tone });
    const max = window.innerWidth < 720 ? 1 : 3; // phones show the newest one only
    while (toasts.length > max) toasts.shift();
    setTimeout(() => dismissToast(n.id), 6000);
  }
  function dismissToast(id) {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
  }
  function toggleMenu(name) {
    menu.value = menu.value === name ? null : name;
    if (menu.value === "bell")
      readId.value = notifications.length ? notifications[0].id : 0;
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
  // How many notifications are newer than the last one seen in the bell
  function unread() {
    return notifications.filter((n) => n.id > readId.value).length;
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
    const orders = useOrdersStore();
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
  function setLineQty(key, qty) {
    const orders = useOrdersStore();
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
    } else orders.refreshEstimate();
  }
  function openCheckout() {
    const catalog = useCatalogStore();
    const orders = useOrdersStore();
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
    orders.refreshEstimate();
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
      u.estimate = null;
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
    go(tab === "menu" ? "/merchant/menu" : "/merchant");
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
    loaded, loadError, online, now, ui, courierOn, notifications, toasts, menu, readId, mapOffline, busy,
    notify, run, tick, pushToast, dismissToast, toggleMenu, place, walk, open, unread,
    setTab, setSearch, setListSearch, setListFilter, setListSort, openStoreItem, openVenue, locate,
    closeSheet, openStore, back, openItem, toggleOption, setDraftQty, addToCart, setLineQty,
    openCheckout, setFulfilment, setDropoff, setNote, openPay, confirmPay, openTracking,
    setMerchantTab, setMerchantStore, setAdminTab, setVenueDraft,
  }
});
