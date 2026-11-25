<script setup>
import { ref } from 'vue'
import { pb, errorMessage } from '../pb'
import { toast } from '../toast'

const email = ref('')
const busy = ref(false)
const sent = ref(false)
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)

async function submit() {
  busy.value = true
  try {
    await pb.collection('users').requestPasswordReset(email.value.trim())
    sent.value = true
    toast.success('Письмо для восстановления пароля отправлено')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 460px">
    <div class="ph-card p-4 p-md-5">
      <h1 class="h3 mb-1">Сбросить пароль</h1>
      <template v-if="!sent">
        <p class="text-muted mb-4">Укажите email аккаунта — мы отправим ссылку для восстановления.</p>
        <form @submit.prevent="submit">
          <div class="mb-4">
            <label class="form-label" for="f-email">Email</label>
            <input id="f-email" v-model="email" type="email" class="form-control" required autocomplete="email" />
          </div>
          <button class="btn btn-primary btn-lg w-100" :disabled="busy">Отправить ссылку</button>
        </form>
      </template>
      <template v-else>
        <p class="mb-3">Если аккаунт с адресом <b>{{ email }}</b> существует, на него отправлено письмо со ссылкой для сброса пароля.</p>
        <div v-if="isLocal" class="alert alert-info small mb-3">
          Локальная установка: письма доставляются в тестовый почтовый ящик Mailpit —
          <a href="http://localhost:8025" target="_blank" rel="noopener">localhost:8025</a>.
        </div>
      </template>
      <div class="mt-3 small"><RouterLink to="/login">← Вернуться ко входу</RouterLink></div>
    </div>
  </div>
</template>
