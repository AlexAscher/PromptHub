<script setup>
import { store } from '../store'
defineProps({
  title: { type: String, default: 'Есть полезный промпт? Поделитесь им.' },
  text: { type: String, default: 'Опубликуйте свой промпт, чтобы другие могли найти его, оценить и сохранить.' },
})
</script>

<template>
  <div class="ph-banner d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
    <div>
      <h4 class="mb-2">{{ title }}</h4>
      <p class="mb-1">{{ text }}</p>
      <p v-if="!store.isAuth" class="small text-muted mb-0">Для публикации потребуется аккаунт PromptHub.</p>
    </div>
    <RouterLink :to="store.isAuth ? '/prompts/new' : { path: '/login', query: { redirect: '/prompts/new' } }" class="btn btn-primary btn-lg px-4 flex-shrink-0">
      <i class="bi bi-plus-lg me-1"></i> Добавить промпт
    </RouterLink>
  </div>
</template>
