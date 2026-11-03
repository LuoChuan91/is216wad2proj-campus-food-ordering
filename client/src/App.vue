<script setup>
// The website shell. vue-router renders the page (sign-in at '/', or a portal
// layout for /student, /merchant, /admin). This component keeps the chrome that
// sits around every screen: the boot (loading / can't-reach-server) states, the
// role class on the outer <div>, the top bar (only when signed in), the toaster,
// and the realtime subscriptions (they must still mount here so "Try again"
// can re-run startApp() without re-subscribing).
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useUiStore } from '@/stores/ui.js'
import { startApp, refresh } from './composables/useAppBootstrap.js'
import { useRealtimeNotifications } from '@/composables/useRealtimeNotifications.js'
import { useLiveSync } from '@/composables/useLiveSync.js'
import { useOpenDeliveriesLive } from '@/composables/useOpenDeliveries.js'

import TopNav from './components/TopNav.vue'
import NotificationToaster from './components/NotificationToaster.vue'

const session = useSessionStore() // browser tab dont share session
const orders = useOrdersStore()
const ui = useUiStore()
const { loaded, loadError, courierOn } = storeToRefs(ui)

const me = computed(() => orders.me())
const route = useRoute()
// The top bar shows on portal screens, not on the sign-in page or before load.
const showChrome = computed(() => !!me.value && route.name !== 'signin' && route.name !== 'reset-password')

// realtime: the session store is the single source of truth for who's signed in;
// useRealtimeNotifications reads session.session.userId directly (same source as
// useLiveSync) and subscribes to user:<id>.
useRealtimeNotifications()

// Liveness coordinator: Supabase realtime drives refreshes of the signed-in
// user's data, with polling as a fallback (fast when realtime is down, a long
// safety-net while it's connected)..
useLiveSync(() => session.session.userId, refresh)

useOpenDeliveriesLive({
  enabled: courierOn,
  fetchDeliveries: async () => {
    // When a broadcast is received, trigger the global refresh 
    // to fetch the new jobs and populate orders.db.jobs
    await refresh() 
  }
})
</script>

<template>
  <div class="site" :class="'as-' + (me ? me.role : 'guest')">
    <div v-if="loadError" class="boot boot-error">
      <div>
        <AppMark :size="48" />
        <h2>Can't reach the server</h2>
        <button class="btn btn-primary" @click="startApp()">Try again</button>
      </div>
    </div>
    <div v-else-if="!loaded" class="boot">Loading…</div>
    <template v-else>
      <TopNav v-if="showChrome" />
      <main v-if="showChrome" class="portal"><RouterView /></main>
      <RouterView v-else />
    </template>
    <NotificationToaster />
  </div>
</template>

<style scoped>
/* Can't-reach-server boot screen. */
.boot-error {
  text-align: center;
  padding: 24px;
}
.boot-error h2 {
  font-family: var(--font-display);
  font-weight: 800;
  margin: 14px 0 6px;
  color: var(--ink);
}
.boot-error p {
  max-width: 420px;
  margin: 0 auto 14px;
}
.boot-error :deep(.appmark) {
  margin: 0 auto;
}
.boot-error :deep(.btn-primary) {
  --bs-btn-bg: var(--brand);
  --bs-btn-border-color: var(--brand);
  --bs-btn-hover-bg: var(--brand-600);
  --bs-btn-hover-border-color: var(--brand-600);
  font-weight: 700;
  border-radius: 12px;
}
</style>
