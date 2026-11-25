<template>
  <div class="row g-3">
    <div v-for="(s, i) in steps" :key="i" class="col-md-4">
      <div class="ph-card h-100 text-center p-4">
        <div class="step-num">{{ i + 1 }}</div>
        <h6 class="fw-bold">{{ s[0] }}</h6>
        <p class="text-muted small mb-0">{{ s[1] }}</p>
      </div>
    </div>
  </div>
  <p class="text-center small text-muted mt-3 mb-0">PromptHub хранит и систематизирует промпты. Генерация ответа происходит во внешнем сервисе ИИ.</p>
</template>

<script setup>
const steps = [
  ['Найдите промпт', 'Ищите по названию, задаче, категории или модели ИИ.'],
  ['Скопируйте текст', 'Откройте страницу промпта и скопируйте готовый запрос.'],
  ['Используйте в своей нейросети', 'Вставьте промпт в ChatGPT, Claude, Midjourney или другой сервис.'],
]
</script>
