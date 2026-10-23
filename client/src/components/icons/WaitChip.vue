<script setup>
// "~6 min": green up to 5 min, amber up to 10, red after that
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({ minutes: Number, prefix: String })
const tone = computed(() => (props.minutes <= 5 ? 'ok' : props.minutes <= 10 ? 'warn' : 'late'))
</script>

<template>
  <span class="chip wait" :class="tone"><Icon name="clock" :size="12" />{{ prefix ? prefix + ' ' : '' }}~{{ minutes }} min</span>
</template>
