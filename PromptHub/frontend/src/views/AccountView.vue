<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pb, errorMessage } from '../pb'
import { store, loadSelections, refreshStats } from '../store'
import { toast } from '../toast'
import { formatDate, ratingText, pluralize, REPORT_REASONS, REPORT_STATUSES } from '../utils'
import UserAvatar from '../components/UserAvatar.vue'
import PromptGrid from '../components/PromptGrid.vue'
import StarDisplay from '../components/StarDisplay.vue'
import PaginationBar from '../components/PaginationBar.vue'

const route = useRoute()
const router = useRouter()
const TABS = [
  { id: 'prompts', label: 'Мои промпты', icon: 'bi-file-text' },
  { id: 'favorites', label: 'Избранное', icon: 'bi-heart' },
  { id: 'selections', label: 'Мои подборки', icon: 'bi-collection' },
  { id: 'reviews', label: 'Отзывы и оценки', icon: 'bi-star' },
  { id: 'reports', label: 'Мои жалобы', icon: 'bi-flag' },
  { id: 'profile', label: 'Профиль', icon: 'bi-gear' },
]
const tab = computed(() => (TABS.some((t) => t.id === route.query.tab) ? route.query.tab : 'prompts'))
const setTab = (id) => router.replace({ query: { tab: id } })

// ---------- Мои промпты ----------
const myPrompts = ref([])
const myPage = ref(1)
const myTotalPages = ref(0)
const myTotal = ref(0)
async function loadMyPrompts(p = 1) {
  const res = await pb.collection('prompts').getList(p, 10, {
    filter: pb.filter('author = {:a}', { a: store.user.id }),
    sort: '-created',
    expand: 'category,model',
  })
  myPrompts.value = res.items
  myPage.value = p
  myTotalPages.value = res.totalPages
  myTotal.value = res.totalItems
}
async function deletePrompt(p) {
  if (!confirm(`Удалить промпт «${p.title}»? Это действие нельзя отменить.`)) return
  try {
    await pb.collection('prompts').delete(p.id)
    toast.success('Промпт удалён')
    refreshStats()
    loadMyPrompts(myPage.value)
  } catch (e) { toast.error(errorMessage(e)) }
}

// ---------- Избранное и подборки ----------
const favPrompts = ref([])
const favLoading = ref(false)
async function loadFavorites() {
  favLoading.value = true
  await loadSelections()
  favPrompts.value = await promptsByIds(store.favorites?.prompts || [])
  favLoading.value = false
}
async function promptsByIds(ids) {
  if (!ids.length) return []
  const filter = ids.map((id) => pb.filter('id = {:id}', { id })).join(' || ')
  const list = await pb.collection('prompts').getFullList({ filter, expand: 'category,model,author' })
  const order = Object.fromEntries(ids.map((id, i) => [id, i]))
  return list.sort((a, b) => order[b.id] - order[a.id])
}

const openSel = ref(null)
const selPrompts = ref([])
const newSelName = ref('')
async function loadSelectionsTab() {
  await loadSelections()
  if (openSel.value) openSelection(store.selections.find((s) => s.id === openSel.value.id) || null)
}
async function openSelection(s) {
  openSel.value = s
  selPrompts.value = s ? await promptsByIds(s.prompts || []) : []
}
async function addSelection() {
  const name = newSelName.value.trim()
  if (!name) return
  try {
    await pb.collection('selections').create({ name, user: store.user.id, is_favorite: false, prompts: [] })
    newSelName.value = ''
    toast.success(`Подборка «${name}» создана`)
    loadSelections()
  } catch (e) { toast.error(errorMessage(e)) }
}
async function renameSelection(s) {
  const name = prompt('Новое название подборки', s.name)
  if (!name || !name.trim() || name === s.name) return
  try {
    const upd = await pb.collection('selections').update(s.id, { name: name.trim() })
    toast.success('Подборка переименована')
    await loadSelections()
    if (openSel.value?.id === s.id) openSel.value = upd
  } catch (e) { toast.error(errorMessage(e)) }
}
async function deleteSelection(s) {
  if (!confirm(`Удалить подборку «${s.name}»? Сами промпты останутся в каталоге.`)) return
  try {
    await pb.collection('selections').delete(s.id)
    toast.success('Подборка удалена')
    if (openSel.value?.id === s.id) openSelection(null)
    loadSelections()
  } catch (e) { toast.error(errorMessage(e)) }
}
async function removeFromSelection(s, promptId) {
  try {
    const upd = await pb.collection('selections').update(s.id, { 'prompts-': promptId })
    toast.success('Промпт убран из подборки')
    await loadSelections()
    openSelection(upd)
  } catch (e) { toast.error(errorMessage(e)) }
}

