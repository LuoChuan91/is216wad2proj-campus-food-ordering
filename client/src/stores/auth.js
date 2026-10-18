// Minimal auth/session store.
//
// We only need enough to know WHO the current user is, so the notification
// system can subscribe to that user's realtime channel (user:<id>). Full auth
// (login/logout flows, profile, roles) is owned elsewhere; this store just reads
// the Supabase session and tracks the user id reactively.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import defaultSupabase from '@/common/supabase.js'

export const useAuthStore = defineStore('auth', () => {
  const userId = ref(null)
  const ready = ref(false) // true once we've checked the session at least once
  let unsubscribe = null

  /**
   * Load the current user id and keep it in sync with auth changes.
   * @param {object} [client] injectable Supabase client (defaults to shared one)
   */
  async function init(client = defaultSupabase) {
    try {
      const { data } = await client.auth.getUser()
      userId.value = data?.user?.id ?? null
    } catch {
      userId.value = null
    } finally {
      ready.value = true
    }

    // React to login / logout / token refresh.
    if (client.auth?.onAuthStateChange && !unsubscribe) {
      const res = client.auth.onAuthStateChange((_event, session) => {
        userId.value = session?.user?.id ?? null
      })
      // supabase returns { data: { subscription } }
      unsubscribe = res?.data?.subscription?.unsubscribe || null
    }
  }

  function stop() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  return { userId, ready, init, stop }
})
