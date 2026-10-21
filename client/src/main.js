import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Bootstrap from npm (added by the team). The prototype uses its CSS for buttons, switches and forms.
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css'

import './assets/app.css' // the website's styles, after Bootstrap so they win
import App from './App.vue'
import { startApp } from './app/live'

// Small pieces used on almost every screen, registered once so templates can use them anywhere
import Icon from './components/Icon.vue'
import AppMark from './components/AppMark.vue'
import Mono from './components/Mono.vue'
import Avatar from './components/Avatar.vue'
import WaitChip from './components/WaitChip.vue'

// TODO: switch to vue-router together (router/index.js needs its views first).
// For now app/live.js keeps the address bar in step with the screen.
// import router from './router/index.js'

const app = createApp(App)
app.use(createPinia())
// app.use(router)
app.component('Icon', Icon)
app.component('AppMark', AppMark)
app.component('Mono', Mono)
app.component('Avatar', Avatar)
app.component('WaitChip', WaitChip)
app.config.errorHandler = (err, instance, info) => console.error('[app]', info, err)
app.mount('#app')
startApp()
