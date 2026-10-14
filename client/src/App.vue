<script setup>
// The page shell: the top bar, then the screen for the address (see router.js).
// One screen shows at a time.
import { ref, onMounted, onUnmounted } from 'vue'
import { route } from './router'
import { DEMO } from './demo'
import { dateLabel, clockTime, initials } from './utils/format'
import StoreList from './views/StoreList.vue'
import StorePage from './views/StorePage.vue'
import ItemSheet from './views/ItemSheet.vue'
import CheckoutPage from './views/CheckoutPage.vue'
import PaySheet from './views/PaySheet.vue'

// The clock in the top bar
const now = ref(Date.now())
let timer
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 15000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <nav class="navbar navbar-dark bg-navy sticky-top">
    <div class="container-fluid">
      <span class="navbar-brand fw-bold">
        <span class="text-brand">●</span> Campus Delights
        <span class="badge rounded-pill text-bg-light ms-1 fw-normal">Student</span>
      </span>
      <div class="d-flex align-items-center gap-3 text-white">
        <span class="small text-white-50 d-none d-sm-inline">🕒 {{ dateLabel(now) }}, {{ clockTime(now) }}</span>
        <span class="avatar">{{ initials(DEMO.studentName) }}</span>
        <span class="d-none d-md-inline">{{ DEMO.studentName }}</span>
      </div>
    </div>
  </nav>

  <ItemSheet v-if="route.sheet === 'item'" :key="route.itemId" :item-id="route.itemId" />
  <PaySheet v-else-if="route.sheet === 'pay'" />
  <StorePage v-else-if="route.page === 'store'" :key="route.storeId" :store-id="route.storeId" />
  <CheckoutPage v-else-if="route.page === 'checkout'" />
  <StoreList v-else />
</template>
