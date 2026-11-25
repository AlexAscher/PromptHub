<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { debounce } from '../realtime'
import { useRoute, useRouter } from 'vue-router'
import { pb, errorMessage, fileUrl } from '../pb'
import { store, isFavorite, toggleFavorite, refreshStats } from '../store'
import { toast } from '../toast'
import { formatDate, sinceText, ratingText, pluralize, copyText } from '../utils'
import UserAvatar from '../components/UserAvatar.vue'
import StarDisplay from '../components/StarDisplay.vue'
import StarInput from '../components/StarInput.vue'
import SelectionModal from '../components/SelectionModal.vue'
import ReportModal from '../components/ReportModal.vue'
import NotFoundView from './NotFoundView.vue'

const route = useRoute()
const router = useRouter()
const id = route.params.id

const prompt = ref(null)
const notFound = ref(false)
const authorCount = ref(0)
const similar = ref([])
const ratings = ref([]) // все оценки промпта (для распределения и звёзд у отзывов)
const reviews = ref([])
const reviewsPage = ref(1)
const reviewsTotalPages = ref(1)
const myRating = ref(null)
const myReview = ref(null)
const form = ref({ value: 0, text: '' })
const saving = ref(false)
const editing = ref(false)
const showSel = ref(false)
const showReport = ref(false)
const copied = ref(false)

const cat = computed(() => prompt.value?.expand?.category)
const model = computed(() => prompt.value?.expand?.model)
const author = computed(() => prompt.value?.expand?.author)
const canEdit = computed(() => store.user && (store.user.id === prompt.value?.author || store.isAdmin))
const isOwn = computed(() => store.user && store.user.id === prompt.value?.author)
const fav = computed(() => isFavorite(id))
const ratingMap = computed(() => Object.fromEntries(ratings.value.map((r) => [r.user, r.value])))
const distribution = computed(() => {
  const d = [0, 0, 0, 0, 0]
  ratings.value.forEach((r) => d[r.value - 1]++)
  return d
})
const usageLines = computed(() => (prompt.value?.usage || '').split('\n').map((s) => s.trim()).filter(Boolean))

async function load() {
  try {
    prompt.value = await pb.collection('prompts').getOne(id, { expand: 'category,model,author' })
  } catch (e) {
    if (e.status === 404) notFound.value = true
    else toast.error(errorMessage(e))
    return
  }
  document.title = `${prompt.value.title} — PromptHub`
  countView()
  const p = prompt.value
  const [cnt, sim] = await Promise.all([
    pb.collection('prompts').getList(1, 1, { filter: pb.filter('author = {:a}', { a: p.author }), fields: 'id' }),
    pb.collection('prompts').getList(1, 3, {
      filter: pb.filter('category = {:c} && id != {:id}', { c: p.category, id: p.id }),
      sort: '-rating_avg,-views',
      expand: 'model',
    }),
  ])
  authorCount.value = cnt.totalItems
  similar.value = sim.items
  await Promise.all([loadRatings(), loadReviews(1)])
}

function countView() {
  const key = 'ph-viewed-' + id
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch (_) {}
  pb.send(`/api/ph/prompts/${id}/view`, { method: 'POST' }).catch(() => {})
}

async function loadRatings() {
  ratings.value = await pb.collection('ratings').getFullList({
    filter: pb.filter('prompt = {:p}', { p: id }),
    fields: 'id,user,value',
  })
  myRating.value = store.user ? ratings.value.find((r) => r.user === store.user.id) || null : null
  if (store.user) {
    const mine = await pb.collection('reviews').getList(1, 1, { filter: pb.filter('prompt = {:p} && user = {:u}', { p: id, u: store.user.id }) })
    myReview.value = mine.items[0] || null
  }
  form.value = { value: myRating.value?.value || 0, text: myReview.value?.text || '' }
}

async function loadReviews(page) {
  const res = await pb.collection('reviews').getList(page, 5, {
    filter: pb.filter('prompt = {:p}', { p: id }),
    sort: '-created',
    expand: 'user',
  })
  reviews.value = page === 1 ? res.items : [...reviews.value, ...res.items]
  reviewsPage.value = page
  reviewsTotalPages.value = res.totalPages
}

async function refreshPrompt() {
  const p = await pb.collection('prompts').getOne(id, { fields: 'rating_avg,rating_count,reviews_count' })
  Object.assign(prompt.value, p)
}

