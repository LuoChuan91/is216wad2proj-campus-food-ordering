// App-level liveness: a broadcast on the user's channel (user:<id>) triggers the
// injected refresh(); two-speed polling backs it up (slow safety net while connected, fast poll while down).
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
