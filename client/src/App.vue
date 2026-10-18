<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useRealtimeNotifications } from '@/composables/useRealtimeNotifications.js'
import NotificationToaster from '@/components/NotificationToaster.vue'
import NotificationBell from '@/components/NotificationBell.vue'

// Learn who the current user is, then subscribe to their realtime
// notification channel. The composable follows the auth store's userId.
const auth = useAuthStore()
useRealtimeNotifications()

onMounted(() => {
  auth.init()
})
</script>

<template>
  <header class="d-flex justify-content-end align-items-center p-2 border-bottom">
    <NotificationBell />
  </header>

  <RouterView />

  <!-- Global, app-wide stacked toasts (bottom-left). -->
  <NotificationToaster />
</template>

<style scoped></style>
