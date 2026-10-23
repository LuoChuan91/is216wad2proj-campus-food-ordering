// Keep the ui-store's tab/page fields in step with the URL.
//
// vue-router owns the URL. Portal components still read ui-store fields
// (S.ui.student.tab/page/storeId/trackOrderId, S.ui.staff.merchantTab/adminTab),
// so after every navigation we translate the active route's meta + params into
// those fields. This covers navigation the router drives on its own: the browser
// back/forward buttons, a pasted #/... link, and the guard's redirects.
//
// The nav ACTIONS (setTab/openStore/…) also push the URL; they set the same
// fields, so this sync is idempotent for action-driven navigation (no loop).
//
// Called once from startRouting() after the router is ready.
import { useUiStore } from "@/stores/ui.js";
import { useCatalogStore } from "@/stores/catalog.js";
import { ensureRoute } from "@/utils/routing.js";
import { _getRouter } from "@/router/nav.js";

// Routing hand-off point, called by useAppBootstrap.startApp() after the first
// load. The hand-rolled hash/popstate routing that used to live in app/live.js is
// gone — vue-router (createWebHashHistory) now owns navigation. This wires the
// route -> ui-store sync (startRouteSync) so existing portal components that read
// S.ui.student.tab/page keep working while the URL is the source of truth.
export function startRouting() {
  const router = _getRouter();
  if (!router) return; // no router attached (e.g. unit tests) — nothing to sync
  startRouteSync(router);
}

export function startRouteSync(router) {
  const apply = (route) => {
    const ui = useUiStore();
    const m = route.meta || {};
    const u = ui.ui.student;

    if (m.role === "student") {
      // Don't disturb a payment in flight (the prototype blocked URL-driven nav then).
      if (u.sheet === "pay" && u.pay.state === "processing") return;

      if (m.page === "store") {
        u.storeId = route.params.storeId;
        u.page = "store";
        u.sheet = null;
      } else if (m.page === "checkout") {
        u.page = "checkout";
        u.sheet = null;
      } else if (m.page === "track") {
        u.trackOrderId = route.params.orderId;
        u.page = "track";
        u.sheet = null;
      } else if (m.sheet === "venue") {
        // #/student/venue/:venueId — explore tab with the venue sheet open.
        const catalog = useCatalogStore();
        u.tab = "explore";
        u.exploreSeen = true;
        u.page = null;
        u.venueId = route.params.venueId;
        u.sheet = "venue";
        ensureRoute(ui.place(), catalog.venue(route.params.venueId));
      } else if (m.tab) {
        // A plain tab route.
        u.tab = m.tab;
        u.page = null;
        if (u.sheet !== "item" && u.sheet !== "pay") u.sheet = null;
        if (m.tab === "explore") u.exploreSeen = true;
      }
    } else if (m.role === "merchant" && m.merchantTab) {
      ui.ui.staff.merchantTab = m.merchantTab;
    } else if (m.role === "admin" && m.adminTab) {
      ui.ui.staff.adminTab = m.adminTab;
    }
  };

  // Sync the route we're already on, then after every navigation.
  apply(router.currentRoute.value);
  router.afterEach((to) => apply(to));
}
