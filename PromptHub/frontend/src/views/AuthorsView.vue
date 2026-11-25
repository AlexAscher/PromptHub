<script setup>
import { ref, computed, onMounted } from 'vue'
import { pb, errorMessage } from '../pb'
import { toast } from '../toast'
import { pluralize, sinceText, ratingText } from '../utils'
import UserAvatar from '../components/UserAvatar.vue'

const authors = ref([])
const collectionId = ref('')
const loading = ref(true)
const q = ref('')

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  return s ? authors.value.filter((a) => a.name.toLowerCase().includes(s)) : authors.value
})

onMounted(async () => {
  try {
    const res = await pb.send('/api/ph/authors', {})
    authors.value = res.items
    collectionId.value = res.collectionId
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container py-4 py-md-5">
    <nav class="ph-breadcrumb mb-2"><RouterLink to="/">Главная</RouterLink> / Авторы</nav>
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
      <div>
        <h1 class="mb-2">Авторы</h1>
        <p class="text-muted mb-0">Участники сообщества, которые делятся своими промптами.</p>
      </div>
      <div class="ph-search" style="min-width: 260px">
        <i class="bi bi-search text-muted"></i>
        <input v-model="q" type="search" placeholder="Найти автора" aria-label="Найти автора" />
      </div>
    </div>
    <div class="row g-3">
      <template v-if="loading">
        <div v-for="i in 6" :key="i" class="col-sm-6 col-lg-4"><div class="skeleton" style="height: 150px"></div></div>
      </template>
      <div v-for="a in filtered" :key="a.id" class="col-sm-6 col-lg-4">
        <RouterLink :to="`/authors/${a.id}`" class="ph-card cat-tile align-items-start text-start p-4">
          <div class="d-flex align-items-center gap-3 mb-2">
            <UserAvatar :user="a" :collection-id="collectionId" :size="52" />
            <div class="min-w-0">
              <div class="fw-bold fs-5 text-truncate">{{ a.name }}</div>
              <div class="small text-muted">На PromptHub {{ sinceText(a.created) }}</div>
            </div>
          </div>
          <p v-if="a.bio" class="small text-muted mb-2">{{ a.bio }}</p>
          <div class="d-flex flex-wrap gap-3 small mt-auto">
            <span><i class="bi bi-file-text me-1 text-accent"></i>{{ pluralize(a.prompts, ['промпт', 'промпта', 'промптов']) }}</span>
            <span v-if="a.rating"><i class="bi bi-star-fill me-1" style="color: var(--ph-star)"></i>{{ ratingText(a.rating) }}</span>
            <span><i class="bi bi-eye me-1 text-muted"></i>{{ a.views }}</span>
          </div>
        </RouterLink>
      </div>
      <div v-if="!loading && !filtered.length" class="col-12"><div class="ph-card empty-state"><i class="bi bi-people"></i>Авторы не найдены.</div></div>
    </div>
  </div>
</template>
