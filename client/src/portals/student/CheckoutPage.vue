<script setup>
// Checkout: the cart, pickup or peer delivery, the ready time and the price
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'
import { config as cfg } from '../../app/config'
import { shortName } from '../../app/landmarks'

const u = computed(() => S.ui.student)
const money = E.money
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const store = computed(() => Q.store(u.value.cart.storeId))
const venue = computed(() => Q.venue(store.value.venue_id))
const lines = computed(() => u.value.cart.lines.map((l) => ({ ...l, item: Q.item(l.menu_item_id), snap: E.snapshot(Q.groups(l.menu_item_id), Q.options(l.menu_item_id), l.selected) })))
const t = computed(() => E.totals(u.value.cart.lines, store.value, u.value.checkout.type, cfg.deliveryFee))
const est = computed(() => u.value.estimate)
const drops = computed(() => {
  const me = Q.place()
  return S.db.destinations.map((d) => ({ d, m: Math.round(E.distanceM(me, d)) })).sort((a, b) => a.m - b.m).slice(0, 3)
})
</script>

<template>
  <section v-if="store" class="page checkout">
    <div class="bar"><button class="icon-btn" aria-label="Back" @click="A.back()"><Icon name="back" :size="20" /></button><h3>Checkout</h3></div>
    <div class="scroll checkout-body">
      <div class="panel co-store"><Mono :store="store" :size="38" /><div><strong>{{ store.name }}</strong><small>{{ venue ? shortName(venue.name) : '' }} · {{ store.unit_no }}</small></div></div>
      <div class="panel co-lines">
        <div v-for="l in lines" :key="l.key" class="co-line">
          <div class="qty mini"><button class="icon-btn" aria-label="One fewer" @click="A.setLineQty(l.key, l.qty - 1)"><Icon name="minus" :size="13" /></button><b>{{ l.qty }}</b><button class="icon-btn" aria-label="One more" @click="A.setLineQty(l.key, l.qty + 1)"><Icon name="plus" :size="13" /></button></div>
          <div class="co-what"><strong>{{ l.item ? l.item.name : 'Item' }}</strong><small v-if="l.snap.length">{{ l.snap.map((s) => s.name).join(', ') }}</small></div>
          <b>{{ money(l.unit_price * l.qty) }}</b>
        </div>
      </div>
      <div class="seg" role="radiogroup" aria-label="Pickup or delivery">
        <button role="radio" :aria-checked="u.checkout.type === 'pickup'" :class="{ on: u.checkout.type === 'pickup' }" @click="A.setFulfilment('pickup')"><Icon name="bag" :size="18" /><span>Self pickup<small>Free</small></span></button>
        <button role="radio" :aria-checked="u.checkout.type === 'delivery'" :class="{ on: u.checkout.type === 'delivery' }" @click="A.setFulfilment('delivery')"><Icon name="bike" :size="18" /><span>Peer delivery<small>{{ money(cfg.deliveryFee) }}</small></span></button>
      </div>
      <div v-if="u.checkout.type === 'delivery'" class="panel co-drop">
        <strong class="co-label">Deliver to</strong>
        <label v-for="x in drops" :key="x.d.id" class="drop" :class="{ on: u.checkout.dropoffId === x.d.id }">
          <input type="radio" class="form-check-input" name="dropoff" :checked="u.checkout.dropoffId === x.d.id" @change="A.setDropoff(x.d.id)">
          <span>{{ x.d.name }}</span><small>{{ x.m }} m away</small>
        </label>
        <input class="form-control form-control-sm co-note" maxlength="80" placeholder="Note for the courier (optional)" :value="u.checkout.note" @input="A.setNote($event.target.value)">
        <p class="hint">A student courier brings it to you. If nobody accepts within {{ cfg.deliveryWindowMin }} min, it switches to pickup and the fee is waived.</p>
      </div>
      <div v-if="est" class="panel co-est"><span class="co-est-ic"><Icon name="clock" :size="18" /></span><div><strong>Ready around {{ E.clock(est.readyAt) }}</strong><small>{{ plural(est.ahead, 'order', 'orders') }} ahead · about {{ E.minsUntil(S.now, est.readyAt) }} min</small></div></div>
      <div class="panel co-sum">
        <div><span>Subtotal</span><span>{{ money(t.subtotal) }}</span></div>
        <div v-if="t.discount" class="disc"><span>{{ store.discount_type === 'percentage' ? `Student discount (${Number(store.discount_per)}%)` : 'Store discount' }}</span><span>−{{ money(t.discount) }}</span></div>
        <div v-if="u.checkout.type === 'delivery'"><span>Delivery fee</span><span>{{ money(t.delivery_fee) }}</span></div>
        <div class="total"><span>Total</span><span>{{ money(t.total) }}</span></div>
      </div>
    </div>
    <div class="pay-bar"><button class="btn btn-primary btn-lg w-100" @click="A.openPay()">Pay {{ money(t.total) }}</button></div>
  </section>
</template>
