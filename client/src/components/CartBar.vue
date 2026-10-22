<script setup>
// The floating "View cart" bar at the bottom of a store page.
//
// Extracted from views/student/StoreView.vue. It only renders when there are items
// (the caller keeps the <Transition name="rise"> around it, unchanged). Emits
// 'open' when tapped.
import * as E from '@/utils/engine.js'

defineProps({
  count: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
})
defineEmits(['open'])

const money = E.money
</script>

<template>
  <button class="cart-bar" @click="$emit('open')">
    <span class="cart-count">{{ count }}</span><span>View cart</span><b>{{ money(total) }}</b>
  </button>
</template>
