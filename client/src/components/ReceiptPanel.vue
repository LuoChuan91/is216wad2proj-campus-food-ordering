<script setup>
// The receipt panel on the order-tracking page: each line (qty, name, options,
// line total), an optional discount row, the amount paid, and the payment
// reference line (with a "fee waived" note when the delivery fell back to pickup).
import * as E from '@/utils/engine.js'

defineProps({
  lines: { type: Array, default: () => [] },
  discount: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  payment: { type: Object, default: null },
  fallback: { type: Boolean, default: false },
  feeWaived: { type: Number, default: 0 },
})

const money = E.money
</script>

<template>
  <div class="panel receipt">
    <div v-for="l in lines" :key="l.id" class="co-line d-flex align-items-center gap-2">
      <span class="co-qty">{{ l.qty }}×</span>
      <div class="co-what flex-grow-1 overflow-hidden">
        <strong class="d-block">{{ l.name }}</strong>
        <small v-if="l.option_names && l.option_names.length">{{ l.option_names.join(', ') }}</small>
      </div>
      <b>{{ money(l.unit_price * l.qty) }}</b>
    </div>
    <div v-if="discount" class="rc-row disc d-flex justify-content-between"><span>Discount</span><b>−{{ money(discount) }}</b></div>
    <div class="rc-row d-flex justify-content-between"><span>Paid</span><b>{{ money(paid) }}</b></div>
    <small v-if="payment" class="rc-ref d-block mt-1">
      {{ payment.reference }} · {{ payment.method }}<template v-if="fallback"> · {{ money(feeWaived) }} fee waived</template>
    </small>
  </div>
</template>

<style scoped>
.receipt {
  padding: 8px 12px;
}
.rc-row {
  border-top: 1px dashed var(--line);
  padding-top: 8px;
  margin-top: 4px;
}
.rc-row.disc {
  border-top: 0;
  margin-top: 0;
  padding-top: 4px;
  color: var(--ok);
  font-weight: 700;
}
.rc-ref {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
}
</style>
