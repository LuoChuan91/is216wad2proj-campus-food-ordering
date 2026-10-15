<script setup>
// A store's coloured square with its initials
defineProps({ store: Object, size: { type: Number, default: 40 }, ring: Boolean })
</script>

<template>
  <span class="mono" :class="{ ring }" :style="{ width: size + 'px', height: size + 'px', background: store.color, fontSize: Math.round(size * 0.36) + 'px' }">{{ store.mono }}</span>
</template>
