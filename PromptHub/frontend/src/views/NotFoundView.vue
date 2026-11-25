<script setup>
defineProps({ text: { type: String, default: 'Такой страницы нет. Возможно, ссылка устарела.' } })
</script>

<template>
  <div class="container py-5 text-center" style="max-width: 560px">
    <div class="display-1 fw-bold text-accent mb-2">404</div>
    <h1 class="h3 mb-2">Страница не найдена</h1>
    <p class="text-muted mb-4">{{ text }}</p>
    <div class="d-flex justify-content-center gap-2">
      <RouterLink to="/" class="btn btn-primary">На главную</RouterLink>
      <RouterLink to="/catalog" class="btn btn-light-ph">В каталог</RouterLink>
    </div>
  </div>
</template>
