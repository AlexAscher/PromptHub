<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pb, errorMessage } from '../pb'
import { store, loadDictionaries } from '../store'
import { debounce, countNewReports } from '../realtime'
import { toast } from '../toast'
import SelectMenu from '../components/SelectMenu.vue'
import { formatDate, ratingText, REPORT_REASONS, REPORT_STATUSES } from '../utils'
import UserAvatar from '../components/UserAvatar.vue'
import PaginationBar from '../components/PaginationBar.vue'
import BaseModal from '../components/BaseModal.vue'

const route = useRoute()
const router = useRouter()
const TABS = [
  { id: 'dashboard', label: 'Сводка', icon: 'bi-speedometer2' },
  { id: 'reports', label: 'Жалобы', icon: 'bi-flag' },
  { id: 'prompts', label: 'Промпты', icon: 'bi-file-text' },
  { id: 'reviews', label: 'Отзывы', icon: 'bi-chat-left-text' },
  { id: 'users', label: 'Пользователи', icon: 'bi-people' },
  { id: 'categories', label: 'Категории', icon: 'bi-grid' },
  { id: 'models', label: 'Модели ИИ', icon: 'bi-cpu' },
]
const tab = computed(() => (TABS.some((t) => t.id === route.query.tab) ? route.query.tab : 'dashboard'))
const setTab = (id) => router.replace({ query: { tab: id } })
const confirmAsk = (m) => window.confirm(m)

// ---------- Сводка ----------
const dash = reactive({ users: 0, blocked: 0, prompts: 0, promptsWeek: 0, reviews: 0, ratings: 0, newReports: 0, latestReports: [], latestUsers: [] })
async function loadDashboard() {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().replace('T', ' ')
  const [u, b, p, pw, rv, rt, nr, lu] = await Promise.all([
    pb.collection('users').getList(1, 1, { fields: 'id' }),
    pb.collection('users').getList(1, 1, { filter: 'is_active = false', fields: 'id' }),
    pb.collection('prompts').getList(1, 1, { fields: 'id' }),
    pb.collection('prompts').getList(1, 1, { filter: pb.filter('created >= {:d}', { d: weekAgo }), fields: 'id' }),
    pb.collection('reviews').getList(1, 1, { fields: 'id' }),
    pb.collection('ratings').getList(1, 1, { fields: 'id' }),
    pb.collection('reports').getList(1, 5, { filter: 'status = "new"', sort: '-created', expand: 'user' }),
    pb.collection('users').getList(1, 5, { sort: '-created' }),
  ])
  Object.assign(dash, {
    users: u.totalItems, blocked: b.totalItems, prompts: p.totalItems, promptsWeek: pw.totalItems,
    reviews: rv.totalItems, ratings: rt.totalItems, newReports: nr.totalItems, latestReports: nr.items, latestUsers: lu.items,
  })
}

// ---------- Жалобы ----------
const rep = reactive({ status: 'new', items: [], page: 1, totalPages: 0, total: 0 })
const decisionFor = ref(null)
const decisionText = ref('')
async function loadReports(page = 1) {
  const res = await pb.collection('reports').getList(page, 10, {
    filter: rep.status ? pb.filter('status = {:s}', { s: rep.status }) : '',
    sort: '-created',
    expand: 'user,prompt,prompt_author',
  })
  Object.assign(rep, { items: res.items, page, totalPages: res.totalPages, total: res.totalItems })
}
function openDecision(r, action) {
  decisionFor.value = { report: r, action }
  decisionText.value = {
    delete: 'Промпт удалён как нарушающий правила публикации.',
    block: 'Аккаунт автора заблокирован, промпт удалён.',
    reject: 'Нарушений не обнаружено.',
  }[action]
}
async function applyDecision() {
  const { report: r, action } = decisionFor.value
  try {
    if ((action === 'delete' || action === 'block') && r.prompt) {
      await pb.collection('prompts').delete(r.prompt).catch((e) => { if (e.status !== 404) throw e })
    }
    if (action === 'block' && r.prompt_author) {
      await pb.collection('users').update(r.prompt_author, { is_active: false })
    }
    await pb.collection('reports').update(r.id, { status: action === 'reject' ? 'rejected' : 'resolved', decision: decisionText.value.trim() })
    // другие новые жалобы на этот же промпт тоже закрываются
    if (action !== 'reject' && r.prompt) {
      const others = await pb.collection('reports').getFullList({ filter: pb.filter('prompt = {:p} && status = "new" && id != {:id}', { p: r.prompt, id: r.id }) })
      await Promise.all(others.map((o) => pb.collection('reports').update(o.id, { status: 'resolved', decision: decisionText.value.trim() })))
    }
    toast.success('Решение по жалобе сохранено')
    countNewReports()
    decisionFor.value = null
    loadReports(rep.page)
  } catch (e) { toast.error(errorMessage(e)) }
}

