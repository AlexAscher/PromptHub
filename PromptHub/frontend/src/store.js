import { reactive } from 'vue'
import { pb, errorMessage } from './pb'
import { toast } from './toast'

// Глобальное состояние: текущий пользователь, справочники, избранное и подборки.
export const store = reactive({
  user: pb.authStore.isValid ? pb.authStore.record : null,
  categories: [],
  models: [],
  stats: { categories: {}, models: {}, totals: {} },
  favorites: null, // запись подборки «Избранное»
  selections: [], // остальные подборки пользователя
  loaded: false,
  newReports: 0, // число новых жалоб (для администратора, обновляется в реальном времени)
  reportsTick: 0, // увеличивается при любом изменении жалоб
  newPromptsTick: 0, // увеличивается, когда другой пользователь публикует промпт

  get isAuth() {
    return !!this.user
  },
  get isAdmin() {
    return this.user?.role === 'admin'
  },
})

pb.authStore.onChange(() => {
  store.user = pb.authStore.isValid ? pb.authStore.record : null
  if (!store.user) {
    store.favorites = null
    store.selections = []
  }
})

export async function loadDictionaries(force = false) {
  if (store.loaded && !force) return
  const [cats, models, stats] = await Promise.all([
    pb.collection('categories').getFullList({ sort: 'sort,name' }),
    pb.collection('ai_models').getFullList({ sort: 'sort,name' }),
    pb.send('/api/ph/stats', {}).catch(() => ({ categories: {}, models: {}, totals: {} })),
  ])
  store.categories = cats
  store.models = models
  store.stats = stats
  store.loaded = true
}

export async function refreshStats() {
  try {
    store.stats = await pb.send('/api/ph/stats', {})
  } catch (_) {}
}

export function categoryBySlug(slug) {
  return store.categories.find((c) => c.slug === slug)
}
export function modelBySlug(slug) {
  return store.models.find((m) => m.slug === slug)
}

// Проверка сессии при запуске: заблокированный пользователь будет разлогинен
export async function initAuth() {
  if (!pb.authStore.isValid) {
    pb.authStore.clear()
    return
  }
  try {
    await pb.collection('users').authRefresh()
    if (pb.authStore.record && pb.authStore.record.is_active === false) {
      pb.authStore.clear()
      toast.error('Ваш аккаунт заблокирован администратором.')
      return
    }
    await loadSelections()
  } catch (_) {
    pb.authStore.clear()
  }
}

export async function login(email, password) {
  await pb.collection('users').authWithPassword(email, password)
  await loadSelections()
}

export function logout() {
  pb.authStore.clear()
}

export async function loadSelections() {
  if (!store.user) return
  const all = await pb.collection('selections').getFullList({
    filter: pb.filter('user = {:u}', { u: store.user.id }),
    sort: '-is_favorite,created',
  })
  let fav = all.find((s) => s.is_favorite)
  if (!fav) {
    try {
      fav = await pb.collection('selections').create({ name: 'Избранное', user: store.user.id, is_favorite: true, prompts: [] })
    } catch (_) {
      fav = null
    }
  }
  store.favorites = fav
  store.selections = all.filter((s) => !s.is_favorite)
}

export function isFavorite(promptId) {
  return !!store.favorites?.prompts?.includes(promptId)
}

export async function toggleFavorite(promptId) {
  if (!store.user) {
    toast.info('Войдите, чтобы добавлять промпты в избранное.')
    return false
  }
  if (!store.favorites) await loadSelections()
  const fav = store.favorites
  if (!fav) return false
  const has = isFavorite(promptId)
  try {
    store.favorites = await pb.collection('selections').update(fav.id, {
      [has ? 'prompts-' : 'prompts+']: promptId,
    })
    toast.success(has ? 'Удалено из избранного' : 'Добавлено в избранное')
    return true
  } catch (e) {
    toast.error(errorMessage(e))
    return false
  }
}

export function inSelection(sel, promptId) {
  return !!sel?.prompts?.includes(promptId)
}

export async function toggleInSelection(sel, promptId) {
  const has = inSelection(sel, promptId)
  try {
    const upd = await pb.collection('selections').update(sel.id, { [has ? 'prompts-' : 'prompts+']: promptId })
    const i = store.selections.findIndex((s) => s.id === sel.id)
    if (i !== -1) store.selections[i] = upd
    toast.success(has ? `Удалено из подборки «${sel.name}»` : `Добавлено в подборку «${sel.name}»`)
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

export async function createSelection(name) {
  const rec = await pb.collection('selections').create({ name, user: store.user.id, is_favorite: false, prompts: [] })
  store.selections.push(rec)
  return rec
}
