<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, store } from '../store'
import { toast } from '../toast'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await login(email.value.trim(), password.value)
    toast.success(`Добро пожаловать, ${store.user.name}!`)
    router.replace(route.query.redirect || '/')
  } catch (e) {
    error.value = e.status === 0 ? 'Сервер недоступен.' : 'Неверный email или пароль, либо аккаунт заблокирован.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 460px">
    <div class="ph-card p-4 p-md-5">
      <h1 class="h3 mb-1">Вход</h1>
      <p class="text-muted mb-4">Нет аккаунта? <RouterLink :to="{ path: '/register', query: route.query }">Зарегистрируйтесь</RouterLink></p>
      <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
      <form @submit.prevent="submit">
        <div class="mb-3">
          <label class="form-label" for="l-email">Email</label>
          <input id="l-email" v-model="email" type="email" class="form-control" autocomplete="email" required />
        </div>
        <div class="mb-2">
          <label class="form-label" for="l-pass">Пароль</label>
          <input id="l-pass" v-model="password" type="password" class="form-control" autocomplete="current-password" required />
        </div>
        <div class="text-end mb-4"><RouterLink to="/forgot-password" class="small">Забыли пароль?</RouterLink></div>
        <button class="btn btn-primary btn-lg w-100" :disabled="busy">
          <span v-if="busy" class="spinner-border spinner-border-sm me-2"></span>Войти
        </button>
      </form>
    </div>
  </div>
</template>
