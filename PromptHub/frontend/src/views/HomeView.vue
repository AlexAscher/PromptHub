<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { pb, errorMessage } from '../pb'
import { store } from '../store'
import { toast } from '../toast'
import SelectMenu from '../components/SelectMenu.vue'
import { SORTS, pluralize } from '../utils'
import PromptGrid from '../components/PromptGrid.vue'
import CtaBanner from '../components/CtaBanner.vue'
import HowSteps from '../components/HowSteps.vue'

const router = useRouter()
const q = ref('')
const popular = ref([])
const fresh = ref([])
const loadingPopular = ref(true)
const loadingFresh = ref(true)
const f = reactive({ category: '', model: '', sort: 'popular' })

const popularQueries = ['Пост для соцсетей', 'Идеи для логотипа', 'Помощь с кодом', 'План обучения']

function search() {
  router.push({ path: '/catalog', query: q.value.trim() ? { q: q.value.trim() } : {} })
}

async function loadPopular() {
  loadingPopular.value = true
  try {
    const parts = []
    if (f.category) parts.push(pb.filter('category = {:c}', { c: f.category }))
    if (f.model) parts.push(pb.filter('model = {:m}', { m: f.model }))
    const res = await pb.collection('prompts').getList(1, 6, {
      sort: SORTS[f.sort].value,
      filter: parts.join(' && '),
      expand: 'category,model,author',
    })
    popular.value = res.items
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loadingPopular.value = false
  }
}

async function loadFresh() {
  try {
    const res = await pb.collection('prompts').getList(1, 3, { sort: '-created', expand: 'category,model,author' })
    fresh.value = res.items
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loadingFresh.value = false
  }
}

function openFilters() {
  const query = { sort: f.sort }
  const c = store.categories.find((x) => x.id === f.category)
  const m = store.models.find((x) => x.id === f.model)
  if (c) query.category = c.slug
  if (m) query.model = m.slug
  router.push({ path: '/catalog', query })
}

watch(f, loadPopular)
// блок «Новые промпты» обновляется сам, когда кто-то публикует промпт
watch(() => store.newPromptsTick, loadFresh)
onMounted(() => { loadPopular(); loadFresh() })
</script>

<template>
  <section class="ph-hero text-center">
    <div class="container" style="max-width: 820px">
      <h1 class="mb-3">Готовые промпты для ваших задач</h1>
      <p class="text-muted fs-5 mb-4">Находите, сохраняйте и публикуйте запросы для ChatGPT, Claude, Midjourney и других нейросетей.</p>
      <form class="ph-search mb-3" role="search" @submit.prevent="search">
        <i class="bi bi-search text-muted"></i>
        <input v-model="q" type="search" placeholder="Поиск по названию или содержанию промпта…" aria-label="Поиск промптов" />
        <button class="btn btn-primary">Найти</button>
      </form>
      <div class="d-flex flex-wrap justify-content-center align-items-center gap-2 mb-2">
        <span class="small text-muted">Популярные запросы:</span>
        <RouterLink v-for="pq in popularQueries" :key="pq" :to="{ path: '/catalog', query: { q: pq } }" class="chip chip-accent">{{ pq }}</RouterLink>
      </div>
      <div class="d-flex flex-wrap justify-content-center gap-2">
        <RouterLink v-for="m in store.models.filter((x) => x.slug !== 'other')" :key="m.id" :to="{ path: '/catalog', query: { model: m.slug } }" class="chip">{{ m.name }}</RouterLink>
      </div>
      <div v-if="store.stats.totals?.prompts" class="d-flex justify-content-center gap-4 mt-4 small text-muted">
        <span><b class="text-body">{{ store.stats.totals.prompts }}</b> промптов</span>
        <span><b class="text-body">{{ store.stats.totals.authors }}</b> авторов</span>
        <span><b class="text-body">{{ store.stats.totals.ratings }}</b> оценок</span>
      </div>
    </div>
  </section>

  <section class="ph-section pt-4">
    <div class="container">
      <h2 class="ph-section-title">Популярные категории <RouterLink to="/categories" class="ms-1">Все категории →</RouterLink></h2>
      <p class="text-muted mb-4">Выберите направление и просмотрите подходящие промпты.</p>
      <div class="row g-3 row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-7">
        <div v-for="c in store.categories" :key="c.id" class="col">
          <RouterLink :to="{ path: '/catalog', query: { category: c.slug } }" class="ph-card cat-tile">
            <span class="cat-icon">{{ c.icon }}</span>
            <span class="fw-bold">{{ c.name }}</span>
            <span class="small text-muted">{{ pluralize(store.stats.categories?.[c.id] || 0, ['промпт', 'промпта', 'промптов']) }}</span>
          </RouterLink>
        </div>
      </div>
    </div>
  </section>

  <section class="ph-section pt-2">
    <div class="container">
      <h2 class="ph-section-title">Популярные промпты <RouterLink to="/catalog" class="ms-1">Смотреть все промпты →</RouterLink></h2>
      <p class="text-muted mb-3">Промпты с высокими оценками сообщества.</p>
      <div class="d-flex flex-wrap gap-2 mb-4">
        <SelectMenu v-model="f.category" aria-label="Категория"
                    :options="[{ value: '', label: 'Все категории' }, ...store.categories.map((c) => ({ value: c.id, label: c.name }))]" />
        <SelectMenu v-model="f.model" aria-label="Модель ИИ"
                    :options="[{ value: '', label: 'Все модели' }, ...store.models.map((m) => ({ value: m.id, label: m.name }))]" />
        <SelectMenu v-model="f.sort" aria-label="Сортировка"
                    :options="[{ value: 'popular', label: 'Сначала популярные' }, { value: 'rating', label: 'Сначала с высоким рейтингом' }, { value: 'new', label: 'Сначала новые' }]" />
        <button class="btn btn-light-ph" @click="openFilters"><i class="bi bi-sliders me-1"></i>Фильтры</button>
      </div>
      <PromptGrid :items="popular" :loading="loadingPopular" empty-text="В этой подборке пока нет промптов." />
    </div>
  </section>

  <section class="ph-section pt-2">
    <div class="container">
      <h2 class="ph-section-title">Новые промпты <RouterLink :to="{ path: '/catalog', query: { sort: 'new' } }" class="ms-1">Смотреть все →</RouterLink></h2>
      <p class="text-muted mb-4">Недавно опубликованные участниками PromptHub.</p>
      <PromptGrid :items="fresh" :loading="loadingFresh" variant="new" :skeletons="3" />
    </div>
  </section>

  <section class="ph-section pt-2">
    <div class="container"><CtaBanner /></div>
  </section>

  <section class="ph-section pt-2">
    <div class="container">
      <h2 class="ph-section-title mb-4">Как пользоваться PromptHub</h2>
      <HowSteps />
    </div>
  </section>

  <section v-if="!store.isAuth" class="pb-2">
    <div class="container">
      <div class="ph-card p-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
        <div>
          <h4 class="mb-1">Готовы начать?</h4>
          <p class="text-muted mb-0">Создайте аккаунт и получите доступ ко всем функциям PromptHub: публикация, избранное, оценки и подборки.</p>
        </div>
        <RouterLink to="/register" class="btn btn-primary btn-lg px-4 flex-shrink-0">Создать аккаунт</RouterLink>
      </div>
    </div>
  </section>
</template>
