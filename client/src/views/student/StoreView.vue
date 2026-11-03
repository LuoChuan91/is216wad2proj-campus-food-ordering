<script setup>
// One store's page (id from the :storeId route param): open status, wait, discount,
// and its menu by category.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import * as E from '@/utils/engine.js'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'
import StoreHero from '@/components/StoreHero.vue'
import StatusTag from '@/components/StatusTag.vue'
import CartBar from '@/components/CartBar.vue'
import MenuItemCard from '@/components/MenuItemCard.vue'

const route = useRoute()
const ui = useUiStore()
const catalog = useCatalogStore()
const { ui: uiState } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const storeId = computed(() => route.params.storeId)
const store = computed(() => catalog.store(storeId.value))
const venue = computed(() => (store.value ? catalog.venue(store.value.venue_id) : null))
const open = computed(() => ui.open(store.value))
const available = computed(() => catalog.storeAvailable(store.value))
const cats = computed(() => {
  const m = new Map()
  for (const it of catalog.menuOf(store.value.id)) { if (!m.has(it.category)) m.set(it.category, []); m.get(it.category).push(it) }
  return [...m.entries()]
})
const cartHere = computed(() => u.value.cart.storeId === store.value.id && u.value.cart.lines.length > 0)
const cartCount = computed(() => u.value.cart.lines.reduce((s, l) => s + l.qty, 0))
const cartTotal = computed(() => u.value.cart.lines.reduce((s, l) => s + l.unit_price * l.qty, 0))
</script>

<template>
  <section v-if="store" class="page store-page">
    <StoreHero :store="store" :venue-name="E.venueLabel(venue)" @back="ui.back()" />
    <div v-if="!available" class="menu scroll">
      <p class="empty-note">This store is currently unavailable.</p>
    </div>
    <template v-else>
    <div class="store-info">
      <div class="container px-0 d-flex flex-wrap gap-2">
      <StatusTag dot :tone="open.open ? 'ok' : 'muted'">{{ open.label }}</StatusTag>
      <WaitTimeEstimate v-if="open.open" :store-id="store.id" />
      <StatusTag v-if="store.discount_type" tone="brand">{{ E.discountLabel(store) }}</StatusTag>
      </div>
    </div>
    <div class="menu scroll" :class="{ 'with-cart': cartHere }">
      <div class="container px-0">
      <p v-if="store.description" class="store-desc">{{ store.description }}</p>
      <template v-for="[cat, items] in cats" :key="cat">
        <h4 class="menu-cat">{{ cat }}</h4>
        <div class="row g-3">
          <div v-for="it in items" :key="it.id" class="col-12 col-md-6 col-lg-4">
            <MenuItemCard :item="it" :can-add="open.open" @open="ui.openItem" />
          </div>
        </div>
      </template>
      <p v-if="!cats.length" class="empty-note">This store hasn't added its menu yet.</p>
      </div>
    </div>
    <Transition name="rise">
      <CartBar v-if="cartHere" class="col-md-8 col-lg-6 mx-auto" :count="cartCount" :total="cartTotal" @open="ui.openCheckout()" />
    </Transition>
    </template>
  </section>
</template>

<style scoped>
.store-info {
  padding: 12px 14px 4px;
  flex: none;
}
.store-desc {
  color: var(--ink-2);
  font-size: var(--fs-desc);
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
  font-size: var(--fs-desc);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 14px 2px 8px;
  font-weight: 700;
}
</style>
