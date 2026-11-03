// Subscribe to the current user's realtime notification channel and feed every
// incoming payload into the notifications store.
//
// Thin wrapper over the shared realtime engine (useRealtimeResource) in
// SUBSCRIBE-ONLY mode: there is no polling and no data — each broadcast payload
// is handed straight to notifications.receive(). The channel follows the SESSION
// store's userId (the app's single source of truth; same as useLiveSync).
//
//   Channel: user:<userId>   Event: 'notification'   Payload: { kind, status, order_id, at }
import { toValue } from 'vue'
import { useSessionStore } from '@/stores/session.js'
import { useNotificationsStore } from '@/stores/notifications.js'
import { useRealtimeResource } from './realtime/useRealtimeResource.js'
import { channels, NOTIFICATION } from './realtime/channels.js'

export function useRealtimeNotifications(options = {}) {
  const notifications = useNotificationsStore()

  // userId source: defaults to the session store, injectable (tests / future
  // real-auth source) as a ref/getter/plain value.
  const session = useSessionStore()
  const userId = options.userId ?? (() => session.session.userId)

  const { stop } = useRealtimeResource({
    channel: () => {
      const id = toValue(userId)
      return id ? channels.user(id) : null
    },
    event: NOTIFICATION,
    key: () => toValue(userId),
    supabaseClient: options.supabaseClient,
    // Subscribe-only: no polling, no data — handle the payload directly.
    onBroadcast: (message) => {
      // supabase delivers { event, type, payload }
      const payload = message?.payload ?? message
      notifications.receive(payload)
    },
    // Mirror the realtime health into the store so the poll-diff fallback knows
    // whether to suppress or mirror status/delivery notifications.
    onStatus: (connected) => notifications.setRealtimeConnected(connected),
  })

  // Preserve the original public API.
  return { teardown: stop }
}
