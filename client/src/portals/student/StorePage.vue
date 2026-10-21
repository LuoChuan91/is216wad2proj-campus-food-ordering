<script setup>
// One store's page: open status, wait, discount, and its menu by category
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'
import { shortName } from '../../app/landmarks'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'

const u = computed(() => S.ui.student)
const money = E.money
const store = computed(() => Q.store(u.value.storeId))
const venue = computed(() => Q.venue(store.value.venue_id))
const open = computed(() => Q.open(store.value))
const wait = computed(() => Q.storeWait(store.value.id))
const cats = computed(() => {
  const m = new Map()
  for (const it of Q.menu(store.value.id)) { if (!m.has(it.category)) m.set(it.category, []); m.get(it.category).push(it) }
  return [...m.entries()]
})
const cartHere = computed(() => u.value.cart.storeId === store.value.id && u.value.cart.lines.length > 0)
const cartCount = computed(() => u.value.cart.lines.reduce((s, l) => s + l.qty, 0))
const cartTotal = computed(() => u.value.cart.lines.reduce((s, l) => s + l.unit_price * l.qty, 0))
const hasOptions = (it) => (it.option_groups || []).length > 0
</script>

<template>
  <section class="page store-page">
    <div class="store-hero" :style="{ '--tint': store.color }">
      <button class="icon-btn glass" aria-label="Back" @click="A.back()"><Icon name="back" :size="20" /></button>
      <div class="hero-row"><Mono :store="store" :size="56" ring /><div><h2>{{ store.name }}</h2><p>{{ venue ? shortName(venue.name) : '' }} · {{ store.unit_no }}</p></div></div>
    </div>
    <div class="store-info">
      <span class="chip" :class="open.open ? 'ok' : 'muted'"><i class="dot"></i>{{ open.label }}</span>
      <span v-if="open.open" class="chip info"><WaitTimeEstimate :store-id="store.id" /></span>
      <span v-if="store.discount_type" class="chip brand">{{ E.discountLabel(store) }}</span>
    </div>
    <div class="menu scroll" :class="{ 'with-cart': cartHere }">
      <p v-if="store.description" class="store-desc">{{ store.description }}</p>
      <template v-for="[cat, items] in cats" :key="cat">
        <h4 class="menu-cat">{{ cat }}</h4>
        <button v-for="it in items" :key="it.id" class="menu-item" :class="{ soldout: !it.available }" :disabled="!it.available || !open.open" @click="A.openItem(it.id)">
          <span class="mi-text">
            <strong>{{ it.name }}</strong>
            <small v-if="it.description">{{ it.description }}</small>
            <span class="mi-meta"><b>{{ money(it.price) }}</b><span v-if="hasOptions(it)" class="tag">Customisable</span><span v-if="!it.available" class="tag muted">Sold out</span></span>
          </span>
          <span v-if="it.available && open.open" class="mi-add"><Icon name="plus" :size="18" :stroke="2.4" /></span>
        </button>
      </template>
      <p v-if="!cats.length" class="empty-note">This store hasn't added its menu yet.</p>
    </div>
    <Transition name="rise">
      <button v-if="cartHere" class="cart-bar" @click="A.openCheckout()">
        <span class="cart-count">{{ cartCount }}</span><span>View cart</span><b>{{ money(cartTotal) }}</b>
      </button>
    </Transition>
  </section>
</template>
