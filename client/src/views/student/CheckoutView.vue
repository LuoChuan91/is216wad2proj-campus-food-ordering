<script setup>
// Checkout: the cart, pickup or peer delivery, the ready time and the price.
//
// Migrated from portals/student/CheckoutPage.vue. The cart's store comes from the
// cart itself (S.ui.student.cart.storeId), which the server-priced order needs; the
// route for this page carries no param. Behaviour unchanged.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { shortName } from '@/utils/landmarks.js'
import { useCartEstimate } from '@/composables/useCartEstimate.js'
import SegToggle from '@/components/SegToggle.vue'
import DropoffPicker from '@/components/DropoffPicker.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const { ui: uiState, now } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const money = E.money
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const store = computed(() => catalog.store(u.value.cart.storeId))
const venue = computed(() => catalog.venue(store.value.venue_id))
const lines = computed(() => u.value.cart.lines.map((l) => ({ ...l, item: catalog.item(l.menu_item_id), snap: E.snapshot(catalog.groups(l.menu_item_id), catalog.options(l.menu_item_id), l.selected) })))
const t = computed(() => E.totals(u.value.cart.lines, store.value, u.value.checkout.type, cfg.deliveryFee))

// Ready-time estimate computed entirely on the frontend (D1): the fresh-order
// probe schedules this cart behind the store's live queue (store:<id> realtime).
// readyAt is derived here as now + seconds.
const { estimate: est } = useCartEstimate(
  computed(() => u.value.cart.storeId),
  computed(() => u.value.cart.lines),
)
const drops = computed(() => {
  const me = ui.place()
  return catalog.db.destinations.map((d) => ({ d, m: Math.round(E.distanceM(me, d)) })).sort((a, b) => a.m - b.m)
})
</script>

<template>
  <section v-if="store" class="page checkout">
    <div class="bar"><button class="icon-btn" aria-label="Back" @click="ui.back()"><Icon name="back" :size="20" /></button><h3>Checkout</h3></div>
    <div class="scroll checkout-body">
      <div class="panel co-store"><Mono :store="store" :size="38" /><div><strong>{{ store.name }}</strong><small>{{ venue ? shortName(venue.name) : '' }} · {{ store.unit_no }}</small></div></div>
      <div class="panel co-lines">
        <div v-for="l in lines" :key="l.key" class="co-line">
          <div class="qty mini"><button class="icon-btn" aria-label="One fewer" @click="ui.setLineQty(l.key, l.qty - 1)"><Icon name="minus" :size="13" /></button><b>{{ l.qty }}</b><button class="icon-btn" aria-label="One more" @click="ui.setLineQty(l.key, l.qty + 1)"><Icon name="plus" :size="13" /></button></div>
          <div class="co-what"><strong>{{ l.item ? l.item.name : 'Item' }}</strong><small v-if="l.snap.length">{{ l.snap.map((s) => s.name).join(', ') }}</small></div>
          <b>{{ money(l.unit_price * l.qty) }}</b>
        </div>
      </div>
      <SegToggle :model-value="u.checkout.type" :delivery-fee="money(cfg.deliveryFee)" @change="ui.setFulfilment" />
      <DropoffPicker
        v-if="u.checkout.type === 'delivery'"
        :drops="drops"
        :selected="u.checkout.dropoffId"
        :note="u.checkout.note"
        :window-min="cfg.deliveryWindowMin"
        @pick="ui.setDropoff"
        @note="ui.setNote"
      />
      <div v-if="est" class="panel co-est"><span class="co-est-ic"><Icon name="clock" :size="18" /></span><div><strong>Ready around {{ E.clock(est.readyAt) }}</strong><small>{{ plural(est.ahead, 'order', 'orders') }} ahead · about {{ E.minsUntil(now, est.readyAt) }} min</small></div></div>
      <div class="panel co-sum">
        <div><span>Subtotal</span><span>{{ money(t.subtotal) }}</span></div>
        <div v-if="t.discount" class="disc"><span>{{ store.discount_type === 'percentage' ? `Student discount (${Number(store.discount_per)}%)` : 'Store discount' }}</span><span>−{{ money(t.discount) }}</span></div>
        <div v-if="u.checkout.type === 'delivery'"><span>Delivery fee</span><span>{{ money(t.delivery_fee) }}</span></div>
        <div class="total"><span>Total</span><span>{{ money(t.total) }}</span></div>
      </div>
    </div>
    <div class="pay-bar"><button class="btn btn-primary btn-lg w-100" @click="ui.openPay()">Pay {{ money(t.total) }}</button></div>
  </section>
</template>

<style scoped>
/* Checkout page (moved from the global stylesheet). Shared bits kept global:
   .page/.bar, .co-line/.co-qty/.co-what (also used by the receipt), the .seg and
   drop-off styles (now in SegToggle/DropoffPicker). */
.checkout-body {
  flex: 1;
  padding: 12px 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.co-store {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
}
.co-store small {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.co-lines {
  padding: 6px 12px;
}
.co-est {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
}
.co-est-ic {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--info-soft);
  color: var(--info);
  display: grid;
  place-items: center;
  flex: none;
}
.co-est strong {
  display: block;
}
.co-est small {
  color: var(--muted);
  font-size: 12.5px;
}
.co-sum {
  padding: 10px 14px;
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
}
.co-sum > div {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}
.co-sum .disc {
  color: var(--ok);
  font-weight: 700;
}
.co-sum .total {
  border-top: 1px dashed var(--line);
  margin-top: 4px;
  padding-top: 8px;
  font-size: 16px;
  font-weight: 800;
}
.pay-bar {
  flex: none;
  padding: 10px 14px 14px;
  background: var(--paper);
  border-top: 1px solid var(--line);
}
</style>
