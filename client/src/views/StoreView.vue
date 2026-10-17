<script setup>
// Demo store page: shows the store-wide live wait-time estimate.
// Reads the store id from the route param, e.g. /store/<storeId>.
import { useRoute } from 'vue-router'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'

const route = useRoute()
</script>

<template>
  <main class="container py-4">
    <h1 class="h4 mb-3">Store</h1>
    <p class="text-muted">Store id: {{ route.params.storeId }}</p>

    <!-- Whole-store queue estimate (no orderId). -->
    <WaitTimeEstimate :store-id="route.params.storeId" strategy="factor" :stations="2" />
  </main>
</template>
