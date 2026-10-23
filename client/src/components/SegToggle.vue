<script setup>
// The pickup / peer-delivery segmented radio control on checkout.
//
// Extracted from views/student/CheckoutView.vue. It takes the current fulfilment
// type and the formatted delivery-fee string, and emits 'change' with the chosen
// type when a segment is clicked. Markup, ARIA roles and icons are unchanged, so it
// renders and behaves identically to the inline version.
import Icon from '@/components/icons/Icon.vue'

defineProps({
  // 'pickup' | 'delivery'
  modelValue: { type: String, default: 'pickup' },
  // Already-formatted delivery fee (e.g. "$1.50").
  deliveryFee: { type: String, default: '' },
})
defineEmits(['change'])
</script>

<template>
  <div class="seg" role="radiogroup" aria-label="Pickup or delivery">
    <button
      role="radio"
      :aria-checked="modelValue === 'pickup'"
      :class="{ on: modelValue === 'pickup' }"
      @click="$emit('change', 'pickup')"
    >
      <Icon name="bag" :size="18" /><span>Self pickup<small>Free</small></span>
    </button>
    <button
      role="radio"
      :aria-checked="modelValue === 'delivery'"
      :class="{ on: modelValue === 'delivery' }"
      @click="$emit('change', 'delivery')"
    >
      <Icon name="bike" :size="18" /><span>Peer delivery<small>{{ deliveryFee }}</small></span>
    </button>
  </div>
</template>

<style scoped>
/* Pickup / delivery segmented control (moved from the global stylesheet). */
.seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.seg button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  border: 1.5px solid var(--line);
  background: var(--paper);
  text-align: left;
  font-weight: 700;
  color: var(--ink);
  cursor: pointer;
}
.seg button span {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.seg button small {
  color: var(--muted);
  font-weight: 600;
  font-size: 12px;
}
.seg button.on {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand-600);
}
</style>