// ---------- Отзывы и оценки ----------
const myRatings = ref([])
const myReviews = ref({})
async function loadReviews() {
  const [ratings, reviews] = await Promise.all([
    pb.collection('ratings').getFullList({ filter: pb.filter('user = {:u}', { u: store.user.id }), sort: '-updated', expand: 'prompt' }),
    pb.collection('reviews').getFullList({ filter: pb.filter('user = {:u}', { u: store.user.id }) }),
  ])
  myRatings.value = ratings
  myReviews.value = Object.fromEntries(reviews.map((r) => [r.prompt, r]))
}
async function deleteRating(r) {
  if (!confirm('Удалить оценку и отзыв?')) return
  try {
    const rv = myReviews.value[r.prompt]
    if (rv) await pb.collection('reviews').delete(rv.id)
    await pb.collection('ratings').delete(r.id)
    toast.success('Оценка и отзыв удалены')
    loadReviews()
  } catch (e) { toast.error(errorMessage(e)) }
}

// ---------- Жалобы ----------
const myReports = ref([])
async function loadReports() {
  myReports.value = await pb.collection('reports').getFullList({ filter: pb.filter('user = {:u}', { u: store.user.id }), sort: '-created' })
}

// ---------- Профиль ----------
const profile = ref({ name: '', bio: '' })
const avatarFile = ref(null)
const avatarPreview = ref('')
const pass = ref({ oldPassword: '', password: '', passwordConfirm: '' })
const savingProfile = ref(false)
const savingPass = ref(false)
function initProfile() {
  profile.value = { name: store.user.name, bio: store.user.bio || '' }
  avatarFile.value = null
  avatarPreview.value = ''
}
function onAvatar(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  if (!['image/jpeg', 'image/png'].includes(f.type)) return toast.error('Аватар: допустимы только JPG и PNG.')
  if (f.size > 2 * 1024 * 1024) return toast.error('Аватар: размер не должен превышать 2 МБ.')
  avatarFile.value = f
  avatarPreview.value = URL.createObjectURL(f)
}
async function saveProfile() {
  savingProfile.value = true
  try {
    const fd = new FormData()
    fd.append('name', profile.value.name.trim())
    fd.append('bio', profile.value.bio.trim())
    if (avatarFile.value) fd.append('avatar', avatarFile.value)
    const rec = await pb.collection('users').update(store.user.id, fd)
    pb.authStore.save(pb.authStore.token, rec)
    initProfile()
    toast.success('Профиль сохранён')
  } catch (e) { toast.error(errorMessage(e)) } finally { savingProfile.value = false }
}
async function removeAvatar() {
  try {
    const rec = await pb.collection('users').update(store.user.id, { avatar: null })
    pb.authStore.save(pb.authStore.token, rec)
    toast.success('Аватар удалён')
  } catch (e) { toast.error(errorMessage(e)) }
}
async function changePassword() {
  const p = pass.value
  if (p.password.length < 8) return toast.error('Новый пароль должен содержать не менее 8 символов.')
  if (p.password !== p.passwordConfirm) return toast.error('Пароли не совпадают.')
  savingPass.value = true
  try {
    const email = store.user.email
    await pb.collection('users').update(store.user.id, { ...p })
    // после смены пароля текущий токен становится недействительным — входим заново
    await pb.collection('users').authWithPassword(email, p.password)
    pass.value = { oldPassword: '', password: '', passwordConfirm: '' }
    toast.success('Пароль изменён')
  } catch (e) { toast.error(errorMessage(e)) } finally { savingPass.value = false }
}

