<script setup>
// One store's page: open status, wait, discount, and its menu by category.
//
// Migrated from portals/student/StorePage.vue. The store id now comes from the
// route param (:storeId) rather than S.ui.student.storeId — vue-router owns the
// URL. Everything else (open status, the live WaitTimeEstimate, the cart bar) is
// unchanged and still uses the S/Q/A shim where convenient.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { S, Q, A } from '@/stores/compat.js'
import * as E from '@/utils/engine.js'
import { shortName } from '@/utils/landmarks.js'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'
import StoreHero from '@/components/StoreHero.vue'
import StatusTag from '@/components/StatusTag.vue'
import CartBar from '@/components/CartBar.vue'

const route = useRoute()
const u = computed(() => S.ui.student)
const storeId = computed(() => route.params.storeId)
const money = E.money
const store = computed(() => Q.store(storeId.value))
const venue = computed(() => (store.value ? Q.venue(store.value.venue_id) : null))
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
  <section v-if="store" class="page store-page">
    <StoreHero :store="store" :venue-name="venue ? shortName(venue.name) : ''" @back="A.back()" />
    <div class="store-info">
      <StatusTag chip dot :tone="open.open ? 'ok' : 'muted'">{{ open.label }}</StatusTag>
      <StatusTag v-if="open.open" chip tone="info"><WaitTimeEstimate :store-id="store.id" /></StatusTag>
      <StatusTag v-if="store.discount_type" chip tone="brand">{{ E.discountLabel(store) }}</StatusTag>
    </div>
    <div class="menu scroll" :class="{ 'with-cart': cartHere }">
      <p v-if="store.description" class="store-desc">{{ store.description }}</p>
      <template v-for="[cat, items] in cats" :key="cat">
        <h4 class="menu-cat">{{ cat }}</h4>
        <button v-for="it in items" :key="it.id" class="menu-item" :class="{ soldout: !it.available }" :disabled="!it.available || !open.open" @click="A.openItem(it.id)">
          <span class="mi-text">
            <strong>{{ it.name }}</strong>
            <small v-if="it.description">{{ it.description }}</small>
            <span class="mi-meta"><b>{{ money(it.price) }}</b><StatusTag v-if="hasOptions(it)">Customisable</StatusTag><StatusTag v-if="!it.available" tone="muted">Sold out</StatusTag></span>
          </span>
          <span v-if="it.available && open.open" class="mi-add"><Icon name="plus" :size="18" :stroke="2.4" /></span>
        </button>
      </template>
      <p v-if="!cats.length" class="empty-note">This store hasn't added its menu yet.</p>
    </div>
    <Transition name="rise">
      <CartBar v-if="cartHere" :count="cartCount" :total="cartTotal" @open="A.openCheckout()" />
    </Transition>
  </section>
</template>
