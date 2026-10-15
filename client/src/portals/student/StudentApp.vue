<script setup>
// Student portal (mobile-first): map, full store list, store menus, customisation, checkout,
// live tracking, order history, and the Deliver tab for student couriers.
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import PendingScreen from './PendingScreen.vue'
import TabBar from './TabBar.vue'
import ExploreTab from './ExploreTab.vue'
import StoresTab from './StoresTab.vue'
import OrdersTab from './OrdersTab.vue'
import DeliverTab from './DeliverTab.vue'
import MeTab from './MeTab.vue'
import StorePage from './StorePage.vue'
import CheckoutPage from './CheckoutPage.vue'
import TrackPage from './TrackPage.vue'
import ItemSheet from './ItemSheet.vue'
import PaySheet from './PaySheet.vue'

const u = computed(() => S.ui.student)
const me = computed(() => Q.me())
</script>

<template>
  <div class="app student">
    <PendingScreen v-if="me.status !== 'active'" />
    <template v-else>
      <div class="tab-layer" :class="{ covered: u.page }">
        <ExploreTab v-if="u.exploreSeen" v-show="u.tab === 'explore'" />
        <StoresTab v-if="u.tab === 'stores'" />
        <OrdersTab v-if="u.tab === 'orders'" />
        <DeliverTab v-if="u.tab === 'deliver'" />
        <MeTab v-if="u.tab === 'me'" />
      </div>
      <Transition name="page"><StorePage v-if="u.page === 'store' && Q.store(u.storeId)" /></Transition>
      <Transition name="page"><CheckoutPage v-if="u.page === 'checkout'" /></Transition>
      <Transition name="page"><TrackPage v-if="u.page === 'track' && Q.order(u.trackOrderId)" /></Transition>
      <TabBar v-if="!u.page" />
      <Transition name="fade"><div v-if="u.sheet === 'item' || u.sheet === 'pay'" class="backdrop" @click="A.closeSheet()"></div></Transition>
      <Transition name="sheet"><ItemSheet v-if="u.sheet === 'item' && Q.item(u.itemId)" /></Transition>
      <Transition name="sheet"><PaySheet v-if="u.sheet === 'pay'" /></Transition>
    </template>
  </div>
</template>
