// Subscribe to the user's realtime channel (user:<id> / 'notification') and push
// each payload into the notifications store; no polling or data (subscribe-only).
import { toValue } from 'vue'
import { useSessionStore } from '@/stores/session.js'
import { useNotificationsStore } from '@/stores/notifications.js'
import { useRealtimeResource } from './realtime/useRealtimeResource.js'
import { channels, NOTIFICATION } from './realtime/channels.js'

export function useRealtimeNotifications(options = {}) {
  const notifications = useNotificationsStore()

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
    // Subscribe-only: no polling, no data, handle the payload directly.
    onBroadcast: (message) => {
      // supabase delivers { event, type, payload }
      const payload = message?.payload ?? message
      notifications.receive(payload)
    },
    // Track realtime health so pushLocal knows whether to emit poll-diff status events.
    onStatus: (connected) => notifications.setRealtimeConnected(connected),
  })

  return { teardown: stop }
}
