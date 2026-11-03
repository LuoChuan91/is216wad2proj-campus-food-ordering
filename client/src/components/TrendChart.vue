<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chart, BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler } from 'chart.js'

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler)

const props = defineProps({
  type: { type: String, default: 'bar' },
  labels: { type: Array, required: true },
  values: { type: Array, required: true },
  label: { type: String, required: true },
  format: { type: Function, default: (v) => String(v) },
  integer: { type: Boolean, default: false },
})

const canvas = ref(null)
let chart = null

const token = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

function config() {
  const brand = token('--brand', '#e5512d')
  const muted = token('--muted', '#767d90')
  const line = token('--line', '#e4e7ef')
  return {
    type: props.type,
    data: {
      labels: props.labels,
      datasets: [{
        label: props.label,
        data: props.values,
        backgroundColor: props.type === 'line' ? token('--brand-soft', '#fdebe5') : brand,
        borderColor: brand,
        borderWidth: props.type === 'line' ? 2 : 0,
        borderRadius: 4,
        fill: props.type === 'line',
        tension: 0.3,
        pointRadius: props.labels.length > 14 ? 0 : 3,
        pointHoverRadius: 5,
        maxBarThickness: 32,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${props.label}: ${props.format(ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: { beginAtZero: true, grid: { color: line }, border: { display: false }, ticks: { color: muted, precision: props.integer ? 0 : undefined, callback: (v) => props.format(v) } },
      },
    },
  }
}

onMounted(() => {
  chart = new Chart(canvas.value, config())
})
watch(() => [props.labels, props.values, props.type], () => {
  if (!chart) return
  chart.destroy()
  chart = new Chart(canvas.value, config())
})
onBeforeUnmount(() => {
  if (chart) chart.destroy()
  chart = null
})
</script>

<template>
  <div class="position-relative w-100 trend-chart">
    <canvas ref="canvas" role="img" :aria-label="label"></canvas>
  </div>
</template>

<style scoped>
.trend-chart {
  height: 220px;
}
</style>
