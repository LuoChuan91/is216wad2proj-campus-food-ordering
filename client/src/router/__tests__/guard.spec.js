// Tests for the vue-router guard (router/index.js beforeEach) and the
// route -> ui-store sync (router/sync.js). The guard is the navigation gate that
// replaced app/live.js's hand-rolled routing:
//   * not signed in -> '/' (except public routes)
//   * signed in at '/' -> the role's home
//   * role mismatch -> the correct role's home
//   * inactive student stays inside /student (the layout shows the pending screen)
//
// We use a MEMORY-history clone of the real route table so navigation is
// deterministic in jsdom (the production router uses hash history). The guard logic
// under test is identical; only the history backend differs.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

// Keep everything offline: the stores pull in the api service and supabase.
vi.mock('@/services/api.js', () => ({
  api: {
    profiles: vi.fn().mockResolvedValue([]), profile: vi.fn().mockResolvedValue({}),
    venues: vi.fn().mockResolvedValue([]), destinations: vi.fn().mockResolvedValue([]),
    stores: vi.fn().mockResolvedValue([]), menu: vi.fn().mockResolvedValue([]),
    waitTimes: vi.fn().mockResolvedValue({ stores: {}, orders: {}, slots: 2 }),
    estimate: vi.fn().mockResolvedValue({}), studentOrders: vi.fn().mockResolvedValue([]),
    storeOrders: vi.fn().mockResolvedValue([]), openJobs: vi.fn().mockResolvedValue([]),
    expiredJobs: vi.fn().mockResolvedValue([]), myJobs: vi.fn().mockResolvedValue([]),
    placeOrder: vi.fn(), setOrderStatus: vi.fn(), setItemAvailable: vi.fn(),
    updateStore: vi.fn(), delivery: vi.fn(), setProfileStatus: vi.fn(), addVenue: vi.fn(),
  },
}))
vi.mock('@/common/supabase.js', () => ({ default: null, supabase: null }))

import { useCatalogStore } from '@/stores/catalog.js'
import { useSessionStore } from '@/stores/session.js'
import { useUiStore } from '@/stores/ui.js'
import { HOME } from '@/router/nav.js'

// The same route table the app uses, but with memory history and tiny stub
// components (the guard never renders anything in these tests).
const Stub = { template: '<div />' }
function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'signin', component: Stub, meta: { public: true } },
      { path: '/student', redirect: '/student/explore' },
      {
        path: '/student', component: Stub, meta: { role: 'student' },
        children: [
          { path: 'explore', name: 'student-explore', component: Stub, meta: { role: 'student', tab: 'explore' } },
          { path: 'venue/:venueId', name: 'student-venue', component: Stub, meta: { role: 'student', tab: 'explore', sheet: 'venue' } },
          { path: 'stores', name: 'student-stores', component: Stub, meta: { role: 'student', tab: 'stores' } },
          { path: 'deliver', name: 'student-deliver', component: Stub, meta: { role: 'student', tab: 'deliver' } },
          { path: 'me', name: 'student-me', component: Stub, meta: { role: 'student', tab: 'me' } },
          { path: 'store/:storeId', name: 'student-store', component: Stub, meta: { role: 'student', page: 'store' } },
          { path: 'checkout', name: 'student-checkout', component: Stub, meta: { role: 'student', page: 'checkout' } },
          { path: 'orders', name: 'student-orders', component: Stub, meta: { role: 'student', tab: 'orders' } },
          { path: 'orders/:orderId', name: 'student-track', component: Stub, meta: { role: 'student', page: 'track' } },
        ],
      },
      {
        path: '/merchant', component: Stub, meta: { role: 'merchant' },
        children: [
          { path: '', name: 'merchant-orders', component: Stub, meta: { role: 'merchant', merchantTab: 'orders' } },
          { path: 'menu', name: 'merchant-menu', component: Stub, meta: { role: 'merchant', merchantTab: 'menu' } },
        ],
      },
      {
        path: '/admin', component: Stub, meta: { role: 'admin' },
        children: [
          { path: '', name: 'admin-approvals', component: Stub, meta: { role: 'admin', adminTab: 'approvals' } },
          { path: 'venues', name: 'admin-venues', component: Stub, meta: { role: 'admin', adminTab: 'venues' } },
          { path: 'stores', name: 'admin-stores', component: Stub, meta: { role: 'admin', adminTab: 'stores' } },
        ],
      },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: Stub, meta: { public: true } },
    ],
  })
}

