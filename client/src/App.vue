<script setup>
// The website shell: sign-in page, or the top bar and the signed-in person's portal.
// Each portal lives in its own folder: portals/student, portals/merchant, portals/admin.
import { computed } from 'vue'
import { S, Q } from './app/state'
import { startApp } from './app/live'
import SignIn from './components/SignIn.vue'
import TopNav from './components/TopNav.vue'
import Toasts from './components/Toasts.vue'
import StudentApp from './portals/student/StudentApp.vue'
import MerchantApp from './portals/merchant/MerchantApp.vue'
import AdminApp from './portals/admin/AdminApp.vue'

const me = computed(() => Q.me())
</script>

<template>
  <div class="site" :class="'as-' + (me ? me.role : 'guest')">
    <div v-if="S.loadError" class="boot boot-error">
      <div>
        <AppMark :size="48" />
        <h2>Can't reach the server</h2>
        <p>{{ S.loadError }}. Start it with <code>pnpm dev</code> in the <code>server</code> folder, then try again.</p>
        <button class="btn btn-primary" @click="startApp()">Try again</button>
      </div>
    </div>
    <div v-else-if="!S.loaded" class="boot">Loading…</div>
    <SignIn v-else-if="!me" />
    <template v-else>
      <TopNav />
      <main class="portal">
        <div v-if="me.role === 'student'" class="student-shell"><div class="student-frame"><StudentApp /></div></div>
        <MerchantApp v-else-if="me.role === 'merchant'" />
        <AdminApp v-else />
      </main>
    </template>
    <Toasts />
  </div>
</template>
