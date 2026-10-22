<script setup>
// The website shell. vue-router renders the page (sign-in at '/', or a portal
// layout for /student, /merchant, /admin). This component keeps the chrome that
// sits around every screen: the boot (loading / can't-reach-server) states, the
// role class on the outer <div>, the top bar (only when signed in), the toaster,
// and the realtime bridges (unchanged — they must still mount here so "Try again"
// can re-run startApp() without re-subscribing).
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useUiStore } from '@/stores/ui.js'
import { startApp, refresh } from './composables/useAppBootstrap.js'
import { startRealtimeAuthBridge } from '@/composables/realtimeAuthBridge.js'
import { useRealtimeNotifications } from '@/composables/useRealtimeNotifications.js'
import { useLiveSync } from '@/composables/useLiveSync.js'
import TopNav from './components/TopNav.vue'
import NotificationToaster from './components/NotificationToaster.vue'

const session = useSessionStore()
const orders = useOrdersStore()
const ui = useUiStore()
const { loaded, loadError } = storeToRefs(ui)

const me = computed(() => orders.me())
const route = useRoute()
// The top bar shows on portal screens, not on the sign-in page or before load.
const showChrome = computed(() => !!me.value && route.name !== 'signin')

// Angel's realtime: feed her auth store the signed-in id, then subscribe to user:<id>.
startRealtimeAuthBridge()
useRealtimeNotifications()

// Liveness coordinator: Supabase realtime drives refreshes of the signed-in
// user's data, with polling as a fallback (fast when realtime is down, a long
// safety-net while it's connected). Replaces the old fixed 4s poll in startApp.
useLiveSync(() => session.session.userId, refresh)
</script>

<template>
  <div class="site" :class="'as-' + (me ? me.role : 'guest')">
    <div v-if="loadError" class="boot boot-error">
      <div>
        <AppMark :size="48" />
        <h2>Can't reach the server</h2>
        <p>{{ loadError }}. Start it with <code>pnpm dev</code> in the <code>server</code> folder, then try again.</p>
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
