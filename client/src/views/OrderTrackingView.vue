<script setup>
// Demo order-tracking page: shows the live wait-time estimate for ONE order
// (all orders ahead of it in the store queue).
// Route: /orders/<orderId>/track?store_id=<storeId>
import { useRoute } from 'vue-router'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'

const route = useRoute()
</script>

<template>
  <main class="container py-4">
    <h1 class="h4 mb-3">Order tracking</h1>
    <p class="text-muted">
      Order id: {{ route.params.orderId }} &middot; Store id: {{ route.query.store_id }}
    </p>

    <div class="card">
      <div class="card-body">
        <h2 class="h6 text-muted">Estimated wait until ready</h2>
        <!-- Order-specific estimate: pass both store and order ids. -->
        <WaitTimeEstimate
          :store-id="route.query.store_id"
          :order-id="route.params.orderId"
        />
      </div>
    </div>
  </main>
</template>
