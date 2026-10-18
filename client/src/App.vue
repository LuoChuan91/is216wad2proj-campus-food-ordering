<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useRealtimeNotifications } from '@/composables/useRealtimeNotifications.js'
import NotificationToaster from '@/components/NotificationToaster.vue'

// Learn who the current user is, then subscribe to their realtime
// notification channel. The composable follows the auth store's userId.
const auth = useAuthStore()
useRealtimeNotifications()

onMounted(() => {
  auth.init()
})
</script>

<template>
  <RouterView />

  <!-- Global, app-wide stacked toasts (bottom-left). -->
  <NotificationToaster />
</template>

