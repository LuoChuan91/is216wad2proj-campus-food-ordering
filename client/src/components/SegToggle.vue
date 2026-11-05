<script setup>
// The pickup / peer-delivery choice on checkout.
//
// Extracted from views/student/CheckoutView.vue. It takes the current fulfilment
// type and the formatted delivery-fee string, and emits 'change' with the chosen
// type when an option is picked.
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
  <div class="row g-2" role="radiogroup" aria-label="Pickup or delivery">
    <div class="col-6">
      <input id="fulfil-pickup" type="radio" class="btn-check" name="fulfilment" value="pickup"
        :checked="modelValue === 'pickup'" @change="$emit('change', 'pickup')">
      <label class="seg-opt btn w-100 h-100 d-flex align-items-center gap-2 text-start rounded-4 p-3" for="fulfil-pickup">
        <Icon name="bag" :size="18" /><span class="d-flex flex-column lh-sm">Self pickup<small>Free</small></span>
      </label>
    </div>
    <div class="col-6">
      <input id="fulfil-delivery" type="radio" class="btn-check" name="fulfilment" value="delivery"
        :checked="modelValue === 'delivery'" @change="$emit('change', 'delivery')">
      <label class="seg-opt btn w-100 h-100 d-flex align-items-center gap-2 text-start rounded-4 p-3" for="fulfil-delivery">
        <Icon name="bike" :size="18" /><span class="d-flex flex-column lh-sm">Peer delivery<small>{{ deliveryFee }}</small></span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.seg-opt {
  --bs-btn-color: var(--ink);
  --bs-btn-bg: var(--paper);
  --bs-btn-border-color: var(--line);
  --bs-btn-border-width: 1.5px;
  --bs-btn-hover-color: var(--ink);
  --bs-btn-hover-bg: var(--paper);
  --bs-btn-hover-border-color: #cfd4e0;
  --bs-btn-active-color: var(--brand-600);
  --bs-btn-active-bg: var(--brand-soft);
  --bs-btn-active-border-color: var(--brand);
}
.seg-opt small {
  color: var(--muted);
  font-weight: 600;
  font-size: var(--fs-caption);
}
</style>
