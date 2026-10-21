<script setup>
// Simulated payment. The server checks the order again, works out the price and saves it.
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'
import { config as cfg } from '../../app/config'

const u = computed(() => S.ui.student)
const money = E.money
const result = computed(() => u.value.pay.result)
const store = computed(() => Q.store((result.value && result.value.store_id) || u.value.cart.storeId))
const t = computed(() => (u.value.cart.lines.length && store.value ? E.totals(u.value.cart.lines, store.value, u.value.checkout.type, cfg.deliveryFee) : null))
const code = computed(() => (result.value ? String(result.value.id).slice(0, 4).toUpperCase() : ''))
</script>

<template>
  <div class="sheet pay-sheet" role="dialog" aria-label="Payment">
    <div class="grab"></div>
    <template v-if="u.pay.state !== 'done'">
      <div class="sheet-head"><div><h3>Payment</h3><p>Simulated for now. No real money moves; we only save a payment record.</p></div>
        <button class="icon-btn" aria-label="Close" :disabled="u.pay.state === 'processing'" @click="A.closeSheet()"><Icon name="close" :size="18" /></button></div>
      <div class="pay-amount"><small>You pay {{ store ? store.name : '' }}</small><b>{{ money(t ? t.total : 0) }}</b></div>
      <div class="pay-method"><span class="pm-ic"><Icon name="wallet" :size="20" /></span><div><strong>Campus wallet</strong><small>Sample payment method</small></div><span class="tag">Simulated</span></div>
      <p v-if="u.pay.state === 'error'" class="pay-error" role="alert">{{ u.pay.error }}</p>
      <div class="sheet-foot">
        <button class="btn btn-primary btn-lg w-100" :disabled="u.pay.state === 'processing'" @click="A.confirmPay()">
          <span v-if="u.pay.state === 'processing'" class="spinner-border spinner-border-sm me-2" role="status"></span>{{ u.pay.state === 'processing' ? 'Processing payment' : u.pay.state === 'error' ? 'Try again' : 'Confirm payment' }}
        </button>
      </div>
    </template>
    <div v-else class="pay-done">
      <div class="done-check"><Icon name="check" :size="38" :stroke="3" /></div>
      <h3>Payment successful</h3>
      <p>{{ money(result.payment.amount) }} paid to {{ store.name }}</p>
      <dl class="ref"><div><dt>Order</dt><dd>#{{ code }}</dd></div><div><dt>Reference</dt><dd>{{ result.payment.reference }}</dd></div></dl>
      <button class="btn btn-primary btn-lg w-100" @click="A.openTracking(result.id)">Track my order</button>
    </div>
  </div>
</template>
