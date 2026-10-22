<script setup>
// Staff portal shell (merchant + admin). vue-router owns the URL (#/merchant,
// #/merchant/menu, #/admin, #/admin/venues, #/admin/stores) and the guard.
//
// This layout is the per-role switch: it renders the MerchantView or AdminView shell
// for the signed-in staff account. Each shell owns its own rail + header and contains
// its OWN <RouterView>, into which the matched child route renders the active section
// (merchant orders/menu; admin approvals/venues/stores). The rail buttons call actions
// that push the matching route, so the URL is the source of truth for WHICH section is
// active, and the ui-store staff tab stays in sync via router/sync.js.
//
// The shells keep their internal rails, so the prototype's layout and behaviour are
// preserved exactly. CRITICAL: MerchantView mounts useStoreOrdersLive at the shell
// level, so the realtime order layer (and the "Updates: Live/Polling" chip) stays
// connected while switching between the Orders and Menu tabs — identical to before.
import { computed } from 'vue'
import { Q } from '@/stores/compat.js'
import MerchantView from '../views/merchant/MerchantView.vue'
import AdminView from '../views/admin/AdminView.vue'

const me = computed(() => Q.me())
</script>

<template>
  <MerchantView v-if="me && me.role === 'merchant'" />
  <AdminView v-else-if="me && me.role === 'admin'" />
</template>
