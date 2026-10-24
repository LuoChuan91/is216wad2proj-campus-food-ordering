// useOpenDeliveriesLive — live-update layer for the COURIER open delivery jobs list.
//
// Scope: this is ONLY the realtime refresh layer for couriers looking for open jobs.
// This composable subscribes to the shared `courier-jobs` channel and, whenever a new
// delivery is created or becomes open, refreshes a reactive `deliveries` list by calling
// an INJECTED fetch function. The courier dashboard mounts it and renders `deliveries`.
//
//   Channel: courier-jobs   Event: 'delivery_change'
//   Fires on: delivery becoming open (see SQL trigger broadcast on public.deliveries).
//
// Behaviour mirrors useStoreOrdersLive: debounced refetch on broadcast, polling
// fallback when Realtime is down, keep-last-data + `stale` flag on a failed
// refresh, and full teardown on unmount or when `enabled` is set to false.
import { ref, watch, onMounted, onBeforeUnmount, toValue } from 'vue'
import defaultSupabase from '@/common/supabase.js'
import { api } from '@/services/api.js'

// Default fetch: the shared api layer (GET /deliveries?status=open). Injectable so the
// dashboard can swap in its own fetch without touching the live-update logic.
async function defaultFetchOpenDeliveries() {
  return api.openJobs()
}

/**
 * @param {object} [options]
 * @param {import('vue').MaybeRefOrGetter<boolean>} [options.enabled=true] - Toggle listening (e.g. courier "Open to Jobs" switch)
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
    pollMs = 30000,
    supabaseClient = defaultSupabase,
  } = options

  const deliveries = ref([])
  const loading = ref(true)
  const error = ref(null)
  const stale = ref(false)
  const liveConnected = ref(false)
  const hasData = ref(false)

  let channel = null
  let pollTimer = null
  let refetchTimer = null
  let destroyed = false

  async function load() {
    if (!toValue(enabled)) return

    try {
      const data = await fetchDeliveries()
      if (destroyed) return
      // Accept either a bare array or a { deliveries: [...] } envelope.
      deliveries.value = Array.isArray(data) ? data : (data?.deliveries ?? [])
      hasData.value = true
      error.value = null
      stale.value = false
    } catch (e) {
      console.warn('[useOpenDeliveriesLive] load failed:', e)
      if (destroyed) return
      if (hasData.value) {
        stale.value = true // keep the last good list, flag it as possibly out of date
      } else {
        error.value = e.message || 'Could not load open delivery jobs'
      }
    } finally {
      if (!destroyed) loading.value = false
    }
  }

  // Debounce bursts of broadcasts (e.g. several orders placed around the same time) into one refetch.
  function scheduleRefetch() {
    if (refetchTimer) clearTimeout(refetchTimer)
    refetchTimer = setTimeout(load, 300)
  }

  function startPolling() {
    stopPolling()
    if (pollMs > 0 && toValue(enabled)) pollTimer = setInterval(load, pollMs)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function subscribe() {
    teardownChannel()
    if (!toValue(enabled)) return

    if (!supabaseClient || typeof supabaseClient.channel !== 'function') {
      startPolling()
      return
    }
    try {
      channel = supabaseClient
        .channel('courier-jobs')
        .on('broadcast', { event: 'delivery_change' }, scheduleRefetch)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            liveConnected.value = true
            stopPolling()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            liveConnected.value = false
            startPolling()
          }
        })
    } catch (e) {
      console.warn('[useOpenDeliveriesLive] realtime subscribe failed, falling back to polling:', e)
      channel = null
      liveConnected.value = false
      startPolling()
    }
  }

  function teardownChannel() {
    if (channel && supabaseClient?.removeChannel) {
      try {
        supabaseClient.removeChannel(channel)
      } catch (e) {
        console.warn('[useOpenDeliveriesLive] realtime teardown failed:', e)
      }
    }
    channel = null
    liveConnected.value = false
  }

  async function refresh() {
    await load()
  }

  onMounted(() => {
    if (toValue(enabled)) {
      load()
      subscribe()
    } else {
      loading.value = false
    }
  })

  onBeforeUnmount(() => {
    destroyed = true
    if (refetchTimer) clearTimeout(refetchTimer)
    stopPolling()
    teardownChannel()
  })

  // Watch for changes in the `enabled` flag (e.g., courier toggles "Open to Jobs" ON/OFF)
  watch(
    () => toValue(enabled),
    (isEnabled) => {
      if (isEnabled) {
        loading.value = true
        hasData.value = false
        error.value = null
        stale.value = false
        load()
        subscribe()
      } else {
        stopPolling()
        teardownChannel()
        deliveries.value = []
        loading.value = false
      }
    }
  )

  return { deliveries, loading, error, stale, liveConnected, refresh }
}