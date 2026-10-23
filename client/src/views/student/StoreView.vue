<script setup>
// One store's page: open status, wait, discount, and its menu by category.
//
// Migrated from portals/student/StorePage.vue. The store id now comes from the
// route param (:storeId) rather than S.ui.student.storeId — vue-router owns the
// URL. Everything else (open status, the live WaitTimeEstimate, the cart bar) is
// unchanged and reads the Pinia stores directly.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import * as E from '@/utils/engine.js'
import { shortName } from '@/utils/landmarks.js'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'
import StoreHero from '@/components/StoreHero.vue'
import StatusTag from '@/components/StatusTag.vue'
import CartBar from '@/components/CartBar.vue'

const route = useRoute()
const ui = useUiStore()
const catalog = useCatalogStore()
const { ui: uiState } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const storeId = computed(() => route.params.storeId)
const money = E.money
const store = computed(() => catalog.store(storeId.value))
const venue = computed(() => (store.value ? catalog.venue(store.value.venue_id) : null))
const open = computed(() => ui.open(store.value))
const cats = computed(() => {
  const m = new Map()
  for (const it of catalog.menuOf(store.value.id)) { if (!m.has(it.category)) m.set(it.category, []); m.get(it.category).push(it) }
  return [...m.entries()]
})
const cartHere = computed(() => u.value.cart.storeId === store.value.id && u.value.cart.lines.length > 0)
const cartCount = computed(() => u.value.cart.lines.reduce((s, l) => s + l.qty, 0))
const cartTotal = computed(() => u.value.cart.lines.reduce((s, l) => s + l.unit_price * l.qty, 0))
const hasOptions = (it) => (it.option_groups || []).length > 0
</script>

<template>
  <section v-if="store" class="page store-page">
    <StoreHero :store="store" :venue-name="venue ? shortName(venue.name) : ''" @back="ui.back()" />
    <div class="store-info">
      <StatusTag chip dot :tone="open.open ? 'ok' : 'muted'">{{ open.label }}</StatusTag>
      <StatusTag v-if="open.open" chip tone="info"><WaitTimeEstimate :store-id="store.id" /></StatusTag>
      <StatusTag v-if="store.discount_type" chip tone="brand">{{ E.discountLabel(store) }}</StatusTag>
    </div>
    <div class="menu scroll" :class="{ 'with-cart': cartHere }">
      <p v-if="store.description" class="store-desc">{{ store.description }}</p>
      <template v-for="[cat, items] in cats" :key="cat">
        <h4 class="menu-cat">{{ cat }}</h4>
        <button v-for="it in items" :key="it.id" class="menu-item" :class="{ soldout: !it.available }" :disabled="!it.available || !open.open" @click="ui.openItem(it.id)">
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
      <CartBar v-if="cartHere" :count="cartCount" :total="cartTotal" @open="ui.openCheckout()" />
    </Transition>
  </section>
</template>

<style scoped>
/* Store page: open/wait/discount row + menu (moved from the global stylesheet).
   .page/.scroll/.empty-note stay global (shared chrome). */
.store-info {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px 14px 4px;
  flex: none;
}
.store-desc {
  color: var(--ink-2);
  font-size: 13px;
  margin: 8px 2px 0;
}
.menu {
  flex: 1;
  padding: 4px 14px 20px;
}
.menu.with-cart {
  padding-bottom: 84px;
}
.menu-cat {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 14px 2px 8px;
  font-weight: 700;
}
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: 18px;
  padding: 12px 12px 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
  color: inherit;
}
.menu-item:disabled {
  cursor: default;
}
.menu-item.soldout {
  opacity: 0.55;
}
.mi-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mi-text strong {
  font-size: 14.5px;
}
.mi-text small {
  color: var(--muted);
  font-size: 12.5px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mi-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.mi-meta b {
  font-size: 14px;
  margin-right: 2px;
}
.mi-add {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--brand);
  color: #fff;
  display: grid;
  place-items: center;
  flex: none;
  box-shadow: 0 4px 10px rgba(229, 81, 45, 0.35);
}
</style>