// ---------- Промпты ----------
const pr = reactive({ q: '', items: [], page: 1, totalPages: 0, total: 0 })
async function loadPrompts(page = 1) {
  const res = await pb.collection('prompts').getList(page, 15, {
    filter: pr.q ? pb.filter('(title ~ {:q} || text ~ {:q} || author.name ~ {:q})', { q: pr.q }) : '',
    sort: '-created',
    expand: 'author,category,model',
  })
  Object.assign(pr, { items: res.items, page, totalPages: res.totalPages, total: res.totalItems })
}
async function deletePrompt(p) {
  if (!confirmAsk(`Удалить промпт «${p.title}»?`)) return
  try { await pb.collection('prompts').delete(p.id); toast.success('Промпт удалён'); loadPrompts(pr.page) } catch (e) { toast.error(errorMessage(e)) }
}

// ---------- Отзывы ----------
const rv = reactive({ items: [], page: 1, totalPages: 0, total: 0 })
async function loadReviews(page = 1) {
  const res = await pb.collection('reviews').getList(page, 15, { sort: '-created', expand: 'user,prompt' })
  Object.assign(rv, { items: res.items, page, totalPages: res.totalPages, total: res.totalItems })
}
async function deleteReview(r) {
  if (!confirmAsk('Удалить отзыв?')) return
  try { await pb.collection('reviews').delete(r.id); toast.success('Отзыв удалён'); loadReviews(rv.page) } catch (e) { toast.error(errorMessage(e)) }
}

// ---------- Пользователи ----------
const us = reactive({ q: '', filter: '', items: [], page: 1, totalPages: 0, total: 0 })
async function loadUsers(page = 1) {
  const parts = []
  if (us.q) parts.push(pb.filter('(name ~ {:q} || email ~ {:q})', { q: us.q }))
  if (us.filter === 'blocked') parts.push('is_active = false')
  if (us.filter === 'admin') parts.push('role = "admin"')
  const res = await pb.collection('users').getList(page, 15, { filter: parts.join(' && '), sort: '-created' })
  Object.assign(us, { items: res.items, page, totalPages: res.totalPages, total: res.totalItems })
}
async function setActive(u, active) {
  if (!confirmAsk(active ? `Разблокировать ${u.name}?` : `Заблокировать ${u.name}? Пользователь не сможет войти в систему.`)) return
  try {
    await pb.collection('users').update(u.id, { is_active: active })
    toast.success(active ? 'Аккаунт разблокирован' : 'Аккаунт заблокирован')
    loadUsers(us.page)
  } catch (e) { toast.error(errorMessage(e)) }
}
async function setRole(u, role) {
  if (!confirmAsk(role === 'admin' ? `Назначить ${u.name} администратором?` : `Снять права администратора с ${u.name}?`)) return
  try {
    await pb.collection('users').update(u.id, { role })
    toast.success('Роль изменена')
    loadUsers(us.page)
  } catch (e) { toast.error(errorMessage(e)) }
}

