// useLiveSync — the app-level liveness coordinator.
//
// Thin wrapper over the shared realtime engine (useRealtimeResource) in TRIGGER
// mode: it owns no data. A broadcast on the signed-in user's channel (user:<id>)
// means "your data changed" -> debounced refresh(); the injected refresh() is
// also what the poll fires. Two-speed polling (the primitive's safetyMs option):
// a long safety-net interval while realtime is connected, a fast poll while it's
// down. No signed-in user -> the channel builder returns null, so the primitive
// neither subscribes nor polls.
//
// `refresh` is injected (the app passes useAppBootstrap's refresh = loadLive +
// announceChanges). `userId` is a ref/getter so the subscription follows sign-in.
import { toValue } from 'vue'
import { config as cfg } from '@/config/index.js'
import { useRealtimeResource } from './realtime/useRealtimeResource.js'
import { channels, USER_EVENT, SAFETY_MS, DEBOUNCE_MS } from './realtime/channels.js'

export function useLiveSync(userId, refresh, options = {}) {
  const {
    supabaseClient,
    pollMs = cfg.pollMs, // fast fallback poll when realtime is down
    safetyMs = SAFETY_MS, // long safety-net poll when realtime is connected
    debounceMs = DEBOUNCE_MS,
  } = options

  const { liveConnected, stop } = useRealtimeResource({
    // No user -> null channel -> the primitive neither subscribes nor polls.
    channel: () => {
      const id = toValue(userId)
      return id ? channels.user(id) : null
    },
    event: USER_EVENT,
    key: () => toValue(userId),
    // Trigger mode: no data; a broadcast/poll just runs the injected refresh.
    load: () => refresh(),
    loadOnStart: false, // purely event/poll-driven; never refresh() just from (re)subscribing
    pollMs,
    safetyMs,
    debounceMs,
    supabaseClient,
    // useLiveSync historically did not flip a global loading flag; nothing reads
    // loading/error/stale here, so we just expose liveConnected + stop.
  })

  return { liveConnected, stop }
}
