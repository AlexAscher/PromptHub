import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// В режиме разработки запросы к API проксируются на локальный PocketBase.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8090',
      '/_': 'http://127.0.0.1:8090',
    },
  },
})
