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
const est = computed(() => u.value.estimate)
const drops = computed(() => {
  const me = ui.place()
  return catalog.db.destinations.map((d) => ({ d, m: Math.round(E.distanceM(me, d)) })).sort((a, b) => a.m - b.m).slice(0, 3)
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