const loaders = { prompts: loadMyPrompts, favorites: loadFavorites, selections: loadSelectionsTab, reviews: loadReviews, reports: loadReports, profile: initProfile }
watch(tab, (t) => Promise.resolve(loaders[t]?.()).catch((e) => toast.error(errorMessage(e))), { immediate: true })
</script>

<template>
  <div v-if="store.user" class="container py-4 py-md-5">
    <div class="d-flex align-items-center gap-3 mb-4">
      <UserAvatar :user="store.user" :size="64" />
      <div class="min-w-0">
        <h1 class="h3 mb-0 text-truncate">{{ store.user.name }}</h1>
        <div class="text-muted small">{{ store.user.email }} · на PromptHub с {{ formatDate(store.user.created) }}</div>
      </div>
      <RouterLink :to="`/authors/${store.user.id}`" class="btn btn-light-ph ms-auto d-none d-sm-inline-block">Публичный профиль</RouterLink>
    </div>

    <div class="row g-4">
      <div class="col-lg-3">
        <nav class="ph-card p-2 nav nav-pills flex-lg-column flex-nowrap overflow-auto">
          <button v-for="t in TABS" :key="t.id" class="nav-link text-start text-nowrap" :class="{ active: tab === t.id }" @click="setTab(t.id)">
            <i class="bi me-2" :class="t.icon"></i>{{ t.label }}
          </button>
        </nav>
      </div>

      <div class="col-lg-9">
        <!-- Мои промпты -->
        <section v-if="tab === 'prompts'">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h2 class="h4 mb-0">Мои промпты <span class="text-muted fs-6">{{ myTotal }}</span></h2>
            <RouterLink to="/prompts/new" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Добавить промпт</RouterLink>
          </div>
          <div v-if="!myPrompts.length" class="ph-card empty-state">
            <i class="bi bi-file-earmark-plus"></i>
            <div class="fw-semibold text-body mb-2">Вы ещё не опубликовали ни одного промпта</div>
            <RouterLink to="/prompts/new" class="btn btn-soft btn-sm">Опубликовать первый</RouterLink>
          </div>
          <div v-else class="ph-card">
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead class="small text-muted"><tr><th>Название</th><th class="d-none d-md-table-cell">Категория</th><th>Рейтинг</th><th class="d-none d-sm-table-cell">Просмотры</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="p in myPrompts" :key="p.id">
                    <td><RouterLink :to="`/prompts/${p.id}`" class="fw-semibold text-body">{{ p.title }}</RouterLink><div class="small text-muted">{{ formatDate(p.created) }} · {{ p.expand?.model?.name }}</div></td>
                    <td class="d-none d-md-table-cell small">{{ p.expand?.category?.name }}</td>
                    <td class="small text-nowrap"><i class="bi bi-star-fill" style="color: var(--ph-star)"></i> {{ ratingText(p.rating_avg) }} <span class="text-muted">({{ p.rating_count }})</span></td>
                    <td class="d-none d-sm-table-cell small">{{ p.views }}</td>
                    <td class="text-end text-nowrap">
                      <RouterLink :to="`/prompts/${p.id}/edit`" class="btn btn-sm btn-light-ph" title="Редактировать"><i class="bi bi-pencil"></i></RouterLink>
                      <button class="btn btn-sm btn-outline-danger ms-1" title="Удалить" @click="deletePrompt(p)"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <PaginationBar :page="myPage" :total-pages="myTotalPages" :total-items="myTotal" :per-page="10" @change="loadMyPrompts" />
        </section>

        <!-- Избранное -->
        <section v-else-if="tab === 'favorites'">
          <h2 class="h4 mb-3">Избранное <span class="text-muted fs-6">{{ favPrompts.length }}</span></h2>
          <PromptGrid :items="favPrompts" :loading="favLoading" cols="col-md-6 col-xl-4" empty-text="В избранном пока пусто">
            <template #empty>
              <div class="small mb-3">Нажмите ♡ на карточке промпта, чтобы сохранить его здесь.</div>
              <RouterLink to="/catalog" class="btn btn-soft btn-sm">Перейти в каталог</RouterLink>
            </template>
          </PromptGrid>
        </section>

        <!-- Подборки -->
        <section v-else-if="tab === 'selections'">
          <template v-if="!openSel">
            <h2 class="h4 mb-1">Мои подборки</h2>
            <p class="text-muted small mb-3">Подборки приватны — их видите только вы. Добавляйте промпты кнопкой «В подборку» на странице промпта.</p>
            <form class="d-flex gap-2 mb-3" @submit.prevent="addSelection">
              <input v-model="newSelName" class="form-control" maxlength="100" placeholder="Название новой подборки" />
              <button class="btn btn-primary flex-shrink-0" :disabled="!newSelName.trim()"><i class="bi bi-plus-lg me-1"></i>Создать</button>
            </form>
            <div class="row g-3">
              <div v-for="s in store.selections" :key="s.id" class="col-md-6">
                <div class="ph-card p-3 d-flex align-items-center gap-3 h-100">
                  <span class="cat-icon mb-0"><i class="bi bi-collection"></i></span>
                  <button class="btn btn-link text-body text-decoration-none text-start p-0 flex-grow-1 min-w-0" @click="openSelection(s)">
                    <div class="fw-bold text-truncate">{{ s.name }}</div>
                    <div class="small text-muted">{{ pluralize(s.prompts?.length || 0, ['промпт', 'промпта', 'промптов']) }}</div>
                  </button>
                  <button class="btn btn-sm btn-light-ph" title="Переименовать" @click="renameSelection(s)"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" title="Удалить" @click="deleteSelection(s)"><i class="bi bi-trash"></i></button>
                </div>
              </div>
              <div v-if="!store.selections.length" class="col-12"><div class="ph-card empty-state"><i class="bi bi-collection"></i>У вас пока нет подборок.</div></div>
            </div>
          </template>
          <template v-else>
            <button class="btn btn-link px-0 mb-2" @click="openSelection(null)"><i class="bi bi-arrow-left me-1"></i>Все подборки</button>
            <div class="d-flex align-items-center gap-2 mb-3">
              <h2 class="h4 mb-0">{{ openSel.name }}</h2>
              <button class="btn btn-sm btn-light-ph" @click="renameSelection(openSel)"><i class="bi bi-pencil"></i></button>
            </div>
            <div v-if="!selPrompts.length" class="ph-card empty-state"><i class="bi bi-inbox"></i>В подборке пока нет промптов.</div>
            <div class="d-grid gap-2">
              <div v-for="p in selPrompts" :key="p.id" class="ph-card p-3 d-flex align-items-center gap-3">
                <div class="flex-grow-1 min-w-0">
                  <RouterLink :to="`/prompts/${p.id}`" class="fw-bold text-body">{{ p.title }}</RouterLink>
                  <div class="small text-muted text-truncate">{{ p.expand?.category?.name }} · {{ p.expand?.model?.name }} · {{ p.description }}</div>
                </div>
                <button class="btn btn-sm btn-light-ph" title="Убрать из подборки" @click="removeFromSelection(openSel, p.id)"><i class="bi bi-x-lg"></i></button>
              </div>
            </div>
          </template>
        </section>

        <!-- Отзывы и оценки -->
        <section v-else-if="tab === 'reviews'">
          <h2 class="h4 mb-3">Мои отзывы и оценки</h2>
          <div v-if="!myRatings.length" class="ph-card empty-state"><i class="bi bi-star"></i>Вы ещё не оценивали промпты.</div>
          <div class="d-grid gap-2">
            <div v-for="r in myRatings" :key="r.id" class="ph-card p-3">
              <div class="d-flex align-items-start gap-2">
                <div class="flex-grow-1 min-w-0">
                  <RouterLink :to="`/prompts/${r.prompt}#reviews`" class="fw-bold text-body">{{ r.expand?.prompt?.title || 'Промпт удалён' }}</RouterLink>
                  <div><StarDisplay :value="r.value" size=".9rem" /> <span class="small text-muted ms-1">{{ formatDate(r.updated) }}</span></div>
                  <p v-if="myReviews[r.prompt]" class="mb-0 mt-1 small">{{ myReviews[r.prompt].text }}</p>
                </div>
                <RouterLink :to="`/prompts/${r.prompt}#reviews`" class="btn btn-sm btn-light-ph" title="Изменить"><i class="bi bi-pencil"></i></RouterLink>
                <button class="btn btn-sm btn-outline-danger" title="Удалить" @click="deleteRating(r)"><i class="bi bi-trash"></i></button>
              </div>
            </div>
          </div>
        </section>

        <!-- Жалобы -->
        <section v-else-if="tab === 'reports'">
          <h2 class="h4 mb-3">Мои жалобы</h2>
          <div v-if="!myReports.length" class="ph-card empty-state"><i class="bi bi-flag"></i>Вы не отправляли жалоб.</div>
          <div class="d-grid gap-2">
            <div v-for="r in myReports" :key="r.id" class="ph-card p-3">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                <RouterLink v-if="r.prompt" :to="`/prompts/${r.prompt}`" class="fw-bold text-body">{{ r.prompt_title }}</RouterLink>
                <span v-else class="fw-bold">{{ r.prompt_title }} <span class="small text-muted fw-normal">(удалён)</span></span>
                <span class="chip">{{ REPORT_REASONS[r.reason] }}</span>
                <span class="badge" :class="{ 'text-bg-warning': r.status === 'new', 'text-bg-success': r.status === 'resolved', 'text-bg-secondary': r.status === 'rejected' }">{{ REPORT_STATUSES[r.status] }}</span>
                <span class="small text-muted ms-auto">{{ formatDate(r.created) }}</span>
              </div>
              <div v-if="r.decision" class="small"><b>Решение:</b> {{ r.decision }}</div>
            </div>
          </div>
        </section>

        <!-- Профиль -->
        <section v-else-if="tab === 'profile'">
          <h2 class="h4 mb-3">Профиль</h2>
          <form class="ph-card p-4 mb-4" @submit.prevent="saveProfile">
            <div class="d-flex align-items-center gap-3 mb-4">
              <span v-if="avatarPreview" class="avatar" style="width: 80px; height: 80px"><img :src="avatarPreview" alt="" /></span>
              <UserAvatar v-else :user="store.user" :size="80" />
              <div>
                <label class="btn btn-light-ph btn-sm"><i class="bi bi-upload me-1"></i>Загрузить аватар<input type="file" accept="image/jpeg,image/png" hidden @change="onAvatar" /></label>
                <button v-if="store.user.avatar && !avatarPreview" type="button" class="btn btn-link btn-sm text-danger" @click="removeAvatar">Удалить</button>
                <div class="small text-muted mt-1">JPG или PNG, до 2 МБ</div>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="p-name">Никнейм</label>
              <input id="p-name" v-model="profile.name" class="form-control" maxlength="40" required />
            </div>
            <div class="mb-3">
              <label class="form-label" for="p-bio">О себе</label>
              <textarea id="p-bio" v-model="profile.bio" class="form-control" rows="3" maxlength="500" placeholder="Расскажите, чем вы занимаетесь"></textarea>
            </div>
            <div class="mb-3">
              <label class="form-label">Email</label>
              <input class="form-control" :value="store.user.email" disabled />
            </div>
            <button class="btn btn-primary" :disabled="savingProfile">Сохранить профиль</button>
          </form>

          <form class="ph-card p-4" @submit.prevent="changePassword">
            <h5 class="mb-3">Смена пароля</h5>
            <div class="row g-3 mb-3">
              <div class="col-md-4"><label class="form-label" for="pw0">Текущий пароль</label><input id="pw0" v-model="pass.oldPassword" type="password" class="form-control" autocomplete="current-password" required /></div>
              <div class="col-md-4"><label class="form-label" for="pw1">Новый пароль</label><input id="pw1" v-model="pass.password" type="password" class="form-control" autocomplete="new-password" required /></div>
              <div class="col-md-4"><label class="form-label" for="pw2">Повторите</label><input id="pw2" v-model="pass.passwordConfirm" type="password" class="form-control" autocomplete="new-password" required /></div>
            </div>
            <button class="btn btn-primary" :disabled="savingPass">Изменить пароль</button>
          </form>
        </section>
      </div>
    </div>
  </div>
</template>
