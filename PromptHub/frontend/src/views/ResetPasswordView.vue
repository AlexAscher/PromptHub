<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pb, errorMessage } from '../pb'
import { toast } from '../toast'

const route = useRoute()
const router = useRouter()
const password = ref('')
const passwordConfirm = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (password.value.length < 8) return (error.value = 'Пароль должен содержать не менее 8 символов.')
  if (password.value !== passwordConfirm.value) return (error.value = 'Пароли не совпадают.')
  busy.value = true
  try {
    await pb.collection('users').confirmPasswordReset(route.params.token, password.value, passwordConfirm.value)
    toast.success('Пароль изменён. Войдите с новым паролем.')
    router.replace('/login')
  } catch (e) {
    error.value = errorMessage(e, 'Ссылка недействительна или устарела. Запросите сброс ещё раз.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 460px">
    <div class="ph-card p-4 p-md-5">
      <h1 class="h3 mb-4">Новый пароль</h1>
      <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>
      <form @submit.prevent="submit">
        <div class="mb-3">
          <label class="form-label" for="n-pass">Новый пароль</label>
          <input id="n-pass" v-model="password" type="password" class="form-control" autocomplete="new-password" required />
        </div>
        <div class="mb-4">
          <label class="form-label" for="n-pass2">Повторите пароль</label>
          <input id="n-pass2" v-model="passwordConfirm" type="password" class="form-control" autocomplete="new-password" required />
        </div>
        <button class="btn btn-primary btn-lg w-100" :disabled="busy">Сохранить пароль</button>
      </form>
      <div class="mt-3 small"><RouterLink to="/forgot-password">Запросить новую ссылку</RouterLink></div>
    </div>
  </div>
</template>
