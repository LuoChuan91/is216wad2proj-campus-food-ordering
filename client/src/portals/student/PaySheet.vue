<script setup>
// Simulated payment. The server checks the order again, works out the price and saves it.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'

const ui = useUiStore()
const catalog = useCatalogStore()
const { ui: uiState } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const money = E.money
const result = computed(() => u.value.pay.result)
const store = computed(() => catalog.store((result.value && result.value.store_id) || u.value.cart.storeId))
const t = computed(() => (u.value.cart.lines.length && store.value ? E.totals(u.value.cart.lines, store.value, u.value.checkout.type, cfg.deliveryFee) : null))
const code = computed(() => (result.value ? String(result.value.id).slice(0, 4).toUpperCase() : ''))
</script>

<template>
  <div class="sheet pay-sheet col-md-8 col-lg-6 mx-auto" role="dialog" aria-label="Payment">
    <div class="grab"></div>
    <template v-if="u.pay.state !== 'done'">
      <div class="sheet-head d-flex justify-content-between align-items-start gap-2"><div><h3>Payment</h3><p>Simulated for now. No real money moves; we only save a payment record.</p></div>
        <button class="icon-btn" aria-label="Close" :disabled="u.pay.state === 'processing'" @click="ui.closeSheet()"><Icon name="close" :size="18" /></button></div>
      <div class="pay-amount text-center"><small>You pay {{ store ? store.name : '' }}</small><b class="d-block">{{ money(t ? t.total : 0) }}</b></div>
      <div class="pay-method d-flex align-items-center gap-3"><span class="pm-ic d-flex align-items-center justify-content-center flex-shrink-0"><Icon name="wallet" :size="20" /></span><div><strong class="d-block">Campus wallet</strong><small>Sample payment method</small></div><span class="tag ms-auto">Simulated</span></div>
      <p v-if="u.pay.state === 'error'" class="pay-error" role="alert">{{ u.pay.error }}</p>
      <div class="sheet-foot d-flex align-items-center gap-3">
        <button class="btn btn-primary btn-lg w-100" :disabled="u.pay.state === 'processing'" @click="ui.confirmPay()">
          <span v-if="u.pay.state === 'processing'" class="spinner-border spinner-border-sm me-2" role="status"></span>{{ u.pay.state === 'processing' ? 'Processing payment' : u.pay.state === 'error' ? 'Try again' : 'Confirm payment' }}
        </button>
      </div>
    </template>
    <div v-else class="pay-done text-center">
      <div class="done-check d-flex align-items-center justify-content-center rounded-circle"><Icon name="check" :size="38" :stroke="3" /></div>
      <h3>Payment successful</h3>
      <p>{{ money(result.payment.amount) }} paid to {{ store.name }}</p>
      <dl class="ref d-grid gap-1 text-start"><div class="d-flex justify-content-between"><dt>Order</dt><dd>#{{ code }}</dd></div><div class="d-flex justify-content-between"><dt>Reference</dt><dd>{{ result.payment.reference }}</dd></div></dl>
      <button class="btn btn-primary btn-lg w-100" @click="ui.openTracking(result.id)">Track my order</button>
    </div>
  </div>
</template>

<style scoped>
/* Payment sheet (moved from the global stylesheet). The .sheet shell + .grab stay
   global (shared with the item sheet). */
.pay-amount {
  margin: 4px 18px 12px;
  background: var(--canvas);
  border-radius: 18px;
  padding: 16px;
}
.pay-amount small {
  color: var(--muted);
  font-weight: 600;
}
.pay-amount b {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.pay-method {
  margin: 0 18px 14px;
  border: 1.5px solid var(--brand);
  border-radius: 16px;
  padding: 12px;
}
.pay-method small {
  color: var(--muted);
}
.pm-ic {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--brand-soft);
  color: var(--brand);
}
.pay-error {
  margin: 0 18px 12px;
  padding: 9px 12px;
  border-radius: 12px;
  background: var(--late-soft);
  color: var(--late);
  font-size: 13px;
  font-weight: 600;
}
.pay-done {
  padding: 10px 22px 20px;
}
.done-check {
  width: 76px;
  height: 76px;
  background: var(--ok);
  color: #fff;
  margin: 6px auto 12px;
  animation: pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.4);
  box-shadow: 0 0 0 10px var(--ok-soft);
}
@keyframes pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
.pay-done h3 {
  font-size: 21px;
  font-weight: 800;
  margin: 0 0 4px;
}
.pay-done p {
  color: var(--ink-2);
  margin: 0 0 14px;
}
.ref {
  margin: 0 0 16px;
  background: var(--canvas);
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 13px;
}
.ref dt {
  color: var(--muted);
  font-weight: 600;
}
.ref dd {
  margin: 0;
  font-family: var(--font-mono);
  font-weight: 600;
}
</style>
