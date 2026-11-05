<script setup>
// Staff portal shell: a per-role switch that renders MerchantView or AdminView for
// the signed-in staff account. Each shell owns its rail + header and its own
// <RouterView> for the active section (merchant orders/menu; admin approvals/
// venues/stores).
import { computed } from 'vue'
import { useOrdersStore } from '@/stores/orders.js'
import MerchantView from '../views/merchant/MerchantView.vue'
import AdminView from '../views/admin/AdminView.vue'

const orders = useOrdersStore()
const me = computed(() => orders.me())
</script>

<template>
  <MerchantView v-if="me && me.role === 'merchant'" />
  <AdminView v-else-if="me && me.role === 'admin'" />
</template>
