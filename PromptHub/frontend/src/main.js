import { createApp } from 'vue'
import '@fontsource-variable/manrope'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.min.css'
import './style.css'

import App from './App.vue'
import { router } from './router'
import { initAuth, loadDictionaries } from './store'
import { startRealtime } from './realtime'

async function start() {
  await Promise.all([initAuth(), loadDictionaries().catch(() => {})])
  createApp(App).use(router).mount('#app')
  startRealtime(true).catch(() => {})
}

start()
