// Обновления в реальном времени через подписки PocketBase (Server-Sent Events).
// Сервер сам присылает изменения записей — без периодического опроса.
// Подписки учитывают правила доступа коллекций: пользователь получает
// только те события, которые ему разрешено видеть.

import { pb } from './pb'
import { store, loadDictionaries, refreshStats, logout } from './store'
import { toast } from './toast'
import { router } from './router'

let globalUnsubs = []
let currentKey = null

export function debounce(fn, ms = 400) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

const refreshStatsSoon = debounce(refreshStats, 600)
const reloadDictsSoon = debounce(() => loadDictionaries(true).catch(() => {}), 600)

export async function countNewReports() {
  if (!store.isAdmin) {
    store.newReports = 0
    return
  }
  try {
    const res = await pb.collection('reports').getList(1, 1, { filter: 'status = "new"', fields: 'id' })
    store.newReports = res.totalItems
  } catch (_) {}
}
const countNewReportsSoon = debounce(countNewReports, 300)

async function sub(collection, topic, cb, options) {
  try {
    const unsub = await pb.collection(collection).subscribe(topic, cb, options)
    globalUnsubs.push(unsub)
  } catch (e) {
    console.warn('realtime subscribe failed', collection, topic, e)
  }
}

async function stopGlobal() {
  const list = globalUnsubs
  globalUnsubs = []
  await Promise.all(list.map((u) => u().catch(() => {})))
}

// (Пере)запуск глобальных подписок. Вызывается при старте и при смене пользователя/роли.
// Вызовы выстраиваются в очередь, чтобы параллельные перезапуски не создавали дублей.
let chain = Promise.resolve()
export function startRealtime(force = false) {
  chain = chain.then(() => doStart(force)).catch(() => {})
  return chain
}

async function doStart(force) {
  const key = store.user ? `${store.user.id}|${store.user.role}` : 'guest'
  if (key === currentKey && !force) return
  currentKey = key
  await stopGlobal()

  // Каталог: новые/изменённые/удалённые промпты → счётчики категорий и баннер «появились новые»
  await sub('prompts', '*', (e) => {
    refreshStatsSoon()
    if (e.action === 'create' && e.record.author !== store.user?.id) store.newPromptsTick++
  })
  // Справочники меняет администратор — у всех списки обновляются сами
  await sub('categories', '*', reloadDictsSoon)
  await sub('ai_models', '*', reloadDictsSoon)

  if (!store.user) return

  // Свой аккаунт: блокировка выкидывает сразу, смена имени/роли подхватывается
  await sub('users', store.user.id, (e) => {
    if (e.action === 'delete' || e.record.is_active === false) {
      logout()
      toast.error('Ваш аккаунт заблокирован администратором.')
      router.push('/')
      return
    }
    const merged = { ...pb.authStore.record, ...e.record }
    if (!e.record.email && pb.authStore.record?.email) merged.email = pb.authStore.record.email
    pb.authStore.save(pb.authStore.token, merged)
  })

  if (store.isAdmin) {
    await countNewReports()
    await sub('reports', '*', (e) => {
      countNewReportsSoon()
      store.reportsTick++
      if (e.action === 'create') toast.info(`Новая жалоба: «${e.record.prompt_title}»`)
    })
  } else {
    store.newReports = 0
  }
}

// Смена пользователя (вход/выход/смена роли) перезапускает подписки
pb.authStore.onChange(() => {
  startRealtime().catch(() => {})
})
