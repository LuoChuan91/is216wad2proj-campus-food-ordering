// Session store (ported from app/state.js).
//
// Which account THIS browser tab is signed in as. Each tab keeps its own id in
// sessionStorage, so you can be a student in one tab and the merchant in another.
// Sign-in is simulated for now: pick an account from the database (Supabase Auth
// replaces this later).
//
// signIn/signOut/restoreSession reset the other stores' per-user state exactly as
// the prototype's store.js did, so behaviour is unchanged.
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { useCatalogStore } from './catalog.js'
import { useOrdersStore } from './orders.js'
import { useUiStore, studentUi, staffUi } from './ui.js'
import { go, replace, HOME } from '@/router/nav.js'

const SESSION_KEY = 'campus-delights-session'
const session = {
  load() { try { return sessionStorage.getItem(SESSION_KEY) } catch { return null } },
  save(id) { try { if (id) sessionStorage.setItem(SESSION_KEY, id); else sessionStorage.removeItem(SESSION_KEY) } catch { /* private mode */ } },
}

// "Available for delivery jobs" isn't a database column yet, so each browser remembers it
const courierKey = (id) => `campus-delights-courier-${id}`
const loadCourier = (id) => { try { return localStorage.getItem(courierKey(id)) === '1' } catch { return false } }
const saveCourier = (id, on) => { try { localStorage.setItem(courierKey(id), on ? '1' : '0') } catch { /* private mode */ } }

export const useSessionStore = defineStore('session', () => {
  // Shape preserved from S.session: { userId }
  const session$ = reactive({ userId: null })

  /* sign-in is simulated: pick an account from the database. Supabase Auth replaces this later. */
  // navigate=false during restoreSession so a reload keeps the URL the user was on.
  function signIn(userId, { navigate = true } = {}) {
    const catalog = useCatalogStore()
    const orders = useOrdersStore()
    const ui = useUiStore()
    const p = catalog.user(userId)
    if (!p) return
    session$.userId = userId
    session.save(userId)
    ui.toasts.splice(0)
    ui.notifications.splice(0)
    ui.menu = null
    ui.readId = 0
    orders.db.orders = []
    orders.db.jobs = []
    orders.db.expiredJobs = []
    orders.db.myJobs = []
    ui.courierOn = p.role === 'student' && loadCourier(userId)
    if (p.role === 'student') ui.ui.student = studentUi('explore')
    else ui.ui.staff = staffUi(p.role === 'merchant' ? (catalog.storesOf(userId)[0] || {}).id || null : null)
    if (navigate) go(HOME[p.role] || '/')
  }

  function signOut() {
    const ui = useUiStore()
    session$.userId = null
    session.save(null)
    ui.toasts.splice(0)
    ui.menu = null
    replace('/')
  }

  function restoreSession() {
    const catalog = useCatalogStore()
    const id = session.load()
    if (id && catalog.user(id)) signIn(id, { navigate: false })
  }

  return { session: session$, signIn, signOut, restoreSession, _loadCourier: loadCourier, _saveCourier: saveCourier }
})
