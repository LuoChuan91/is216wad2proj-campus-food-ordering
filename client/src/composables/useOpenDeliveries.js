// useOpenDeliveriesLive — live-update layer for the COURIER open delivery jobs list.
//
// Thin wrapper over the shared realtime engine (useRealtimeResource). It wires the
// shared `courier-jobs` channel + fetch and maps the engine's generic `data` to
// the public `deliveries`. The `enabled` gate (courier "Open to Jobs" switch) is
// handled by the primitive, which clears the list when turned off.
//
//   Channel: courier-jobs   Event: 'delivery_change'
//   Fires on: delivery becoming open (see the deliveries SQL trigger).
import { ref } from 'vue'
import { api } from '@/services/api.js'
import { useRealtimeResource } from './realtime/useRealtimeResource.js'
import { channels, DELIVERY_CHANGE, COURIER_POLL_MS } from './realtime/channels.js'

// Default fetch: the shared api layer (GET /deliveries?status=open). Injectable.
async function defaultFetchOpenDeliveries() {
  return api.openJobs()
}

/**
 * @param {object} [options]
 * @param {import('vue').MaybeRefOrGetter<boolean>} [options.enabled=true]
 * @param {() => Promise<any>} [options.fetchDeliveries]
 * @param {number} [options.pollMs=30000]
 * @param {object} [options.supabaseClient]
 * @returns {{ deliveries: import('vue').Ref<any[]>, loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>, stale: import('vue').Ref<boolean>,
 *   liveConnected: import('vue').Ref<boolean>, refresh: () => Promise<void> }}
 */
export function useOpenDeliveriesLive(options = {}) {
  const {
    enabled = true,
    fetchDeliveries = defaultFetchOpenDeliveries,
    pollMs = COURIER_POLL_MS,
    supabaseClient,
  } = options

  const deliveries = ref([])

  const { loading, error, stale, liveConnected, refresh } = useRealtimeResource({
    channel: () => channels.courierJobs(),
    event: DELIVERY_CHANGE,
    enabled,
    pollMs,
    supabaseClient,
    errorMessage: 'Could not load open delivery jobs',
    load: fetchDeliveries,
    // Accept either a bare array or a { deliveries: [...] } envelope.
    apply: (res) => { deliveries.value = Array.isArray(res) ? res : (res?.deliveries ?? []) },
    // When the courier toggles off, the primitive tears down + calls onReset.
    onReset: () => { deliveries.value = [] },
  })

  return { deliveries, loading, error, stale, liveConnected, refresh }
}
