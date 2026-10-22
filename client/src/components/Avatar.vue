<script setup>
// A round avatar with someone's initials
import { computed } from 'vue'

const props = defineProps({
  name: String, size: { type: Number, default: 36 },
  tone: { type: String, default: 'navy' }
})

// display initial as avatar
const initials = computed(() => 
  (props.name || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase())
</script>

<template>
  <span class="avatar" :class="'av-' + tone"
    :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.38) + 'px' }">{{ initials }}</span>
</template>
