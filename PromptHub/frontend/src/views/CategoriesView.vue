<script setup>
import { store } from '../store'
import { pluralize } from '../utils'
</script>

<template>
  <div class="container py-4 py-md-5">
    <nav class="ph-breadcrumb mb-2"><RouterLink to="/">Главная</RouterLink> / Категории</nav>
    <h1 class="mb-2">Категории</h1>
    <p class="text-muted mb-4">Выберите направление, чтобы увидеть подходящие промпты.</p>
    <div class="row g-3">
      <div v-for="c in store.categories" :key="c.id" class="col-sm-6 col-lg-4">
        <RouterLink :to="{ path: '/catalog', query: { category: c.slug } }" class="ph-card cat-tile align-items-start text-start p-4">
          <span class="cat-icon">{{ c.icon }}</span>
          <span class="fw-bold fs-5 mb-1">{{ c.name }}</span>
          <span class="text-muted small mb-3">{{ c.description }}</span>
          <span class="mt-auto small fw-semibold text-accent">{{ pluralize(store.stats.categories?.[c.id] || 0, ['промпт', 'промпта', 'промптов']) }} →</span>
        </RouterLink>
      </div>
    </div>

    <h2 class="h4 mt-5 mb-3">Модели ИИ</h2>
    <div class="d-flex flex-wrap gap-2">
      <RouterLink v-for="m in store.models" :key="m.id" :to="{ path: '/catalog', query: { model: m.slug } }" class="btn btn-light-ph">
        {{ m.name }} <span class="text-muted ms-1">{{ store.stats.models?.[m.id] || 0 }}</span>
      </RouterLink>
    </div>
  </div>
</template>
