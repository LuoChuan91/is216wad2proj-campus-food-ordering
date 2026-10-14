import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Import Bootstrap CSS and JS Bundle
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css' // optional icon, if not use can remove

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
