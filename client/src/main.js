import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Bootstrap from npm (added by the team)
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css'

import './assets/style.css' // our colours, after Bootstrap so they win
import App from './App.vue'

// TODO: switch to vue-router together (router/index.js needs its views first)
// import router from './router/index.js'

const app = createApp(App)
app.use(createPinia())
// app.use(router)
app.mount('#app')
