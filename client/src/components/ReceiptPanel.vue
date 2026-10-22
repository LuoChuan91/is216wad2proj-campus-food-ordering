<script setup>
// The receipt panel on the order-tracking page: each line (qty, name, options,
// line total), an optional discount row, the amount paid, and the payment
// reference line (with a "fee waived" note when the delivery fell back to pickup).
//
// Extracted from views/student/TrackView.vue. Each line is { qty, name,
// option_names, unit_price }. `discount`, `paid` and `feeWaived` are numbers;
// `fallback` toggles the fee-waived note; `payment` is { reference, method } or
// null. Values are formatted here with engine.money, exactly as before.
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
    <div v-for="l in lines" :key="l.id" class="co-line">
      <span class="co-qty">{{ l.qty }}×</span>
      <div class="co-what">
        <strong>{{ l.name }}</strong>
        <small v-if="l.option_names && l.option_names.length">{{ l.option_names.join(', ') }}</small>
      </div>
      <b>{{ money(l.unit_price * l.qty) }}</b>
    </div>
    <div v-if="discount" class="rc-row disc"><span>Discount</span><b>−{{ money(discount) }}</b></div>
    <div class="rc-row"><span>Paid</span><b>{{ money(paid) }}</b></div>
    <small v-if="payment" class="rc-ref">
      {{ payment.reference }} · {{ payment.method }}<template v-if="fallback"> · {{ money(feeWaived) }} fee waived</template>
    </small>
  </div>
</template>
