// Session store.
//
// Which account THIS browser tab is signed in as. Each tab keeps its own id in
// sessionStorage, so you can be a student in one tab and the merchant in another.
// Sign-in is simulated for now: pick an account from the database (Supabase Auth
// replaces this later).
//
// signIn/signOut/restoreSession reset the other stores' per-user state exactly as
// the prototype's store.js did, so behaviour is unchanged.
import { defineStore } from "pinia";
import { reactive } from "vue";
import { useCatalogStore } from "./catalog.js";
import { useOrdersStore } from "./orders.js";
import { useUiStore, studentUi, staffUi } from "./ui.js";
import { useNotificationsStore } from "./notifications.js";
import { go, replace, HOME } from "@/router/nav.js";

const SESSION_KEY = "campus-delights-session";
const session = {
  load() {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  save(id, role, { fresh = true } = {}) {
    try {
      if (id) {
        sessionStorage.setItem(SESSION_KEY, id);
        // Only a brand-new sign-in resets "available for jobs" to off; a page
        // refresh (restore) must keep whatever the courier had toggled.
        if (fresh && role === "student") sessionStorage.setItem(courierKey(id), "0");
      } else {
        sessionStorage.clear()
      }
    } catch {
      /* private mode */
    }
  },
};

// "Available for delivery jobs", resets every session
const courierKey = (id) => `campus-delights-courier-${id}`;
const loadCourier = (id) => {
  try {
    return sessionStorage.getItem(courierKey(id)) === "1";
  } catch {
    return false;
  }
};
const saveCourier = (id, on) => {
  try {
    sessionStorage.setItem(courierKey(id), on ? "1" : "0");
  } catch {
    /* private mode */
  }
};

export const useSessionStore = defineStore("session", () => {
  const session$ = reactive({
    userId: null,
    openDelivery: false,
  });

  // TODO sign-in is simulated: pick an account from the database. Supabase Auth replaces this later.
  // navigate=false during restoreSession so a reload keeps the URL the user was on.
  // fresh=false during restoreSession so a page refresh PRESERVES the courier flag
  // and REHYDRATES the notification history (a brand-new sign-in resets both).
  function signIn(userId, { navigate = true, fresh = true } = {}) {
    const catalog = useCatalogStore();
    const orders = useOrdersStore();
    const ui = useUiStore();
    const notes = useNotificationsStore();
    const p = catalog.user(userId);
    if (!p) return;

    // initialise session
    session$.userId = userId;
    session.save(userId, p.role, { fresh });

    // Notifications: a fresh sign-in starts clean (and wipes stale stored
    // history); a refresh restores the history.
    notes.hydrate(userId, { fresh });

    orders.db.orders = [];
    orders.db.jobs = [];
    orders.db.expiredJobs = [];
    orders.db.myJobs = [];

    ui.courierOn = p.role === "student" && loadCourier(userId);
    if (p.role === "student") ui.ui.student = studentUi("explore");
    else
      ui.ui.staff = staffUi(
        p.role === "merchant"
          ? (catalog.storesOf(userId)[0] || {}).id || null
          : null,
      );
    if (navigate) go(HOME[p.role] || "/");
  }

  function signOut() {
    const ui = useUiStore();
    session$.userId = null;
    session.save(null);
    useNotificationsStore().clear();
    replace("/");
  }

  function restoreSession() {
    const catalog = useCatalogStore();
    const id = session.load();
    if (id && catalog.user(id)) signIn(id, { navigate: false, fresh: false });
  }

  return {
    session: session$,
    signIn,
    signOut,
    restoreSession,
    _loadCourier: loadCourier,
    _saveCourier: saveCourier,
  };
});
