import { createApp } from 'vue'
import pinia from './stores/pinia.js'

// Bootstrap from npm (added by the team). The prototype uses its CSS for buttons, switches and forms.
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css'

import './assets/main.css' // global styles: tokens, resets, shared theming (after Bootstrap so they win)
import App from './App.vue'
import router from './router/index.js'
import { setRouter } from './router/nav.js'
import { startApp } from './composables/useAppBootstrap.js'

// Small pieces used on almost every screen, registered once so templates can use them anywhere
import Icon from './components/Icon.vue'
import AppMark from './components/AppMark.vue'
import Mono from './components/Mono.vue'
import Avatar from './components/Avatar.vue'
import WaitChip from './components/WaitChip.vue'

// vue-router owns navigation (createWebHashHistory keeps the #/... scheme). The
// ui-store nav actions push through router/nav.js, which we point at this router
// instance here. useAppBootstrap.js owns loading, polling, clock, title and
// notifications; router/sync.js keeps the ui-store tab/page in step with the URL.
//
// We bootstrap (load the catalog + restore this tab's sign-in) BEFORE installing
// the router and mounting, so that when the router runs its first navigation the
// session is already restored — a hard refresh on a deep link (e.g. #/student/
// checkout) passes the guard instead of being bounced to the sign-in page.
const app = createApp(App)
app.use(pinia)
setRouter(router)
app.component('Icon', Icon)
app.component('AppMark', AppMark)
app.component('Mono', Mono)
app.component('Avatar', Avatar)
app.component('WaitChip', WaitChip)
app.config.errorHandler = (err, instance, info) => console.error('[app]', info, err)

startApp().finally(() => {
  app.use(router)
  app.mount('#app')
})
