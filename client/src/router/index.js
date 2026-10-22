// vue-router is the navigation source of truth (replaces the hand-rolled hash
// routing that used to live in app/live.js). We keep the #/... URL scheme with
// createWebHashHistory so existing links and the prototype's address bar still work.
//
// Routes mirror the prototype's screens. The student TAB routes (explore/stores/
// orders/deliver/me) render an invisible placeholder — the tab screens themselves
// render in StudentLayout's persistent KeepAlive layer (so the Leaflet map survives
// navigation). The student PAGE routes (store/checkout/track) render their real
// page components as overlays (meta.page). The item/pay/venue SHEETS are NOT routes;
// they stay as ui-store overlays.
//
// meta on each route lets the guard and the route->ui-store sync (syncRouteToUi)
// translate the URL into the ui-store's tab/page fields, so every existing portal
// component keeps working unchanged while vue-router owns the URL.
import { createRouter, createWebHashHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { HOME } from '@/router/nav.js'

export { HOME }

const StudentLayout = () => import('@/layouts/StudentLayout.vue')
const StaffLayout = () => import('@/layouts/StaffLayout.vue')
const StudentTabView = () => import('@/layouts/StudentTabView.vue')
const SignIn = () => import('@/views/SignInView.vue')
const StorePage = () => import('@/views/student/StoreView.vue')
const CheckoutPage = () => import('@/views/student/CheckoutView.vue')
const TrackPage = () => import('@/views/student/TrackView.vue')
const MerchantOrdersView = () => import('@/views/merchant/MerchantOrdersView.vue')
const MerchantMenuView = () => import('@/views/merchant/MerchantMenuView.vue')
const AdminApprovalsView = () => import('@/views/admin/AdminApprovalsView.vue')
const AdminVenuesView = () => import('@/views/admin/AdminVenuesView.vue')
const AdminStoresView = () => import('@/views/admin/AdminStoresView.vue')
const NotificationsView = () => import('@/views/NotificationsView.vue')
const NotFoundView = () => import('@/views/NotFoundView.vue')

const routes = [
  { path: '/', name: 'signin', component: SignIn, meta: { public: true } },

  // ---- student ----
  { path: '/student', redirect: '/student/explore' },
  {
    path: '/student',
    component: StudentLayout,
    meta: { role: 'student' },
    children: [
      { path: 'explore', name: 'student-explore', component: StudentTabView, meta: { role: 'student', tab: 'explore' } },
      { path: 'venue/:venueId', name: 'student-venue', component: StudentTabView, meta: { role: 'student', tab: 'explore', sheet: 'venue' } },
      { path: 'stores', name: 'student-stores', component: StudentTabView, meta: { role: 'student', tab: 'stores' } },
      { path: 'deliver', name: 'student-deliver', component: StudentTabView, meta: { role: 'student', tab: 'deliver' } },
      { path: 'me', name: 'student-me', component: StudentTabView, meta: { role: 'student', tab: 'me' } },
      { path: 'store/:storeId', name: 'student-store', component: StorePage, meta: { role: 'student', page: 'store' } },
      { path: 'checkout', name: 'student-checkout', component: CheckoutPage, meta: { role: 'student', page: 'checkout' } },
      // Orders list is a tab; a single order is the track page.
      { path: 'orders', name: 'student-orders', component: StudentTabView, meta: { role: 'student', tab: 'orders' } },
      { path: 'orders/:orderId', name: 'student-track', component: TrackPage, meta: { role: 'student', page: 'track' } },
    ],
  },

  // ---- merchant ----
  {
    path: '/merchant',
    component: StaffLayout,
    meta: { role: 'merchant' },
    children: [
      { path: '', name: 'merchant-orders', component: MerchantOrdersView, meta: { role: 'merchant', merchantTab: 'orders' } },
      { path: 'menu', name: 'merchant-menu', component: MerchantMenuView, meta: { role: 'merchant', merchantTab: 'menu' } },
    ],
  },

  // ---- admin ----
  {
    path: '/admin',
    component: StaffLayout,
    meta: { role: 'admin' },
    children: [
      { path: '', name: 'admin-approvals', component: AdminApprovalsView, meta: { role: 'admin', adminTab: 'approvals' } },
      { path: 'venues', name: 'admin-venues', component: AdminVenuesView, meta: { role: 'admin', adminTab: 'venues' } },
      { path: 'stores', name: 'admin-stores', component: AdminStoresView, meta: { role: 'admin', adminTab: 'stores' } },
    ],
  },

  // Full-screen notifications page (NotificationBell links here on < md). Any
  // signed-in role; the guard only requires a session (no role meta).
  { path: '/notifications', name: 'notifications', component: NotificationsView },

  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView, meta: { public: true } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// ---- guard: sign-in + role + inactive-student ----
// Reads the session store (the single source of truth for who's signed in).
//   * not signed in  -> '/' (sign-in), except public routes
//   * role mismatch  -> that role's home
//   * inactive student stays within /student (the layout renders PendingScreen)
router.beforeEach((to) => {
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const me = catalog.user(session.session.userId)

  // Not signed in: only the sign-in page and not-found are reachable.
  if (!me) {
    if (to.meta.public) return true
    return '/'
  }

  // Signed in and heading to sign-in: bounce to the role home.
  if (to.name === 'signin') return HOME[me.role] || '/'

  // Not-found is always allowed for a signed-in user.
  if (to.name === 'not-found') return true

  // Role mismatch: send to the correct role's home.
  if (to.meta.role && to.meta.role !== me.role) return HOME[me.role] || '/'

  // Inactive student: keep them inside /student (StudentLayout shows PendingScreen).
  // Any /student/* route is fine; it renders the pending screen regardless.
  return true
})

export default router
