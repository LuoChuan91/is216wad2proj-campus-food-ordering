<script setup>
// A store's coloured square with its initials, e.g. "SB" for Sakura Bento House.
// Use: <StoreMono :name="store.name" :size="46" />
import { initials, storeColour } from '../utils/format'

defineProps({
  name: { type: String, default: '' },
  size: { type: Number, default: 44 },
})
</script>

<template>
  <span class="store-square" :style="{ width: size + 'px', height: size + 'px', backgroundColor: storeColour(name) }">{{ initials(name) }}</span>
</template>