// ---------- Справочники (категории и модели) ----------
const dictEdit = ref(null)
function editDict(kind, rec) {
  dictEdit.value = { kind, id: rec?.id || null, name: rec?.name || '', slug: rec?.slug || '', icon: rec?.icon || '', description: rec?.description || '', sort: rec?.sort || 0 }
}
async function saveDict() {
  const d = dictEdit.value
  const col = d.kind === 'categories' ? 'categories' : 'ai_models'
  const data = { name: d.name.trim(), slug: d.slug.trim().toLowerCase(), sort: Number(d.sort) || 0 }
  if (col === 'categories') Object.assign(data, { icon: d.icon.trim(), description: d.description.trim() })
  try {
    if (d.id) await pb.collection(col).update(d.id, data)
    else await pb.collection(col).create(data)
    toast.success('Сохранено')
    dictEdit.value = null
    await loadDictionaries(true)
  } catch (e) { toast.error(errorMessage(e)) }
}
async function deleteDict(kind, rec) {
  const col = kind === 'categories' ? 'categories' : 'ai_models'
  const count = (kind === 'categories' ? store.stats.categories : store.stats.models)?.[rec.id] || 0
  if (count) return toast.error(`Нельзя удалить: используется в ${count} промптах. Сначала перенесите их.`)
  if (!confirmAsk(`Удалить «${rec.name}»?`)) return
  try { await pb.collection(col).delete(rec.id); toast.success('Удалено'); await loadDictionaries(true) } catch (e) { toast.error(errorMessage(e)) }
}

const loaders = { dashboard: loadDashboard, reports: loadReports, prompts: loadPrompts, reviews: loadReviews, users: loadUsers, categories: () => loadDictionaries(true), models: () => loadDictionaries(true) }
watch(tab, (t) => Promise.resolve(loaders[t]?.()).catch((e) => toast.error(errorMessage(e))), { immediate: true })

// Жалобы приходят в реальном времени: открытая вкладка обновляется сама
const reloadOnReports = debounce(() => {
  if (tab.value === 'reports') loadReports(rep.page).catch(() => {})
  if (tab.value === 'dashboard') loadDashboard().catch(() => {})
}, 400)
watch(() => store.reportsTick, reloadOnReports)
countNewReports()
const statusClass = (s) => ({ new: 'text-bg-warning', resolved: 'text-bg-success', rejected: 'text-bg-secondary' }[s])
</script>