// The guard, copied from router/index.js so the test exercises identical logic
// against the memory-history router.
function installGuard(router) {
  router.beforeEach((to) => {
    const session = useSessionStore()
    const catalog = useCatalogStore()
    const me = catalog.user(session.session.userId)
    if (!me) {
      if (to.meta.public) return true
      return '/'
    }
    if (to.name === 'signin') return HOME[me.role] || '/'
    if (to.name === 'not-found') return true
    if (to.meta.role && to.meta.role !== me.role) return HOME[me.role] || '/'
    return true
  })
}

function seed() {
  const catalog = useCatalogStore()
  catalog.db.profiles = [
    { id: 'stu', role: 'student', name: 'Aiden Tan', status: 'active', email: 'a@x' },
    { id: 'pend', role: 'student', name: 'Pending Pat', status: 'inactive', email: 'p@x' },
    { id: 'mer', role: 'merchant', name: 'Mei Lin', status: 'active', email: 'm@x' },
    { id: 'adm', role: 'admin', name: 'Admin', status: 'active', email: 'ad@x' },
  ]
  catalog.db.stores = []
  catalog.decorateStores()
  return catalog
}

describe('router guard', () => {
  let router
  beforeEach(() => {
    setActivePinia(createPinia())
    seed()
    router = makeRouter()
    installGuard(router)
  })

  it('redirects an anonymous visit to a protected route back to the sign-in page', async () => {
    await router.push('/student/explore')
    expect(router.currentRoute.value.name).toBe('signin')
  })

  it('lets an anonymous visitor reach the sign-in page and not-found', async () => {
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('signin')
    await router.push('/totally/unknown')
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('sends a signed-in user away from the sign-in page to their role home', async () => {
    useSessionStore().session.userId = 'stu'
    await router.push('/')
    expect(router.currentRoute.value.fullPath).toBe(HOME.student)
  })

  it('redirects a student trying to open a merchant route to the student home', async () => {
    useSessionStore().session.userId = 'stu'
    await router.push('/merchant/menu')
    expect(router.currentRoute.value.fullPath).toBe(HOME.student)
  })

  it('redirects a merchant trying to open an admin route to the merchant home', async () => {
    useSessionStore().session.userId = 'mer'
    await router.push('/admin/venues')
    expect(router.currentRoute.value.fullPath).toBe(HOME.merchant)
  })

  it('lets a student reach their own routes', async () => {
    useSessionStore().session.userId = 'stu'
    await router.push('/student/stores')
    expect(router.currentRoute.value.name).toBe('student-stores')
    await router.push('/student/store/s1')
    expect(router.currentRoute.value.name).toBe('student-store')
  })

  it('keeps an INACTIVE student inside /student (the layout renders the pending screen)', async () => {
    useSessionStore().session.userId = 'pend'
    await router.push('/student/explore')
    // The guard does not bounce inactive students out of /student; they stay on the
    // student route and the layout shows PendingScreen.
    expect(router.currentRoute.value.fullPath).toBe('/student/explore')
    expect(router.currentRoute.value.meta.role).toBe('student')
  })

  it('an inactive student is still blocked from other roles', async () => {
    useSessionStore().session.userId = 'pend'
    await router.push('/admin')
    expect(router.currentRoute.value.fullPath).toBe(HOME.student)
  })
})

describe('route -> ui-store sync', () => {
  let router
  beforeEach(async () => {
    setActivePinia(createPinia())
    seed()
    router = makeRouter()
    installGuard(router)
    useSessionStore().session.userId = 'stu'
    await router.push('/student/explore')
  })

  it('applies tab / page fields from the active route', async () => {
    const { startRouteSync } = await import('@/router/sync.js')
    const ui = useUiStore()
    startRouteSync(router)

    await router.push('/student/stores')
    expect(ui.ui.student.tab).toBe('stores')
    expect(ui.ui.student.page).toBe(null)

    await router.push('/student/store/s9')
    expect(ui.ui.student.page).toBe('store')
    expect(ui.ui.student.storeId).toBe('s9')

    await router.push('/student/orders/o5')
    expect(ui.ui.student.page).toBe('track')
    expect(ui.ui.student.trackOrderId).toBe('o5')
  })

  it('syncs the merchant and admin staff tabs', async () => {
    const { startRouteSync } = await import('@/router/sync.js')
    const ui = useUiStore()
    startRouteSync(router)
    // merchant
    useSessionStore().session.userId = 'mer'
    await router.push('/merchant/menu')
    expect(ui.ui.staff.merchantTab).toBe('menu')
    // admin
    useSessionStore().session.userId = 'adm'
    await router.push('/admin/venues')
    expect(ui.ui.staff.adminTab).toBe('venues')
  })
})
