// Subscribe to the current user's realtime notification channel and feed every
// incoming payload into the notifications store.
//
// Channel: user:<userId>   Event: 'notification'   Payload: { kind, status, order_id, at }
//
// The subscription follows the SESSION store's userId (the app's single source of
// truth for who's signed in — the same source useLiveSync uses). It (re)subscribes
// whenever the user logs in / changes, and tears down on logout or unmount.
import { watch, onBeforeUnmount, toValue } from 'vue'
import { storeToRefs } from 'pinia'
import defaultSupabase from '@/common/supabase.js'
import { useSessionStore } from '@/stores/session.js'
import { useNotificationsStore } from '@/stores/notifications.js'

export function useRealtimeNotifications(options = {}) {
  const supabase = options.supabaseClient || defaultSupabase
  const notifications = useNotificationsStore()

  // userId source: defaults to the session store, but injectable (tests, or a
  // future real-auth source) as a ref/getter/plain value.
  const session = useSessionStore()
  const userId = options.userId ?? (() => session.session.userId)

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
    notifications.setRealtimeConnected(false)
  }

  function subscribe(id) {
    teardown()
    if (!id || !supabase || typeof supabase.channel !== 'function') {
      notifications.setRealtimeConnected(false)
      return
    }
    try {
      channel = supabase
        .channel(`user:${id}`)
        .on('broadcast', { event: 'notification' }, (message) => {
          // supabase delivers { event, type, payload }
          const payload = message?.payload ?? message
          notifications.receive(payload)
        })
        .subscribe((status) => {
          // Tell the poll-diff fallback whether realtime is live, so it knows
          // whether to suppress or mirror status/delivery notifications.
          notifications.setRealtimeConnected(status === 'SUBSCRIBED')
        })
    } catch (e) {
      console.warn('[notifications] subscribe failed:', e)
      channel = null
      notifications.setRealtimeConnected(false)
    }
  }

  // Follow the logged-in user. immediate so we attach as soon as a user is known.
  const stopWatch = watch(
    () => toValue(userId),
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