async function copy() {
  if (await copyText(prompt.value.text)) {
    copied.value = true
    toast.success('Промпт скопирован в буфер обмена')
    setTimeout(() => (copied.value = false), 2000)
  } else {
    toast.error('Не удалось скопировать. Выделите текст вручную.')
  }
}

function requireAuth(action) {
  if (!store.user) {
    toast.info('Войдите, чтобы ' + action)
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return false
  }
  return true
}

async function saveReview() {
  if (!form.value.value) return toast.error('Поставьте оценку от 1 до 5.')
  saving.value = true
  try {
    if (myRating.value) {
      if (myRating.value.value !== form.value.value) await pb.collection('ratings').update(myRating.value.id, { value: form.value.value })
    } else {
      await pb.collection('ratings').create({ user: store.user.id, prompt: id, value: form.value.value })
    }
    const text = form.value.text.trim()
    if (text && myReview.value) {
      if (text !== myReview.value.text) await pb.collection('reviews').update(myReview.value.id, { text })
    } else if (text) {
      await pb.collection('reviews').create({ user: store.user.id, prompt: id, text })
    } else if (myReview.value) {
      await pb.collection('reviews').delete(myReview.value.id)
    }
    toast.success(myRating.value ? 'Оценка и отзыв обновлены' : 'Спасибо! Ваша оценка сохранена')
    editing.value = false
    await Promise.all([loadRatings(), loadReviews(1), refreshPrompt()])
    refreshStats()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

async function deleteMine() {
  if (!confirm('Удалить вашу оценку и отзыв?')) return
  try {
    if (myReview.value) await pb.collection('reviews').delete(myReview.value.id)
    if (myRating.value) await pb.collection('ratings').delete(myRating.value.id)
    toast.success('Оценка и отзыв удалены')
    await Promise.all([loadRatings(), loadReviews(1), refreshPrompt()])
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

async function adminDeleteReview(r) {
  if (!confirm('Удалить этот отзыв как нарушающий правила?')) return
  try {
    await pb.collection('reviews').delete(r.id)
    toast.success('Отзыв удалён')
    await Promise.all([loadReviews(1), refreshPrompt()])
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

async function removePrompt() {
  if (!confirm('Удалить промпт? Это действие нельзя отменить.')) return
  try {
    await pb.collection('prompts').delete(id)
    toast.success('Промпт удалён')
    refreshStats()
    router.push(isOwn.value ? { path: '/account', query: { tab: 'prompts' } } : '/catalog')
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

function openSel() { if (requireAuth('сохранять промпты в подборки.')) showSel.value = true }
function openReport() { if (requireAuth('отправить жалобу.')) showReport.value = true }
function toggleFav() { if (requireAuth('добавлять в избранное.')) toggleFavorite(id) }

// ---------- Обновления в реальном времени ----------
const unsubs = []
let alive = true
const track = (u) => (alive ? unsubs.push(u) : u().catch(() => {}))
const reloadFeedback = debounce(async () => {
  if (!prompt.value) return
  try {
    // форму своего отзыва не трогаем, пока пользователь её редактирует
    if (!editing.value && !saving.value) await loadRatings()
    else ratings.value = await pb.collection('ratings').getFullList({ filter: pb.filter('prompt = {:p}', { p: id }), fields: 'id,user,value' })
    await Promise.all([loadReviews(1), refreshPrompt()])
  } catch (_) {}
}, 400)

async function subscribe() {
  const filter = pb.filter('prompt = {:p}', { p: id })
  try {
    track(await pb.collection('reviews').subscribe('*', reloadFeedback, { filter }))
    track(await pb.collection('ratings').subscribe('*', reloadFeedback, { filter }))
    track(await pb.collection('prompts').subscribe(id, (e) => {
      if (e.action === 'delete') {
        toast.info('Этот промпт был удалён.')
        notFound.value = true
        return
      }
      const expand = prompt.value?.expand
      prompt.value = { ...prompt.value, ...e.record, expand }
      if (e.record.category !== expand?.category?.id || e.record.model !== expand?.model?.id) {
        pb.collection('prompts').getOne(id, { expand: 'category,model,author' }).then((p) => (prompt.value = p)).catch(() => {})
      }
    }))
  } catch (_) {}
}

onMounted(async () => {
  await load()
  if (!notFound.value) subscribe()
})
onBeforeUnmount(() => {
  alive = false
  unsubs.forEach((u) => u().catch(() => {}))
})
</script>

<template>
  <NotFoundView v-if="notFound" text="Промпт не найден — возможно, он был удалён автором или администратором." />
  <div v-else-if="!prompt" class="container py-5">
    <div class="skeleton mb-3" style="height: 40px; width: 60%"></div>
    <div class="skeleton mb-3" style="height: 20px; width: 80%"></div>
    <div class="skeleton" style="height: 300px"></div>
  </div>
  <div v-else class="container py-4 py-md-5">
    <nav class="ph-breadcrumb mb-3">
      <RouterLink to="/">Главная</RouterLink> /
      <RouterLink to="/catalog">Каталог</RouterLink> /
      <RouterLink v-if="cat" :to="{ path: '/catalog', query: { category: cat.slug } }">{{ cat.name }}</RouterLink> /
      <span>{{ prompt.title }}</span>
    </nav>

    <div class="row g-4">
      <div class="col-lg-8">
        <div class="d-flex flex-wrap gap-1 mb-2">
          <RouterLink v-if="cat" :to="{ path: '/catalog', query: { category: cat.slug } }" class="chip">{{ cat.icon }} {{ cat.name }}</RouterLink>
          <RouterLink v-if="model" :to="{ path: '/catalog', query: { model: model.slug } }" class="chip">{{ model.name }}</RouterLink>
          <RouterLink v-for="t in prompt.tags || []" :key="t" :to="{ path: '/catalog', query: { q: t } }" class="chip chip-tag">#{{ t }}</RouterLink>
        </div>
        <h1 class="h2 mb-2">{{ prompt.title }}</h1>
        <p class="text-muted mb-1">{{ prompt.description }}</p>
        <p class="small text-muted mb-2">
          Автор: <RouterLink v-if="author" :to="`/authors/${author.id}`">{{ author.name }}</RouterLink> · Опубликовано {{ formatDate(prompt.created) }}
        </p>
        <div class="d-flex align-items-center gap-2 mb-4">
          <StarDisplay :value="prompt.rating_avg" />
          <span class="rating-num">{{ ratingText(prompt.rating_avg) }}</span>
          <span class="text-muted">({{ pluralize(prompt.rating_count, ['оценка', 'оценки', 'оценок']) }}) · <a href="#reviews">{{ pluralize(prompt.reviews_count, ['отзыв', 'отзыва', 'отзывов']) }}</a></span>
        </div>

        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
          <button class="btn btn-primary btn-lg px-4" @click="copy"><i class="bi me-1" :class="copied ? 'bi-check2' : 'bi-clipboard'"></i>{{ copied ? 'Скопировано' : 'Скопировать промпт' }}</button>
          <button class="btn btn-light-ph btn-lg" :class="{ active: fav }" @click="toggleFav"><i class="bi me-1" :class="fav ? 'bi-heart-fill text-danger' : 'bi-heart'"></i>{{ fav ? 'В избранном' : 'В избранное' }}</button>
          <button class="btn btn-light-ph btn-lg" title="Сохранить в подборку" @click="openSel"><i class="bi bi-collection"></i><span class="d-none d-sm-inline ms-1">В подборку</span></button>
          <span class="small text-muted d-none d-md-inline">Скопируется полный текст промпта</span>
        </div>
        <div class="d-flex flex-wrap gap-3 mb-4 small">
          <button v-if="!isOwn" class="btn btn-link btn-sm p-0 text-muted" @click="openReport"><i class="bi bi-flag me-1"></i>Пожаловаться</button>
          <template v-if="canEdit">
            <RouterLink :to="`/prompts/${prompt.id}/edit`" class="btn btn-link btn-sm p-0"><i class="bi bi-pencil me-1"></i>Редактировать</RouterLink>
            <button class="btn btn-link btn-sm p-0 text-danger" @click="removePrompt"><i class="bi bi-trash me-1"></i>Удалить</button>
          </template>
        </div>

        <img v-if="prompt.image" :src="fileUrl(prompt, prompt.image)" class="img-fluid rounded-4 mb-4 border" :alt="prompt.title" style="max-height: 420px; width: 100%; object-fit: cover" />

        <div class="ph-card p-3 p-md-4 mb-4">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h5 class="mb-0">Текст промпта</h5>
            <button class="btn btn-light-ph btn-sm" @click="copy"><i class="bi bi-clipboard me-1"></i>Копировать</button>
          </div>
          <div class="prompt-text">{{ prompt.text }}</div>
          <p class="small text-muted mt-3 mb-0">Замените текст в квадратных скобках на свои данные перед использованием.</p>
        </div>

        <h5>Как использовать</h5>
        <ul class="mb-2">
          <li v-for="(l, i) in usageLines" :key="i">{{ l }}</li>
          <li v-if="!usageLines.length">Скопируйте текст промпта.</li>
          <li v-if="!usageLines.length">Вставьте его в {{ model?.name || 'нейросеть' }} и при необходимости уточните результат.</li>
        </ul>
        <p class="small text-accent mb-5">PromptHub хранит и систематизирует промпты. Ответ генерируется во внешнем сервисе ИИ.</p>

        <!-- Оценки и отзывы -->
        <section id="reviews">
          <h4 class="mb-3">Оценки и отзывы</h4>
          <div class="row g-3 align-items-center mb-4">
            <div class="col-sm-5">
              <div class="d-flex align-items-center gap-2">
                <span class="display-6 fw-bold">{{ ratingText(prompt.rating_avg) }}</span><span class="fs-5 fw-bold">из 5</span>
                <StarDisplay :value="prompt.rating_avg" size="1.3rem" />
              </div>
              <div class="small text-muted">На основе {{ pluralize(prompt.rating_count, ['оценки', 'оценок', 'оценок']) }}</div>
            </div>
            <div class="col-sm-7">
              <div v-for="i in [5, 4, 3, 2, 1]" :key="i" class="d-flex align-items-center gap-2 small">
                <span style="width: 12px">{{ i }}</span><i class="bi bi-star-fill" style="color: var(--ph-star)"></i>
                <div class="rating-bar flex-grow-1"><div :style="{ width: (ratings.length ? (distribution[i - 1] / ratings.length) * 100 : 0) + '%' }"></div></div>
                <span class="text-muted" style="width: 24px; text-align: right">{{ distribution[i - 1] }}</span>
              </div>
            </div>
          </div>

          <div class="ph-card p-3 p-md-4 mb-4">
            <template v-if="!store.isAuth">
              <h6 class="mb-1">Ваша оценка</h6>
              <p class="text-muted small mb-3">Оценивать промпты и писать отзывы могут зарегистрированные пользователи.</p>
              <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }" class="btn btn-primary">Войти, чтобы оценить</RouterLink>
            </template>
            <template v-else-if="isOwn">
              <p class="text-muted small mb-0"><i class="bi bi-info-circle me-1"></i>Это ваш промпт — оценки ставят другие участники.</p>
            </template>
            <template v-else-if="myRating && !editing">
              <h6 class="mb-2">Ваша оценка</h6>
              <StarDisplay :value="myRating.value" size="1.3rem" />
              <p v-if="myReview" class="mt-2 mb-3">{{ myReview.text }}</p>
              <p v-else class="text-muted small mt-2 mb-3">Отзыв не написан.</p>
              <div class="d-flex gap-2">
                <button class="btn btn-light-ph btn-sm" @click="editing = true"><i class="bi bi-pencil me-1"></i>Изменить</button>
                <button class="btn btn-outline-danger btn-sm" @click="deleteMine"><i class="bi bi-trash me-1"></i>Удалить</button>
              </div>
            </template>
            <form v-else @submit.prevent="saveReview">
              <h6 class="mb-2">Ваша оценка</h6>
              <StarInput v-model="form.value" class="mb-3" />
              <textarea v-model="form.text" class="form-control mb-1" rows="4" maxlength="1000" placeholder="Поделитесь, чем был полезен этот промпт…"></textarea>
              <div class="small text-muted text-end mb-2">{{ form.text.length }}/1000</div>
              <div class="d-flex gap-2">
                <button class="btn btn-primary" :disabled="saving">{{ myRating ? 'Сохранить изменения' : 'Отправить отзыв' }}</button>
                <button v-if="editing" type="button" class="btn btn-light-ph" @click="editing = false; loadRatings()">Отмена</button>
              </div>
              <p class="small text-muted mt-2 mb-0">Вы можете изменить или удалить свою оценку и отзыв позже. Текст отзыва необязателен.</p>
            </form>
          </div>

          <div class="d-grid gap-3">
            <div v-for="r in reviews" :key="r.id" class="ph-card p-3">
              <div class="d-flex align-items-center gap-2 mb-2">
                <UserAvatar :user="r.expand?.user" :size="32" />
                <RouterLink :to="`/authors/${r.user}`" class="fw-bold text-body text-decoration-none">{{ r.expand?.user?.name || 'Пользователь' }}</RouterLink>
                <span class="small text-muted">{{ formatDate(r.created) }}</span>
                <button v-if="store.isAdmin && r.user !== store.user?.id" class="btn btn-link btn-sm text-danger ms-auto p-0" title="Удалить отзыв" @click="adminDeleteReview(r)"><i class="bi bi-trash"></i></button>
              </div>
              <StarDisplay v-if="ratingMap[r.user]" :value="ratingMap[r.user]" size=".85rem" />
              <p class="mb-0 mt-1">{{ r.text }}</p>
            </div>
            <div v-if="!reviews.length" class="text-muted small">Отзывов пока нет — станьте первым!</div>
          </div>
          <button v-if="reviewsPage < reviewsTotalPages" class="btn btn-link mt-2 px-0" @click="loadReviews(reviewsPage + 1)">Показать ещё отзывы</button>
        </section>
      </div>

      <aside class="col-lg-4">
        <div class="ph-card p-4 mb-3">
          <h6 class="fw-bold mb-3">Автор промпта</h6>
          <div class="d-flex align-items-center gap-2 mb-2">
            <UserAvatar :user="author" :size="42" />
            <div>
              <div class="fw-bold">{{ author?.name }}</div>
              <RouterLink :to="`/authors/${prompt.author}`" class="small">Перейти к профилю автора</RouterLink>
            </div>
          </div>
          <div class="small text-muted">{{ pluralize(authorCount, ['промпт', 'промпта', 'промптов']) }}</div>
          <div class="small text-muted">На PromptHub {{ sinceText(author?.created) }}</div>
        </div>

        <div class="ph-card p-4 mb-3">
          <h6 class="fw-bold mb-3">Информация о промпте</h6>
          <dl class="row small mb-0 gy-1">
            <dt class="col-5 fw-normal text-muted">Категория</dt><dd class="col-7 mb-0">{{ cat?.name }}</dd>
            <dt class="col-5 fw-normal text-muted">Модель</dt><dd class="col-7 mb-0">{{ model?.name }}</dd>
            <dt class="col-5 fw-normal text-muted">Опубликован</dt><dd class="col-7 mb-0">{{ formatDate(prompt.created) }}</dd>
            <dt class="col-5 fw-normal text-muted">Обновлён</dt><dd class="col-7 mb-0">{{ formatDate(prompt.edited || prompt.updated) }}</dd>
            <dt class="col-5 fw-normal text-muted">Просмотры</dt><dd class="col-7 mb-0">{{ prompt.views }}</dd>
            <dt class="col-5 fw-normal text-muted">Оценки</dt><dd class="col-7 mb-0">{{ prompt.rating_count }}</dd>
            <dt class="col-5 fw-normal text-muted">Длина</dt><dd class="col-7 mb-0">{{ prompt.text.length }} симв.</dd>
          </dl>
        </div>

        <div v-if="similar.length" class="ph-card p-4">
          <h6 class="fw-bold mb-3">Похожие промпты</h6>
          <div class="d-grid gap-2">
            <RouterLink v-for="s in similar" :key="s.id" :to="`/prompts/${s.id}`" class="ph-card p-3 text-decoration-none text-body cat-tile align-items-start text-start">
              <span class="fw-semibold">{{ s.title }}</span>
              <span class="small text-muted">{{ s.expand?.model?.name }} · <i class="bi bi-star-fill" style="color: var(--ph-star)"></i> {{ ratingText(s.rating_avg) }}</span>
            </RouterLink>
          </div>
        </div>
      </aside>
    </div>

    <SelectionModal v-if="showSel" :prompt-id="prompt.id" @close="showSel = false" />
    <ReportModal v-if="showReport" :prompt-id="prompt.id" @close="showReport = false" />
  </div>
</template>
