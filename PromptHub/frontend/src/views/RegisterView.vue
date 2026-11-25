<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pb, errorMessage } from '../pb'
import { login, refreshStats } from '../store'
import { toast } from '../toast'

const route = useRoute()
const router = useRouter()
const form = ref({ name: '', email: '', password: '', passwordConfirm: '', agree: false })
const busy = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  const f = form.value
  if (f.name.trim().length < 2) return (error.value = 'Имя пользователя: минимум 2 символа.')
  if (f.password.length < 8) return (error.value = 'Пароль должен содержать не менее 8 символов.')
  if (f.password !== f.passwordConfirm) return (error.value = 'Пароли не совпадают.')
  if (!f.agree) return (error.value = 'Необходимо принять условия использования.')
  busy.value = true
  try {
    await pb.collection('users').create({
      name: f.name.trim(),
      email: f.email.trim(),
      password: f.password,
      passwordConfirm: f.passwordConfirm,
      emailVisibility: false,
    })
    // мгновенный вход без подтверждения почты (ТЗ, п. 4.2.4)
    await login(f.email.trim(), f.password)
    refreshStats()
    toast.success('Аккаунт создан. Добро пожаловать в PromptHub!')
    router.replace(route.query.redirect || '/')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 480px">
    <div class="ph-card p-4 p-md-5">
      <h1 class="h3 mb-1">Регистрация</h1>
      <p class="text-muted mb-4">Уже есть аккаунт? <RouterLink :to="{ path: '/login', query: route.query }">Войдите</RouterLink></p>
      <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
      <form @submit.prevent="submit">
        <div class="mb-3">
          <label class="form-label" for="r-name">Имя пользователя (никнейм)</label>
          <input id="r-name" v-model="form.name" class="form-control" maxlength="40" autocomplete="nickname" required />
        </div>
        <div class="mb-3">
          <label class="form-label" for="r-email">Email</label>
          <input id="r-email" v-model="form.email" type="email" class="form-control" autocomplete="email" required />
        </div>
        <div class="mb-3">
          <label class="form-label" for="r-pass">Пароль</label>
          <input id="r-pass" v-model="form.password" type="password" class="form-control" autocomplete="new-password" minlength="8" required />
          <div class="form-text">Не менее 8 символов.</div>
        </div>
        <div class="mb-3">
          <label class="form-label" for="r-pass2">Повторите пароль</label>
          <input id="r-pass2" v-model="form.passwordConfirm" type="password" class="form-control" autocomplete="new-password" required />
        </div>
        <div class="form-check mb-4">
          <input id="r-agree" v-model="form.agree" class="form-check-input" type="checkbox" />
          <label for="r-agree" class="form-check-label small">Я принимаю <RouterLink to="/page/terms" target="_blank">условия использования</RouterLink> и <RouterLink to="/page/rules" target="_blank">правила публикации</RouterLink></label>
        </div>
        <button class="btn btn-primary btn-lg w-100" :disabled="busy">
          <span v-if="busy" class="spinner-border spinner-border-sm me-2"></span>Создать аккаунт
        </button>
      </form>
    </div>
  </div>
</template>
