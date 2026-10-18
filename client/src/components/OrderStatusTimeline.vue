<script setup>
// Animated status timeline:  preparing -> ready -> picked up
//   mode 'pickup'   : self-collection, stops at 'ready' (no picked-up step)
//   mode 'delivery' : shows the picked-up step too
// The `status` prop marks which step is current; completed steps are filled,
// the current step pulses, future steps are muted.
import { computed } from 'vue'

const props = defineProps({
  // current order/delivery status
  status: { type: String, default: 'preparing' },
  // 'pickup' | 'delivery'
  mode: { type: String, default: 'pickup' },
})

const ALL_STEPS = [
  { key: 'preparing', label: 'Preparing', icon: 'bi-fire' },
  { key: 'ready', label: 'Ready', icon: 'bi-bag-check' },
  { key: 'picked_up', label: 'Picked up', icon: 'bi-bicycle' },
]

const steps = computed(() =>
  props.mode === 'delivery' ? ALL_STEPS : ALL_STEPS.filter((s) => s.key !== 'picked_up')
)

// Map a status to the index in the (mode-filtered) step list.
const currentIndex = computed(() => {
  const i = steps.value.findIndex((s) => s.key === props.status)
  // 'completed'/'delivered' etc. => treat as past the last step.
  if (i === -1) {
    if (['completed', 'delivered'].includes(props.status)) return steps.value.length
    return 0
  }
  return i
})

function stateOf(index) {
  if (index < currentIndex.value) return 'done'
  if (index === currentIndex.value) return 'current'
  return 'upcoming'
}
</script>

<template>
  <ol class="status-timeline list-unstyled d-flex align-items-start m-0" data-test="timeline">
    <li
      v-for="(step, i) in steps"
      :key="step.key"
      class="status-step text-center flex-fill"
      :class="`is-${stateOf(i)}`"
      :data-test="`step-${step.key}`"
      :data-state="stateOf(i)"
    >
      <div class="status-step__dot mx-auto d-flex align-items-center justify-content-center">
        <i class="bi" :class="step.icon" aria-hidden="true"></i>
      </div>
      <div class="status-step__label small mt-2">{{ step.label }}</div>
    </li>
  </ol>
</template>

<style scoped>
.status-timeline {
  gap: 0.25rem;
}
.status-step__dot {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: 2px solid var(--bs-secondary-bg, #dee2e6);
  background: var(--bs-body-bg, #fff);
  color: var(--bs-secondary-color, #6c757d);
  transition: all 0.3s ease;
}
/* connector line between steps */
.status-step {
  position: relative;
}
.status-step + .status-step::before {
  content: '';
  position: absolute;
  top: 1.25rem;
  left: -50%;
  width: 100%;
  height: 2px;
  background: var(--bs-secondary-bg, #dee2e6);
  z-index: 0;
}
.status-step__dot {
  position: relative;
  z-index: 1;
}

/* done: filled success */
.is-done .status-step__dot {
  background: var(--bs-success, #198754);
  border-color: var(--bs-success, #198754);
  color: #fff;
}
.is-done + .status-step::before {
  background: var(--bs-success, #198754);
}

/* current: pulsing primary */
.is-current .status-step__dot {
  background: var(--bs-primary, #0d6efd);
  border-color: var(--bs-primary, #0d6efd);
  color: #fff;
  animation: pulse 1.4s ease-in-out infinite;
}
.is-current .status-step__label {
  font-weight: 600;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.5);
  }
  70% {
    box-shadow: 0 0 0 0.6rem rgba(13, 110, 253, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(13, 110, 253, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-current .status-step__dot {
    animation: none;
  }
}
</style>
