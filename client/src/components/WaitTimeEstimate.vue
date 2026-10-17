<script setup>
// Self-contained live wait-time estimate.
//
// Drop it into any page:
//   <WaitTimeEstimate :store-id="storeId" />                      store-wide queue
//   <WaitTimeEstimate :store-id="storeId" :order-id="orderId" />  wait for one order
//
// It fetches the queue through the Express API, computes an estimate with the
// pluggable strategy, and refreshes live when the store's queue changes
// (Supabase Realtime broadcast from the broadcast_queue_change trigger). If the
// Realtime channel never connects, it falls back to polling.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { estimateWaitTime, formatWaitTime, WAIT_TIME_STRATEGIES } from '@/utils/waitTime.js'
import { fetchQueue } from '@/utils/waitTimeApi.js'
import defaultSupabase from '@/common/supabase.js'

const props = defineProps({
  storeId: { type: String, required: true },
  orderId: { type: String, default: null },
  // Aggregation strategy: 'serial' | 'bottleneck' | 'factor' | 'scheduled'
  strategy: {
    type: String,
    default: 'serial',
    validator: (v) => WAIT_TIME_STRATEGIES.includes(v),
  },
  stations: { type: Number, default: 2 },
  // Polling fallback interval (ms) used when Realtime is not connected.
  pollMs: { type: Number, default: 60000 },
  // Injectable for testing; defaults to the shared browser client.
  supabaseClient: { type: Object, default: () => defaultSupabase },
})

const loading = ref(true)   // true only until the FIRST successful/failed load
const error = ref(null)     // message shown when we have no estimate to show
const stale = ref(false)    // true when a refetch failed but we kept an old estimate
const seconds = ref(0)
const hasEstimate = ref(false) // have we ever loaded a real estimate?
const liveConnected = ref(false)

let channel = null
let pollTimer = null
let refetchTimer = null
let destroyed = false

const label = computed(() => formatWaitTime(seconds.value))

async function load() {
  try {
    const { orderItems, cookingDetails } = await fetchQueue(props.storeId, props.orderId)
    const result = estimateWaitTime(orderItems, cookingDetails, {
      strategy: props.strategy,
      stations: props.stations,
    })
    if (destroyed) return
    seconds.value = result.seconds
    hasEstimate.value = true
    error.value = null
    stale.value = false
  } catch (e) {
    // Keep the console breadcrumb for debugging regardless of UI state.
    console.warn('[WaitTimeEstimate] load failed:', e)
    if (destroyed) return
    if (hasEstimate.value) {
      // We already have a good number on screen: keep showing it, just flag it
      // as possibly out of date instead of blanking it out.
      stale.value = true
    } else {
      // Nothing to show yet -> surface the normalized, friendly message.
      error.value = e.message || 'Wait time unavailable'
    }
  } finally {
    if (!destroyed) loading.value = false
  }
}

// Debounce bursts of broadcasts (e.g. several orders at once) into one refetch.
function scheduleRefetch() {
  if (refetchTimer) clearTimeout(refetchTimer)
  refetchTimer = setTimeout(load, 300)
}

// refetch after interval if fetch fail
function startPolling() {
  stopPolling()
  if (props.pollMs > 0) pollTimer = setInterval(load, props.pollMs)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function subscribe() {
  teardownChannel()
  // If there is no usable Realtime client, or creating the subscription throws
  // (misconfigured client, network), degrade gracefully to polling instead of
  // breaking the component.
  if (!props.supabaseClient || typeof props.supabaseClient.channel !== 'function') {
    startPolling()
    return
  }
  try {
    channel = props.supabaseClient
      .channel(`store:${props.storeId}`)
      .on('broadcast', { event: 'queue_change' }, scheduleRefetch)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          liveConnected.value = true
          stopPolling() // live updates are flowing; no need to poll
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          liveConnected.value = false
          startPolling() // fall back to polling
        }
      })
  } catch (e) {
    console.warn('[WaitTimeEstimate] realtime subscribe failed, falling back to polling:', e)
    channel = null
    liveConnected.value = false
    startPolling()
  }
}

function teardownChannel() {
  if (channel && props.supabaseClient?.removeChannel) {
    try {
      props.supabaseClient.removeChannel(channel)
    } catch (e) {
      console.warn('[WaitTimeEstimate] realtime teardown failed:', e)
    }
  }
  channel = null
  liveConnected.value = false
}

onMounted(() => {
  load()
  subscribe()
})

onBeforeUnmount(() => {
  destroyed = true
  if (refetchTimer) clearTimeout(refetchTimer)
  stopPolling()
  teardownChannel()
})

// Re-wire when the store or order being shown changes.
watch(
  () => [props.storeId, props.orderId],
  () => {
    loading.value = true
    hasEstimate.value = false
    error.value = null
    stale.value = false
    load()
    subscribe()
  }
)
</script>

<template>
  <div class="wait-time-estimate d-inline-flex align-items-center gap-2">
    <i class="bi bi-clock-history" aria-hidden="true"></i>

    <template v-if="loading">
      <span class="text-muted">Estimating wait…</span>
    </template>

    <!-- Error only when we have NO estimate to fall back on. -->
    <template v-else-if="error">
      <span class="text-danger" role="alert">{{ error }}</span>
    </template>

    <template v-else>
      <span class="fw-semibold">{{ label }}</span>
      <span
        v-if="liveConnected && !stale"
        class="badge rounded-pill text-bg-success"
        title="Updating live"
      >live</span>
      <!-- Kept the last estimate but the most recent refresh failed. -->
      <span
        v-if="stale"
        class="badge rounded-pill text-bg-warning"
        title="Showing the last known estimate; could not refresh"
      >stale</span>
    </template>
  </div>
</template>
