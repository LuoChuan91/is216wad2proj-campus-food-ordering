<script setup>
import { computed, inject, reactive, ref, watch } from 'vue'
import { api } from '@/services/api.js'
import { useOrdersStore } from '@/stores/orders.js'
import { money } from '@/utils/engine.js'
import TrendChart from '@/components/TrendChart.vue'

const DAY_MS = 24 * 60 * 60 * 1000
const SGT_MS = 8 * 60 * 60 * 1000
const PRESETS = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: 'custom', label: 'Custom' },
]

const store = inject('merchantStore')
const ordersStore = useOrdersStore()

const sgDate = (ms) => new Date(ms + SGT_MS).toISOString().slice(0, 10)
const today = () => sgDate(Date.now())
const daysBefore = (date, n) => sgDate(Date.parse(`${date}T00:00:00+08:00`) - n * DAY_MS)

const range = reactive({ preset: '7d', from: daysBefore(today(), 6), to: today() })
const data = ref(null)
const loading = ref(false)
const error = ref('')

function choose(preset) {
  range.preset = preset.id
  if (!preset.days) return
  range.to = today()
  range.from = daysBefore(range.to, preset.days - 1)
}

const rangeError = computed(() => {
  if (!range.from || !range.to) return 'Pick both dates.'
  if (range.from > range.to) return 'The start date must be on or before the end date.'
  if (range.to > today()) return 'The end date can’t be in the future.'
  return ''
})

let requestSeq = 0
async function load() {
  if (!store.value || rangeError.value) return
  const seq = ++requestSeq
  loading.value = true
  try {
    const result = await api.storeAnalytics(store.value.id, range.from, range.to)
    if (seq !== requestSeq) return
    data.value = result
    error.value = ''
  } catch (err) {
    if (seq !== requestSeq) return
    error.value = err.message
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

const storeOrdersKey = computed(() => {
  const id = store.value && store.value.id
  return ordersStore.db.orders.filter((o) => o.store_id === id).map((o) => `${o.id}:${o.status}`).join(',')
})
watch(() => [store.value && store.value.id, range.from, range.to], load, { immediate: true })
watch(storeOrdersKey, load)

const fmtDay = (date) => new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' })
const fmtMinutes = (m) => (m == null ? '—' : `${Math.round(m * 10) / 10} min`)
const rangeLabel = computed(() => {
  if (!data.value) return ''
  return data.value.from === data.value.to ? fmtDay(data.value.from) : `${fmtDay(data.value.from)} – ${fmtDay(data.value.to)}`
})

const labels = computed(() => (data.value ? data.value.daily.map((d) => fmtDay(d.date)) : []))
const orderCounts = computed(() => (data.value ? data.value.daily.map((d) => d.orders) : []))
const earningsByDay = computed(() => (data.value ? data.value.daily.map((d) => d.earnings) : []))
const waitByDay = computed(() => (data.value ? data.value.daily.map((d) => d.avg_wait_min) : []))
const perDay = computed(() => (data.value && data.value.daily.length ? Math.round((data.value.orders / data.value.daily.length) * 10) / 10 : 0))
const stats = computed(() => {
  if (!data.value) return []
  return [
    { label: 'Total earnings', value: money(data.value.earnings), hint: 'After discounts, excluding delivery fees' },
    { label: 'Orders', value: data.value.orders, hint: `${perDay.value} per day on average` },
    { label: 'Average wait', value: fmtMinutes(data.value.avg_wait_min), hint: 'From payment to ready for pickup' },
  ]
})
</script>

<template>
  <div class="analytics scroll">
    <div class="container-fluid px-0">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
        <div>
          <h2 class="h5 fw-bold mb-1">Analytics</h2>
          <p class="text-body-secondary small mb-0">{{ rangeLabel || 'Earnings, orders and wait times' }}<span v-if="loading" class="ms-2 spinner-border spinner-border-sm align-middle" role="status" aria-label="Loading"></span></p>
        </div>
        <div class="d-flex flex-wrap align-items-end gap-2">
          <div class="btn-group btn-group-sm" role="group" aria-label="Timeframe">
            <button v-for="p in PRESETS" :key="p.id" type="button" class="btn" :class="range.preset === p.id ? 'btn-dark' : 'btn-outline-secondary'" :aria-pressed="range.preset === p.id" @click="choose(p)">{{ p.label }}</button>
          </div>
          <template v-if="range.preset === 'custom'">
            <label class="small fw-bold">From
              <input v-model="range.from" type="date" class="form-control form-control-sm" :max="range.to || today()" :class="{ 'is-invalid': rangeError }">
            </label>
            <label class="small fw-bold">To
              <input v-model="range.to" type="date" class="form-control form-control-sm" :min="range.from" :max="today()" :class="{ 'is-invalid': rangeError }">
            </label>
          </template>
        </div>
      </div>

      <div v-if="range.preset === 'custom' && rangeError" class="alert alert-warning py-2 small" role="alert">{{ rangeError }}</div>
      <div v-if="error" class="alert alert-danger py-2 small d-flex align-items-center justify-content-between gap-2" role="alert">
        <span>Couldn’t load analytics: {{ error }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" @click="load">Try again</button>
      </div>

      <div v-if="!data && loading" class="text-center text-body-secondary py-5">Loading analytics…</div>

      <template v-if="data">
        <div class="row g-3 mb-3">
          <div v-for="s in stats" :key="s.label" class="col-12 col-md-4">
            <section class="card h-100">
              <div class="card-body">
                <h3 class="small text-uppercase text-body-secondary fw-bold mb-1">{{ s.label }}</h3>
                <p class="fs-3 fw-bold mb-1 stat-value">{{ s.value }}</p>
                <p class="small text-body-secondary mb-0">{{ s.hint }}</p>
              </div>
            </section>
          </div>
        </div>

        <p v-if="!data.orders" class="text-body-secondary small">No orders in this timeframe yet.</p>

        <div class="row g-3 pb-3">
          <div class="col-12 col-xl-6">
            <section class="card h-100">
              <div class="card-header bg-transparent"><h3 class="h6 fw-bold mb-0">Daily order volume</h3></div>
              <div class="card-body">
                <TrendChart type="bar" :labels="labels" :values="orderCounts" label="Orders" integer />
              </div>
            </section>
          </div>
          <div class="col-12 col-xl-6">
            <section class="card h-100">
              <div class="card-header bg-transparent"><h3 class="h6 fw-bold mb-0">Daily earnings</h3></div>
              <div class="card-body">
                <TrendChart type="line" :labels="labels" :values="earningsByDay" label="Earnings" :format="money" />
              </div>
            </section>
          </div>
          <div class="col-12">
            <section class="card">
              <div class="card-header bg-transparent"><h3 class="h6 fw-bold mb-0">Average wait per day</h3></div>
              <div class="card-body">
                <TrendChart type="bar" :labels="labels" :values="waitByDay" label="Average wait" :format="fmtMinutes" />
              </div>
            </section>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.analytics {
  flex: 1;
  min-height: 0;
  padding: 14px 18px 0;
}
.card {
  border-radius: 14px;
}
.stat-value {
  font-variant-numeric: tabular-nums;
}
</style>
