<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pb, errorMessage } from '../pb'
import { store, categoryBySlug } from '../store'
import { toast } from '../toast'
import SelectMenu from '../components/SelectMenu.vue'
import { SORTS, pluralize } from '../utils'
import PromptGrid from '../components/PromptGrid.vue'
import PaginationBar from '../components/PaginationBar.vue'
import CtaBanner from '../components/CtaBanner.vue'

const PER_PAGE = 9
const route = useRoute()
const router = useRouter()

const items = ref([])
const total = ref(0)
const totalPages = ref(0)
const loading = ref(true)
const showFilters = ref(false)
const q = ref(route.query.q || '')

// Состояние фильтров хранится в адресной строке (можно поделиться ссылкой)
const state = computed(() => ({
  q: String(route.query.q || ''),
  category: String(route.query.category || ''),
  models: String(route.query.model || '').split(',').filter(Boolean),
  sort: SORTS[route.query.sort] ? String(route.query.sort) : 'popular',
  page: Math.max(1, parseInt(route.query.page) || 1),
}))

const currentCategory = computed(() => categoryBySlug(state.value.category))
const hasFilters = computed(() => state.value.q || state.value.category || state.value.models.length)

function update(patch, resetPage = true) {
  const next = { ...route.query, ...patch }
  if (resetPage && !('page' in patch)) delete next.page
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] == null || (k === 'page' && next[k] === 1)) delete next[k]
  router.push({ path: '/catalog', query: next })
}

function toggleModel(slug) {
  const set = new Set(state.value.models)
  set.has(slug) ? set.delete(slug) : set.add(slug)
  update({ model: [...set].join(',') })
}

function submitSearch() {
  update({ q: q.value.trim() })
}

function reset() {
  q.value = ''
  router.push({ path: '/catalog', query: state.value.sort !== 'popular' ? { sort: state.value.sort } : {} })
}

