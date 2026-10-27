<script setup>
// The floating "View cart" bar at the bottom of a store page.
//
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

<style scoped>
/* Floating "View cart" bar (moved from the global prototype stylesheet). */
.cart-bar {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 18px;
  background: var(--ink);
  color: #fff;
  padding: 14px 16px;
  font-weight: 700;
  font-size: var(--fs-subheading);
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(20, 24, 40, 0.3);
}
.cart-count {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--brand);
  display: grid;
  place-items: center;
  font-size: var(--fs-desc);
}
.cart-bar b {
  margin-left: auto;
}
</style>
