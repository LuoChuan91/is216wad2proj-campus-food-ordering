<script setup>
// Rich order-tracking page.
//   - Order reference (derived from the UUID; schema has no friendly id)
//   - Live wait-time -> ETA clock time (ready at; for delivery also delivered at)
//   - Animated status timeline (preparing -> ready -> picked up)
//
// It reads the order id from the route param and the rest from the query, since
// the real order/delivery rows are owned by other features:
//   /orders/<orderId>/track?store_id=<id>&mode=pickup|delivery&status=<status>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useWaitTime } from '@/composables/useWaitTime.js'
import { toOrderReference } from '@/utils/orderReference.js'
import { computeEta } from '@/utils/eta.js'
import { formatWaitTime } from '@/utils/waitTime.js'
import OrderStatusTimeline from '@/components/OrderStatusTimeline.vue'

const route = useRoute()

const orderId = computed(() => route.params.orderId)
const storeId = computed(() => route.query.store_id || null)
// TODO: better way of doing
const mode = computed(() => (route.query.mode === 'delivery' ? 'delivery' : 'pickup'))
const status = computed(() => route.query.status || 'preparing')

// TODO: might need to change
const reference = computed(() => toOrderReference(orderId.value, mode.value === 'delivery' ? 'DLV' : 'ORD'))

// Single source of truth for the wait estimate (one subscription for this page).
const { seconds, loading, error, stale, liveConnected } = useWaitTime(storeId, orderId)

// Placeholder walking leg for delivery (store -> dropoff). TODO: real coords.
// const walkingSeconds = computed(() =>
//   mode.value === 'delivery' ? estimateWalkingSeconds(null, null) : 0
// )

// A ticking clock so ETA labels stay current.
const nowMs = ref(Date.now())
let clock = null
onMounted(() => {
  clock = setInterval(() => (nowMs.value = Date.now()), 30000)
})
onBeforeUnmount(() => clock && clearInterval(clock))

// const eta = computed(() => computeEta(nowMs.value, seconds.value, walkingSeconds.value))
const eta = computed(() => computeEta(nowMs.value, seconds.value, 10))
const waitLabel = computed(() => formatWaitTime(seconds.value))
</script>

<template>
  <main class="container py-4" style="max-width: 640px">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h4 m-0">Order tracking</h1>
      <span class="badge text-bg-light border" data-test="reference">{{ reference }}</span>
    </div>

    <!-- Status animation -->
    <div class="card mb-3">
      <div class="card-body">
        <OrderStatusTimeline :status="status" :mode="mode" />
      </div>
    </div>

    <!-- ETA -->
    <div class="card">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between">
          <h2 class="h6 text-muted m-0">
            {{ mode === 'delivery' ? 'Estimated delivery' : 'Estimated ready' }}
          </h2>
          <span v-if="liveConnected && !stale" class="badge rounded-pill text-bg-success">live</span>
          <span v-else-if="stale" class="badge rounded-pill text-bg-warning">stale</span>
        </div>

        <template v-if="loading">
          <p class="fs-4 mb-0 text-muted">Estimating…</p>
        </template>
        <template v-else-if="error">
          <p class="text-danger mb-0" role="alert">{{ error }}</p>
        </template>
        <template v-else>
          <!-- Ready time (always shown). TODO: might want to change this up -->
          <p class="fs-3 mb-1" data-test="ready-at">
            {{ eta.readyAtLabel }}
            <small class="text-muted fs-6">({{ waitLabel }})</small>
          </p>

          <!-- Delivery adds the walking leg -> delivered time. -->
          <p v-if="mode === 'delivery'" class="mb-0 text-muted" data-test="delivered-at">
            Arrives around <strong>{{ eta.deliveredAtLabel }}</strong>
            <small>(+{{ formatWaitTime(walkingSeconds) }} walking)</small>
          </p>
        </template>
      </div>
    </div>
  </main>
</template>
