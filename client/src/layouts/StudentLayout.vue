<script setup>
// Student portal shell. vue-router owns the URL and the guard; this layout renders
// the same DOM the prototype did, so behaviour is byte-identical.
//
// Why the tab screens are NOT rendered straight from <RouterView>: the prototype
// kept the tab layer MOUNTED underneath a full page (the Leaflet map on Explore
// must survive opening a store and coming back). A single <RouterView> would
// unmount the tab when a page route is active. So:
//   * the active tab renders in a persistent <KeepAlive> layer, driven by the
//     ui-store tab (which the router keeps in sync with the URL);
//   * <RouterView> renders ONLY the full-page overlays (store / checkout / track),
//     sliding in over the tab layer exactly as before. On a tab route it renders
//     an invisible placeholder, so the tab layer alone shows.
// The item/pay/venue sheets stay UI-store overlays (not routes).
//
// Students whose account isn't active see the pending screen (the guard sends them
// here and this component renders it).
import { computed } from 'vue'
import { S, Q, A } from '@/stores/compat.js'
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

const u = computed(() => S.ui.student)
const me = computed(() => Q.me())
// A full page (store / checkout / track) covers the tab layer and hides the tab bar.
const onPage = computed(() => u.value.page === 'store' || u.value.page === 'checkout' || u.value.page === 'track')
const tabComponent = computed(() => TABS[u.value.tab] || ExploreView)
</script>

<template>
  <div class="student-shell"><div class="student-frame">
    <div class="app student">
    <PendingView v-if="me.status !== 'active'" />
    <template v-else>
      <!-- Persistent tab layer: stays mounted under a page so the map survives. -->
      <div class="tab-layer" :class="{ covered: onPage }">
        <KeepAlive><component :is="tabComponent" :key="u.tab" /></KeepAlive>
      </div>
      <!-- Full-page overlays (store / checkout / track) come from the router. -->
      <RouterView v-slot="{ Component }">
        <Transition name="page"><component :is="Component" /></Transition>
      </RouterView>
      <TabBar v-if="!onPage" />
      <Transition name="fade"><div v-if="u.sheet === 'item' || u.sheet === 'pay'" class="backdrop" @click="A.closeSheet()"></div></Transition>
      <Transition name="sheet"><ItemSheet v-if="u.sheet === 'item' && Q.item(u.itemId)" /></Transition>
      <Transition name="sheet"><PaySheet v-if="u.sheet === 'pay'" /></Transition>
    </template>
    </div>
  </div></div>
</template>
