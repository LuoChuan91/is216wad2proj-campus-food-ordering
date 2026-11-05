// After each navigation, translate the active route's meta + params into the
// ui-store tab/page fields the portal components read.
import { useUiStore } from "@/stores/ui.js";
import { useCatalogStore } from "@/stores/catalog.js";
import { ensureRoute } from "@/utils/routing.js";
import { _getRouter } from "@/router/nav.js";


export function startRouting() {
  const router = _getRouter();
  if (!router) return; 
  startRouteSync(router);
}

export function startRouteSync(router) {
  const apply = (route) => {
    const ui = useUiStore();
    const m = route.meta || {};
    const u = ui.ui.student;

    if (m.role === "student") {
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
