<script setup>
import { computed } from 'vue'

const props = defineProps({
  tone: { type: String, default: '' },
  dot: { type: Boolean, default: false },
})

const TONES = { ok: 'success', warn: 'warning', late: 'danger', info: 'info', brand: 'primary', muted: 'secondary' }
const toneClass = computed(() => {
  const c = TONES[props.tone]
  return c ? `bg-${c}-subtle text-${c}-emphasis` : 'bg-body-tertiary text-body'
})
</script>

<template>
  <span class="badge rounded-pill d-inline-flex align-items-center gap-1" :class="toneClass"><i v-if="dot" class="dot d-inline-block rounded-circle"></i><slot /></span>
</template>

<style scoped>
.dot {
  width: 7px;
  height: 7px;
  background: currentColor;
}
</style>