async function load() {
  loading.value = true
  const s = state.value
  const parts = []
  if (s.q) {
    parts.push(pb.filter('(title ~ {:q} || text ~ {:q} || description ~ {:q} || tags ~ {:q})', { q: s.q }))
  }
  if (s.category) {
    const c = categoryBySlug(s.category)
    parts.push(pb.filter('category = {:c}', { c: c ? c.id : '-' }))
  }
  if (s.models.length) {
    const ids = s.models.map((slug) => store.models.find((m) => m.slug === slug)?.id || '-')
    parts.push('(' + ids.map((id) => pb.filter('model = {:m}', { m: id })).join(' || ') + ')')
  }
  try {
    const res = await pb.collection('prompts').getList(s.page, PER_PAGE, {
      filter: parts.join(' && '),
      sort: SORTS[s.sort].value,
      expand: 'category,model,author',
    })
    items.value = res.items
    total.value = res.totalItems
    totalPages.value = res.totalPages
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}

// Новые промпты от других пользователей приходят в реальном времени
const freshCount = ref(0)
watch(() => store.newPromptsTick, () => freshCount.value++)
function showFresh() {
  freshCount.value = 0
  if (state.value.sort === 'new' && state.value.page === 1) load()
  else update({ sort: 'new' })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(() => route.query, () => {
  q.value = String(route.query.q || '')
  freshCount.value = 0
  load()
}, { immediate: true, deep: true })

function goPage(p) {
  update({ page: p }, false)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="container py-4 py-md-5">
    <nav class="ph-breadcrumb mb-2"><RouterLink to="/">Главная</RouterLink> / Каталог<template v-if="currentCategory"> / {{ currentCategory.name }}</template></nav>
    <h1 class="mb-2">{{ currentCategory ? currentCategory.name : 'Каталог промптов' }}</h1>
    <p class="text-muted mb-1">{{ currentCategory?.description || 'Находите готовые запросы для разных задач и моделей искусственного интеллекта.' }}</p>
    <p class="small text-muted mb-4">Найдено {{ pluralize(total, ['промпт', 'промпта', 'промптов']) }}</p>

    <form class="ph-search mb-2" role="search" @submit.prevent="submitSearch">
      <i class="bi bi-search text-muted"></i>
      <input v-model="q" type="search" placeholder="Поиск по названию или содержанию промпта…" aria-label="Поиск" />
      <button v-if="q" type="button" class="btn btn-link text-muted px-2" aria-label="Очистить" @click="q = ''; submitSearch()"><i class="bi bi-x-lg"></i></button>
      <button class="btn btn-primary">Найти</button>
    </form>
    <p class="small text-muted mb-3">Например: пост для соцсетей, план обучения, помощь с кодом</p>

    <div class="d-flex flex-wrap align-items-center gap-2 mb-4">
      <SelectMenu :model-value="state.category" aria-label="Категория" @change="(v) => update({ category: v })"
                  :options="[{ value: '', label: 'Категория: все' }, ...store.categories.map((c) => ({ value: c.slug, label: 'Категория: ' + c.name }))]" />
      <SelectMenu :model-value="state.models.length === 1 ? state.models[0] : ''" aria-label="Модель ИИ" @change="(v) => update({ model: v })"
                  :options="[{ value: '', label: 'Модель ИИ: все модели' }, ...store.models.map((m) => ({ value: m.slug, label: 'Модель ИИ: ' + m.name }))]" />
      <SelectMenu :model-value="state.sort" aria-label="Сортировка" @change="(v) => update({ sort: v })"
                  :options="Object.entries(SORTS).map(([k, s]) => ({ value: k, label: 'Сортировка: ' + s.label.toLowerCase() }))" />
      <button class="btn btn-light-ph d-lg-none" :class="{ active: showFilters }" @click="showFilters = !showFilters"><i class="bi bi-sliders me-1"></i>Фильтры</button>
      <span v-if="state.q" class="chip chip-accent">«{{ state.q }}» <button class="btn-close btn-close-sm ms-1" style="font-size: .55rem" aria-label="Убрать" @click="update({ q: '' })"></button></span>
      <span v-if="currentCategory" class="chip chip-accent">{{ currentCategory.name }} <button class="btn-close ms-1" style="font-size: .55rem" aria-label="Убрать" @click="update({ category: '' })"></button></span>
      <span v-for="slug in state.models" :key="slug" class="chip chip-accent">{{ store.models.find((m) => m.slug === slug)?.name || slug }} <button class="btn-close ms-1" style="font-size: .55rem" aria-label="Убрать" @click="toggleModel(slug)"></button></span>
      <button v-if="hasFilters" class="btn btn-link btn-sm" @click="reset">Сбросить фильтры</button>
    </div>

    <div class="row g-4">
      <aside class="col-lg-3" :class="{ 'd-none d-lg-block': !showFilters }">
        <div class="ph-card p-3 mb-3">
          <h6 class="fw-bold mb-2 px-2">Категории</h6>
          <div class="side-list d-grid gap-1">
            <a href="#" :class="{ active: !state.category }" @click.prevent="update({ category: '' })"><span>Все категории</span><span>{{ store.stats.totals?.prompts || '' }}</span></a>
            <a v-for="c in store.categories" :key="c.id" href="#" :class="{ active: state.category === c.slug }" @click.prevent="update({ category: c.slug })">
              <span class="text-truncate me-2">{{ c.icon }} {{ c.name }}</span><span class="text-muted">{{ store.stats.categories?.[c.id] || 0 }}</span>
            </a>
          </div>
        </div>
        <div class="ph-card p-3">
          <h6 class="fw-bold mb-2">Модели ИИ</h6>
          <div v-for="m in store.models" :key="m.id" class="form-check mb-1">
            <input :id="'m-' + m.slug" class="form-check-input" type="checkbox" :checked="state.models.includes(m.slug)" @change="toggleModel(m.slug)" />
            <label :for="'m-' + m.slug" class="form-check-label d-flex justify-content-between">
              <span>{{ m.name }}</span><span class="small text-muted">{{ store.stats.models?.[m.id] || 0 }}</span>
            </label>
          </div>
        </div>
      </aside>

      <div class="col-lg-9">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h5 class="mb-0">{{ state.q ? 'Результаты поиска' : 'Все промпты' }}</h5>
          <SelectMenu :model-value="state.sort" size="sm" aria-label="Сортировка" @change="(v) => update({ sort: v })"
                      :options="Object.entries(SORTS).map(([k, s]) => ({ value: k, label: s.label }))" />
        </div>
        <button v-if="freshCount" class="ph-card w-100 mb-3 p-2 d-flex align-items-center justify-content-center gap-2 text-accent fw-semibold border-0" style="background: var(--ph-accent-soft)" @click="showFresh">
          <i class="bi bi-arrow-up-circle"></i>
          {{ freshCount === 1 ? 'Опубликован новый промпт' : `Опубликовано новых промптов: ${freshCount}` }} — показать
        </button>
        <div :style="{ opacity: loading && items.length ? 0.55 : 1, transition: 'opacity .15s' }">
          <PromptGrid :items="items" :loading="loading" cols="col-sm-6 col-xl-4" :skeletons="9">
            <template #empty>
              <div class="small mb-3">Попробуйте изменить запрос или сбросить фильтры.</div>
              <button v-if="hasFilters" class="btn btn-soft btn-sm" @click="reset">Сбросить фильтры</button>
            </template>
          </PromptGrid>
        </div>
        <PaginationBar :page="state.page" :total-pages="totalPages" :total-items="total" :per-page="PER_PAGE" @change="goPage" />
      </div>
    </div>

    <div class="mt-5">
      <CtaBanner title="Не нашли подходящий промпт?" text="Опубликуйте свой вариант и поделитесь им с сообществом." />
    </div>
  </div>
</template>
