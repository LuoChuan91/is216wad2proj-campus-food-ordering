<script setup>
// Presentational wait-time badge. All the fetch/realtime/estimation logic lives
// in the useWaitTime composable; this component only formats the number and
// shows live/stale badges. Props are unchanged, so existing usages keep working.
import { computed, toRef } from 'vue'
import { formatWaitTime, WAIT_TIME_STRATEGIES } from '@/utils/waitTime.js'
import { useWaitTime } from '@/composables/useWaitTime.js'
import defaultSupabase from '@/common/supabase.js'

const props = defineProps({
  storeId: { type: String, required: true },
  orderId: { type: String, default: null },
  strategy: {
    type: String,
    default: null,
    validator: (v) => v === null || WAIT_TIME_STRATEGIES.includes(v),
  },
  stations: { type: Number, default: null },
  pollMs: { type: Number, default: 60000 },
  supabaseClient: { type: Object, default: () => defaultSupabase },
  // When true, append "· N ahead" to the label (off by default).
  showAhead: { type: Boolean, default: false },
})

// Pass props as refs/getters so the composable reacts to changes.
const { seconds, ahead, loading, error, stale, liveConnected } = useWaitTime(
  toRef(props, 'storeId'),
  toRef(props, 'orderId'),
  {
    strategy: toRef(props, 'strategy'),
    stations: toRef(props, 'stations'),
    pollMs: props.pollMs,
    supabaseClient: props.supabaseClient,
  }
)

const label = computed(() => {
  const base = formatWaitTime(seconds.value)
  if (!props.showAhead) return base
  const n = ahead.value
  return `${base} · ${n} ${n === 1 ? 'order' : 'orders'} ahead`
})
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
      <span
        v-if="stale"
        class="badge rounded-pill text-bg-warning"
        title="Showing the last known estimate; could not refresh"
      >stale</span>
    </template>
  </div>
</template>
