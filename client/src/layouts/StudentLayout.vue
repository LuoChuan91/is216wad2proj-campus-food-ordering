<script setup>
// Student portal shell: the active tab renders in a persistent <KeepAlive> (so the
// Explore Leaflet map survives navigation); <RouterView> renders the full-page
// overlays (store/checkout/track) on top. Inactive students see the pending screen.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import PendingView from '../views/student/PendingView.vue'
import TabBar from '../portals/student/TabBar.vue'
import ItemSheet from '../portals/student/ItemSheet.vue'
import PaySheet from '../portals/student/PaySheet.vue'
import ExploreView from '../views/student/ExploreView.vue'
import StoresView from '../views/student/StoresView.vue'
import OrdersView from '../views/student/OrdersView.vue'
import DeliverView from '../views/student/DeliverView.vue'
import MeView from '../views/student/MeView.vue'

const TABS = { explore: ExploreView, stores: StoresView, orders: OrdersView, deliver: DeliverView, me: MeView }

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { ui: uiState } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const me = computed(() => orders.me())
// A full page (store / checkout / track) covers the tab layer and hides the tab bar.
const onPage = computed(() => u.value.page === 'store' || u.value.page === 'checkout' || u.value.page === 'track')
const tabComponent = computed(() => TABS[u.value.tab] || ExploreView)
</script>

<template>
  <div class="student-shell"><div class="student-frame">
    <div class="app student d-flex flex-column">
    <PendingView v-if="me.status !== 'active'" />
    <template v-else>
      <!-- Persistent tab layer: stays mounted under a page so the map survives. -->
      <div class="tab-layer position-relative flex-grow-1" :class="{ covered: onPage }">
        <KeepAlive><component :is="tabComponent" :key="u.tab" /></KeepAlive>
      </div>
      <!-- Full-page overlays (store / checkout / track) come from the router. -->
      <RouterView v-slot="{ Component }">
        <Transition name="page"><component :is="Component" /></Transition>
      </RouterView>
      <TabBar v-if="!onPage" class="d-md-none" />
      <Transition name="fade"><div v-if="u.sheet === 'item' || u.sheet === 'pay'" class="backdrop" @click="ui.closeSheet()"></div></Transition>
      <Transition name="sheet"><ItemSheet v-if="u.sheet === 'item' && catalog.item(u.itemId)" /></Transition>
      <Transition name="sheet"><PaySheet v-if="u.sheet === 'pay'" /></Transition>
    </template>
    </div>
  </div></div>
</template>
