// Subscribe to the current user's realtime notification channel and feed every
// incoming payload into the notifications store.
//
// Channel: user:<userId>   Event: 'notification'   Payload: { kind, status, order_id, at }
//
// The subscription follows the auth store's userId: it (re)subscribes whenever a
// user logs in / changes, and tears down on logout or unmount.
import { watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import defaultSupabase from '@/common/supabase.js'
import { useAuthStore } from '@/stores/auth.js'
import { useNotificationsStore } from '@/stores/notifications.js'

export function useRealtimeNotifications(options = {}) {
  const supabase = options.supabaseClient || defaultSupabase
  const auth = useAuthStore()
  const notifications = useNotificationsStore()
  const { userId } = storeToRefs(auth)

  let channel = null

  function teardown() {
    if (channel && supabase?.removeChannel) {
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        console.warn('[notifications] teardown failed:', e)
      }
    }
    channel = null
  }

  function subscribe(id) {
    teardown()
    if (!id || !supabase || typeof supabase.channel !== 'function') return
    try {
      channel = supabase
        .channel(`user:${id}`)
        .on('broadcast', { event: 'notification' }, (message) => {
          // supabase delivers { event, type, payload }
          const payload = message?.payload ?? message
          notifications.receive(payload)
        })
        .subscribe()
    } catch (e) {
      console.warn('[notifications] subscribe failed:', e)
      channel = null
    }
  }

  // Follow the logged-in user. immediate so we attach as soon as a user is known.
  const stopWatch = watch(
    userId,
    (id) => subscribe(id),
    { immediate: true }
  )

  onBeforeUnmount(() => {
    stopWatch()
    teardown()
  })

  // Exposed for tests / manual control.
  return { teardown }
}
