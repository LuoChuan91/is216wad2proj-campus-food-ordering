<script setup>
import { ref, onMounted } from 'vue'
import { config as cfg } from '@/config/index.js'

const show = ref(true)

onMounted(() => {
  // Remove the splash after 1 second
  setTimeout(() => (show.value = false), 1000)
})
</script>

<template>
  <div v-if="show" class="splash-overlay" aria-hidden="true">
    <div class="splash-content">
      <svg viewBox="0 0 120 120" class="splash-logo">
        <rect x="10" y="10" width="100" height="100" rx="26" fill="#e5512d" />
        <path d="M28 58 H92 C92 80 78 92 60 92 C42 92 28 80 28 58 Z" fill="#fff" />
        <path class="splash-steam" d="M46 46 q-6 -7 0 -14 q6 -7 0 -14" />
        <path class="splash-steam splash-steam-2" d="M60 46 q-6 -7 0 -14 q6 -7 0 -14" />
        <path class="splash-steam splash-steam-3" d="M74 46 q-6 -7 0 -14 q6 -7 0 -14" />
      </svg>
      <span class="splash-name">{{ cfg.appName }}</span>
    </div>
  </div>
</template>

<style scoped>
.splash-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: var(--navy);
  animation: splash-out 0.25s ease 0.75s forwards;
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: transparent;
  animation: splash-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.splash-logo {
  width: 200px;
  height: 200px;
  background: transparent;
}

/* Steam rises and fades, looping while the splash is shown */
.splash-steam {
  fill: none;
  stroke: #fff;
  stroke-width: 4;
  stroke-linecap: round;
  animation: splash-rise 0.9s ease-in-out infinite;
}
.splash-steam-2 {
  animation-delay: 0.15s;
}
.splash-steam-3 {
  animation-delay: 0.3s;
}

.splash-name {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 800;
  color: #fff;
  background: transparent;
  animation: splash-fade-up 0.4s ease 0.3s both;
}

@keyframes splash-pop {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: none; }
}
@keyframes splash-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
@keyframes splash-rise {
  0% { opacity: 0; transform: translateY(8px); }
  40% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-10px); }
}
@keyframes splash-out {
  to { opacity: 0; visibility: hidden; }
}

@media (prefers-reduced-motion: reduce) {
  .splash-overlay {
    display: none;
  }
}
</style>