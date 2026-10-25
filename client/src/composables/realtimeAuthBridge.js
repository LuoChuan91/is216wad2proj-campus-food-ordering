// Feeds the signed-in person into Angel's auth store.
//
// Her realtime composable (useRealtimeNotifications) subscribes to `user:<userId>`
// and takes that id from stores/auth.js, which normally reads a Supabase Auth
// session. The app's sign-in is simulated (a profile picked from the database),
// so there is no Supabase session. This bridge publishes the app's own session id
// into her store, so her subscription works without changing any of her files.
import { watch } from 'vue'
import { useSessionStore } from '@/stores/session.js'
import { useAuthStore } from '@/stores/auth.js'

export function startRealtimeAuthBridge() {
  const session = useSessionStore()
  const auth = useAuthStore()
  watch(
    () => session.session.userId,
    (id) => { auth.userId = id ?? null },
    { immediate: true }
  )
}
