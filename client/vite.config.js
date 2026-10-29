import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Vue DevTools overlay disabled: its floating launcher sat over the bottom
    // sheet's drag handle. Re-enable locally if you want it back.
    // vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // TODO: route to correct server after deployment
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