<template>
  <div v-if="store.user" class="container py-4 py-md-5">
    <div class="d-flex align-items-center gap-2 mb-4">
      <h1 class="h3 mb-0"><i class="bi bi-shield-lock text-accent me-2"></i>Панель администратора</h1>
      <a href="/_/" target="_blank" rel="noopener" class="btn btn-sm btn-light-ph ms-auto" title="Служебная панель базы данных PocketBase: прямой доступ ко всем таблицам, файлам, настройкам почты и логам. Вход: admin@prompthub.local"><i class="bi bi-database me-1"></i>База данных</a>
    </div>
    <div class="row g-4">
      <div class="col-lg-3">
        <nav class="ph-card p-2 nav nav-pills flex-lg-column flex-nowrap overflow-auto">
          <button v-for="t in TABS" :key="t.id" class="nav-link text-start text-nowrap d-flex align-items-center" :class="{ active: tab === t.id }" @click="setTab(t.id)">
            <i class="bi me-2" :class="t.icon"></i>{{ t.label }}
            <span v-if="t.id === 'reports' && store.newReports" class="badge rounded-pill text-bg-danger ms-auto">{{ store.newReports }}</span>
          </button>
        </nav>
      </div>

      <div class="col-lg-9">
        <!-- Сводка -->
        <section v-if="tab === 'dashboard'">
          <div class="row g-3 mb-4">
            <div class="col-6 col-xl-3"><div class="ph-card p-3 stat-card"><div class="small text-muted">Пользователи</div><div class="num">{{ dash.users }}</div><div class="small text-muted">заблокировано: {{ dash.blocked }}</div></div></div>
            <div class="col-6 col-xl-3"><div class="ph-card p-3 stat-card"><div class="small text-muted">Промпты</div><div class="num">{{ dash.prompts }}</div><div class="small text-muted">за неделю: +{{ dash.promptsWeek }}</div></div></div>
            <div class="col-6 col-xl-3"><div class="ph-card p-3 stat-card"><div class="small text-muted">Оценки / отзывы</div><div class="num">{{ dash.ratings }}</div><div class="small text-muted">отзывов: {{ dash.reviews }}</div></div></div>
            <div class="col-6 col-xl-3"><div class="ph-card p-3 stat-card" :class="{ 'border-danger': dash.newReports }"><div class="small text-muted">Новые жалобы</div><div class="num" :class="{ 'text-danger': dash.newReports }">{{ dash.newReports }}</div><a href="#" class="small" @click.prevent="setTab('reports')">Рассмотреть →</a></div></div>
          </div>
          <div class="row g-3">
            <div class="col-xl-7">
              <div class="ph-card p-3 h-100">
                <h6 class="fw-bold">Новые жалобы</h6>
                <div v-if="!dash.latestReports.length" class="small text-muted">Новых жалоб нет 🎉</div>
                <div v-for="r in dash.latestReports" :key="r.id" class="d-flex align-items-center gap-2 py-2 border-top small">
                  <span class="chip">{{ REPORT_REASONS[r.reason] }}</span>
                  <span class="text-truncate">{{ r.prompt_title }}</span>
                  <span class="text-muted ms-auto text-nowrap">{{ formatDate(r.created) }}</span>
                </div>
              </div>
            </div>
            <div class="col-xl-5">
              <div class="ph-card p-3 h-100">
                <h6 class="fw-bold">Новые пользователи</h6>
                <div v-for="u in dash.latestUsers" :key="u.id" class="d-flex align-items-center gap-2 py-2 border-top small">
                  <UserAvatar :user="u" :size="26" /><span class="text-truncate">{{ u.name }}</span><span class="text-muted ms-auto text-nowrap">{{ formatDate(u.created) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Жалобы -->
        <section v-else-if="tab === 'reports'">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
            <h2 class="h4 mb-0 me-auto">Жалобы <span class="text-muted fs-6">{{ rep.total }}</span></h2>
            <SelectMenu v-model="rep.status" aria-label="Статус жалоб" @change="loadReports(1)"
                        :options="[{ value: 'new', label: 'Новые' }, { value: 'resolved', label: 'Решённые' }, { value: 'rejected', label: 'Отклонённые' }, { value: '', label: 'Все' }]" />
          </div>
          <div v-if="!rep.items.length" class="ph-card empty-state"><i class="bi bi-check2-circle"></i>Жалоб нет.</div>
          <div class="d-grid gap-3">
            <div v-for="r in rep.items" :key="r.id" class="ph-card p-3">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span class="chip chip-accent">{{ REPORT_REASONS[r.reason] }}</span>
                <span class="badge" :class="statusClass(r.status)">{{ REPORT_STATUSES[r.status] }}</span>
                <span class="small text-muted ms-auto">{{ formatDate(r.created) }} · от {{ r.expand?.user?.name || '—' }}</span>
              </div>
              <div class="mb-1">
                Промпт:
                <RouterLink v-if="r.prompt" :to="`/prompts/${r.prompt}`" target="_blank" class="fw-semibold">{{ r.prompt_title }}</RouterLink>
                <span v-else class="fw-semibold">{{ r.prompt_title }} <span class="text-muted fw-normal small">(удалён)</span></span>
                <span v-if="r.expand?.prompt_author" class="small text-muted"> · автор <RouterLink :to="`/authors/${r.prompt_author}`">{{ r.expand.prompt_author.name }}</RouterLink><span v-if="r.expand.prompt_author.is_active === false" class="badge text-bg-danger ms-1">заблокирован</span></span>
              </div>
              <p v-if="r.comment" class="small mb-2 p-2 rounded-3" style="background: var(--ph-chip)">{{ r.comment }}</p>
              <div v-if="r.decision" class="small mb-2"><b>Решение:</b> {{ r.decision }}</div>
              <div v-if="r.status === 'new'" class="d-flex flex-wrap gap-2">
                <button class="btn btn-sm btn-danger" :disabled="!r.prompt" @click="openDecision(r, 'delete')"><i class="bi bi-trash me-1"></i>Удалить промпт</button>
                <button class="btn btn-sm btn-outline-danger" :disabled="!r.prompt_author" @click="openDecision(r, 'block')"><i class="bi bi-person-x me-1"></i>Удалить и заблокировать автора</button>
                <button class="btn btn-sm btn-light-ph" @click="openDecision(r, 'reject')"><i class="bi bi-x-circle me-1"></i>Отклонить</button>
              </div>
            </div>
          </div>
          <PaginationBar :page="rep.page" :total-pages="rep.totalPages" :total-items="rep.total" :per-page="10" @change="loadReports" />
        </section>

        <!-- Промпты -->
        <section v-else-if="tab === 'prompts'">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
            <h2 class="h4 mb-0 me-auto">Промпты <span class="text-muted fs-6">{{ pr.total }}</span></h2>
            <form class="ph-search" @submit.prevent="loadPrompts(1)"><i class="bi bi-search text-muted"></i><input v-model="pr.q" type="search" placeholder="Название, текст, автор" /><button class="btn btn-primary btn-sm">Найти</button></form>
          </div>
          <div class="ph-card table-responsive">
            <table class="table align-middle mb-0 small">
              <thead class="text-muted"><tr><th>Название</th><th class="d-none d-md-table-cell">Автор</th><th class="d-none d-xl-table-cell">Категория / модель</th><th>Рейтинг</th><th class="d-none d-xxl-table-cell">Дата</th><th class="text-end">Действия</th></tr></thead>
              <tbody>
                <tr v-for="p in pr.items" :key="p.id">
                  <td><RouterLink :to="`/prompts/${p.id}`" class="fw-semibold text-body">{{ p.title }}</RouterLink><div class="d-md-none text-muted">{{ p.expand?.author?.name }}</div></td>
                  <td class="d-none d-md-table-cell"><RouterLink :to="`/authors/${p.author}`">{{ p.expand?.author?.name }}</RouterLink></td>
                  <td class="d-none d-xl-table-cell">{{ p.expand?.category?.name }} / {{ p.expand?.model?.name }}</td>
                  <td class="text-nowrap">{{ ratingText(p.rating_avg) }} ({{ p.rating_count }})</td>
                  <td class="d-none d-xxl-table-cell text-nowrap">{{ formatDate(p.created) }}</td>
                  <td class="text-end text-nowrap">
                    <RouterLink :to="`/prompts/${p.id}/edit`" class="btn btn-sm btn-light-ph" title="Редактировать"><i class="bi bi-pencil"></i></RouterLink>
                    <button class="btn btn-sm btn-outline-danger ms-1" title="Удалить" @click="deletePrompt(p)"><i class="bi bi-trash"></i></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar :page="pr.page" :total-pages="pr.totalPages" :total-items="pr.total" :per-page="15" @change="loadPrompts" />
        </section>

        <!-- Отзывы -->
        <section v-else-if="tab === 'reviews'">
          <h2 class="h4 mb-3">Отзывы <span class="text-muted fs-6">{{ rv.total }}</span></h2>
          <div class="d-grid gap-2">
            <div v-for="r in rv.items" :key="r.id" class="ph-card p-3 d-flex gap-3 align-items-start">
              <UserAvatar :user="r.expand?.user" :size="32" />
              <div class="flex-grow-1 min-w-0 small">
                <div><b>{{ r.expand?.user?.name }}</b> о <RouterLink :to="`/prompts/${r.prompt}`">{{ r.expand?.prompt?.title }}</RouterLink> · <span class="text-muted">{{ formatDate(r.created) }}</span></div>
                <div class="mt-1">{{ r.text }}</div>
              </div>
              <button class="btn btn-sm btn-outline-danger" title="Удалить" @click="deleteReview(r)"><i class="bi bi-trash"></i></button>
            </div>
          </div>
          <PaginationBar :page="rv.page" :total-pages="rv.totalPages" :total-items="rv.total" :per-page="15" @change="loadReviews" />
        </section>

        <!-- Пользователи -->
        <section v-else-if="tab === 'users'">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
            <h2 class="h4 mb-0 me-auto">Пользователи <span class="text-muted fs-6">{{ us.total }}</span></h2>
            <SelectMenu v-model="us.filter" aria-label="Фильтр пользователей" @change="loadUsers(1)"
                        :options="[{ value: '', label: 'Все' }, { value: 'blocked', label: 'Заблокированные' }, { value: 'admin', label: 'Администраторы' }]" />
            <form class="ph-search" @submit.prevent="loadUsers(1)"><i class="bi bi-search text-muted"></i><input v-model="us.q" type="search" placeholder="Имя или email" /><button class="btn btn-primary btn-sm">Найти</button></form>
          </div>
          <div class="ph-card table-responsive">
            <table class="table align-middle mb-0 small">
              <thead class="text-muted"><tr><th>Пользователь</th><th class="d-none d-md-table-cell">Роль</th><th class="d-none d-md-table-cell">Статус</th><th class="d-none d-xl-table-cell">Регистрация</th><th class="text-end">Действия</th></tr></thead>
              <tbody>
                <tr v-for="u in us.items" :key="u.id">
                  <td class="min-w-0">
                    <div class="d-flex align-items-center gap-2">
                      <UserAvatar :user="u" :size="30" />
                      <div class="min-w-0">
                        <RouterLink :to="`/authors/${u.id}`" class="text-body fw-semibold">{{ u.name }}</RouterLink>
                        <div class="text-muted text-truncate" style="max-width: 220px">{{ u.email }}</div>
                        <div class="d-md-none d-flex flex-wrap gap-1 mt-1">
                          <span class="chip" :class="{ 'chip-accent': u.role === 'admin' }">{{ u.role === 'admin' ? 'Админ' : 'Пользователь' }}</span>
                          <span class="badge" :class="u.is_active ? 'text-bg-success' : 'text-bg-danger'">{{ u.is_active ? 'Активен' : 'Заблокирован' }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="d-none d-md-table-cell"><span class="chip" :class="{ 'chip-accent': u.role === 'admin' }">{{ u.role === 'admin' ? 'Админ' : 'Пользователь' }}</span></td>
                  <td class="d-none d-md-table-cell"><span class="badge" :class="u.is_active ? 'text-bg-success' : 'text-bg-danger'">{{ u.is_active ? 'Активен' : 'Заблокирован' }}</span></td>
                  <td class="d-none d-xl-table-cell text-nowrap">{{ formatDate(u.created) }}</td>
                  <td class="text-end text-nowrap">
                    <template v-if="u.id !== store.user.id">
                      <button v-if="u.is_active" class="btn btn-sm btn-outline-danger" title="Заблокировать аккаунт" @click="setActive(u, false)"><i class="bi bi-lock"></i><span class="d-none d-xxl-inline ms-1">Заблокировать</span></button>
                      <button v-else class="btn btn-sm btn-outline-success" title="Разблокировать аккаунт" @click="setActive(u, true)"><i class="bi bi-unlock"></i><span class="d-none d-xxl-inline ms-1">Разблокировать</span></button>
                      <button class="btn btn-sm btn-light-ph ms-1" :title="u.role === 'admin' ? 'Снять права администратора' : 'Сделать администратором'" @click="setRole(u, u.role === 'admin' ? 'user' : 'admin')"><i class="bi" :class="u.role === 'admin' ? 'bi-shield-minus' : 'bi-shield-plus'"></i></button>
                    </template>
                    <span v-else class="text-muted">это вы</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar :page="us.page" :total-pages="us.totalPages" :total-items="us.total" :per-page="15" :noun="['пользователя', 'пользователей', 'пользователей']" @change="loadUsers" />
        </section>

        <!-- Категории / модели -->
        <section v-else-if="tab === 'categories' || tab === 'models'">
          <div class="d-flex align-items-center mb-3">
            <h2 class="h4 mb-0 me-auto">{{ tab === 'categories' ? 'Категории' : 'Модели ИИ' }}</h2>
            <button class="btn btn-primary" @click="editDict(tab, null)"><i class="bi bi-plus-lg me-1"></i>Добавить</button>
          </div>
          <div class="ph-card table-responsive">
            <table class="table align-middle mb-0 small">
              <thead class="text-muted"><tr><th>#</th><th>Название</th><th>Код</th><th>Промптов</th><th></th></tr></thead>
              <tbody>
                <tr v-for="c in tab === 'categories' ? store.categories : store.models" :key="c.id">
                  <td class="text-muted">{{ c.sort }}</td>
                  <td class="fw-semibold">{{ c.icon }} {{ c.name }}<div v-if="c.description" class="text-muted fw-normal">{{ c.description }}</div></td>
                  <td><code>{{ c.slug }}</code></td>
                  <td>{{ (tab === 'categories' ? store.stats.categories : store.stats.models)?.[c.id] || 0 }}</td>
                  <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-light-ph" title="Редактировать" @click="editDict(tab, c)"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger ms-1" title="Удалить" @click="deleteDict(tab, c)"><i class="bi bi-trash"></i></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

    <BaseModal v-if="decisionFor" title="Решение по жалобе" @close="decisionFor = null">
      <p class="small mb-2">
        <template v-if="decisionFor.action === 'delete'">Промпт «{{ decisionFor.report.prompt_title }}» будет удалён.</template>
        <template v-else-if="decisionFor.action === 'block'">Промпт будет удалён, а аккаунт автора — заблокирован.</template>
        <template v-else>Жалоба будет отклонена, промпт останется в каталоге.</template>
      </p>
      <label class="form-label" for="dec">Комментарий к решению</label>
      <textarea id="dec" v-model="decisionText" class="form-control mb-3" rows="3" maxlength="1000"></textarea>
      <div class="d-flex justify-content-end gap-2">
        <button class="btn btn-light-ph" @click="decisionFor = null">Отмена</button>
        <button class="btn" :class="decisionFor.action === 'reject' ? 'btn-primary' : 'btn-danger'" @click="applyDecision">Подтвердить</button>
      </div>
    </BaseModal>

    <BaseModal v-if="dictEdit" :title="(dictEdit.id ? 'Редактирование: ' : 'Новая запись: ') + (dictEdit.kind === 'categories' ? 'категория' : 'модель ИИ')" @close="dictEdit = null">
      <form @submit.prevent="saveDict">
        <div class="row g-2 mb-2">
          <div :class="dictEdit.kind === 'categories' ? 'col-9' : 'col-12'"><label class="form-label">Название</label><input v-model="dictEdit.name" class="form-control" maxlength="60" required /></div>
          <div v-if="dictEdit.kind === 'categories'" class="col-3"><label class="form-label">Иконка</label><input v-model="dictEdit.icon" class="form-control" maxlength="8" placeholder="📣" /></div>
        </div>
        <div class="row g-2 mb-2">
          <div class="col-8"><label class="form-label">Код (латиница)</label><input v-model="dictEdit.slug" class="form-control" maxlength="60" pattern="[a-z0-9\-]+" required placeholder="marketing" /></div>
          <div class="col-4"><label class="form-label">Порядок</label><input v-model="dictEdit.sort" type="number" class="form-control" /></div>
        </div>
        <div v-if="dictEdit.kind === 'categories'" class="mb-2"><label class="form-label">Описание</label><textarea v-model="dictEdit.description" class="form-control" rows="2" maxlength="300"></textarea></div>
        <div class="d-flex justify-content-end gap-2 mt-3">
          <button type="button" class="btn btn-light-ph" @click="dictEdit = null">Отмена</button>
          <button class="btn btn-primary">Сохранить</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
