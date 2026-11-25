<script setup>
import { computed } from 'vue'
import { isFavorite, toggleFavorite } from '../store'
import { fileUrl } from '../pb'
import { ratingText, pluralize, relativeDay } from '../utils'

const props = defineProps({
  prompt: { type: Object, required: true },
  variant: { type: String, default: 'default' }, // default | new
})

const cat = computed(() => props.prompt.expand?.category)
const model = computed(() => props.prompt.expand?.model)
const author = computed(() => props.prompt.expand?.author)
const fav = computed(() => isFavorite(props.prompt.id))
const thumb = computed(() => (props.prompt.image ? fileUrl(props.prompt, props.prompt.image, '600x340') : ''))
</script>

<template>
  <article class="ph-card prompt-card">
    <img v-if="thumb" :src="thumb" class="thumb" alt="" loading="lazy" />
    <div class="d-flex align-items-start gap-2 mb-2">
      <RouterLink :to="`/prompts/${prompt.id}`" class="title flex-grow-1">{{ prompt.title }}</RouterLink>
      <button class="fav-btn" :class="{ active: fav }" :title="fav ? 'Убрать из избранного' : 'В избранное'"
              :aria-label="fav ? 'Убрать из избранного' : 'Добавить в избранное'" :aria-pressed="fav"
              @click.prevent="toggleFavorite(prompt.id)">
        <i class="bi" :class="fav ? 'bi-heart-fill' : 'bi-heart'"></i>
      </button>
    </div>
    <p class="desc mb-3">{{ prompt.description }}</p>
    <div class="d-flex flex-wrap gap-1 mb-3 mt-auto z-up">
      <RouterLink v-if="cat" :to="{ path: '/catalog', query: { category: cat.slug } }" class="chip">{{ cat.name }}</RouterLink>
      <RouterLink v-if="model" :to="{ path: '/catalog', query: { model: model.slug } }" class="chip">{{ model.name }}</RouterLink>
    </div>
    <div class="d-flex align-items-center flex-wrap gap-1 small">
      <template v-if="variant === 'new'">
        <span class="text-muted">Добавлен {{ relativeDay(prompt.created) }}</span>
      </template>
      <template v-else>
        <i class="bi bi-star-fill" style="color: var(--ph-star)"></i>
        <span class="rating-num">{{ ratingText(prompt.rating_avg) }}</span>
        <span class="text-muted">· {{ pluralize(prompt.rating_count, ['оценка', 'оценки', 'оценок']) }}</span>
      </template>
      <span v-if="author" class="text-muted">· {{ author.name }}</span>
      <span class="ms-auto text-accent fw-semibold">Открыть <i class="bi bi-arrow-right"></i></span>
    </div>
  </article>
</template>
