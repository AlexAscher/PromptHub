import { createRouter, createWebHistory } from 'vue-router'
import { store } from './store'
import { toast } from './toast'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
  { path: '/catalog', name: 'catalog', component: () => import('./views/CatalogView.vue'), meta: { title: 'Каталог промптов' } },
  { path: '/categories', name: 'categories', component: () => import('./views/CategoriesView.vue'), meta: { title: 'Категории' } },
  { path: '/authors', name: 'authors', component: () => import('./views/AuthorsView.vue'), meta: { title: 'Авторы' } },
  { path: '/authors/:id', name: 'author', component: () => import('./views/AuthorView.vue'), meta: { title: 'Профиль автора' } },
  { path: '/prompts/new', name: 'prompt-new', component: () => import('./views/PromptEditView.vue'), meta: { auth: true, title: 'Новый промпт' } },
  { path: '/prompts/:id', name: 'prompt', component: () => import('./views/PromptView.vue') },
  { path: '/prompts/:id/edit', name: 'prompt-edit', component: () => import('./views/PromptEditView.vue'), meta: { auth: true, title: 'Редактирование промпта' } },
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { guest: true, title: 'Вход' } },
  { path: '/register', name: 'register', component: () => import('./views/RegisterView.vue'), meta: { guest: true, title: 'Регистрация' } },
  { path: '/forgot-password', name: 'forgot', component: () => import('./views/ForgotPasswordView.vue'), meta: { title: 'Сброс пароля' } },
  { path: '/reset-password/:token', name: 'reset', component: () => import('./views/ResetPasswordView.vue'), meta: { title: 'Новый пароль' } },
  { path: '/account', name: 'account', component: () => import('./views/AccountView.vue'), meta: { auth: true, title: 'Личный кабинет' } },
  { path: '/admin', name: 'admin', component: () => import('./views/AdminView.vue'), meta: { auth: true, admin: true, title: 'Панель администратора' } },
  { path: '/page/:slug', name: 'page', component: () => import('./views/InfoView.vue') },
  { path: '/how-it-works', redirect: '/page/how-it-works' },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFoundView.vue'), meta: { title: 'Страница не найдена' } },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.hash) return { el: to.hash, top: 80 }
    if (to.name === from.name && to.name === 'catalog') return false
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  if (to.meta.auth && !store.isAuth) {
    toast.info('Войдите в аккаунт, чтобы продолжить.')
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.admin && !store.isAdmin) {
    toast.error('Раздел доступен только администратору.')
    return { name: 'home' }
  }
  if (to.meta.guest && store.isAuth) return { name: 'account' }
})

// После обновления сайта (пересборки) старые файлы разделов удаляются. Если открытая
// вкладка пытается загрузить такой файл, перезагружаем страницу на новую версию.
const RELOAD_KEY = 'ph-chunk-reload'
function reloadTo(path) {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < 10000) return false // защита от бесконечной перезагрузки
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch (_) {}
  window.location.assign(path)
  return true
}
const isChunkError = (err) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(String(err?.message || err))

router.onError((err, to) => {
  if (isChunkError(err) && !reloadTo(to?.fullPath || window.location.href)) {
    toast.error('Сайт обновился. Обновите страницу, чтобы продолжить.')
  }
})
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  reloadTo(window.location.href)
})

router.afterEach((to) => {
  if (to.meta.title) document.title = `${to.meta.title} — PromptHub`
  else if (to.name === 'home') document.title = 'PromptHub — каталог AI-промптов'
})
