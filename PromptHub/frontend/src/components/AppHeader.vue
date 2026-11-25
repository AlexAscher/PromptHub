<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, logout } from '../store'
import { toast } from '../toast'
import UserAvatar from './UserAvatar.vue'

const route = useRoute()
const router = useRouter()
const open = ref(false)
const menu = ref(false)
const theme = ref(document.documentElement.getAttribute('data-bs-theme') || 'light')

watch(() => route.fullPath, () => { open.value = false; menu.value = false })

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-bs-theme', theme.value)
  try { localStorage.setItem('ph-theme', theme.value) } catch (_) {}
}

function doLogout() {
  logout()
  toast.info('Вы вышли из аккаунта')
  router.push('/')
}

const onDoc = (e) => { if (!e.target.closest?.('.user-menu')) menu.value = false }
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))

const links = [
  { to: '/catalog', label: 'Каталог' },
  { to: '/categories', label: 'Категории' },
  { to: '/authors', label: 'Авторы' },
  { to: '/page/how-it-works', label: 'Как это работает' },
]
</script>

<template>
  <header class="ph-header">
    <nav class="container py-2">
      <div class="d-flex align-items-center gap-3" style="min-height: 54px">
        <RouterLink to="/" class="ph-logo me-lg-3"><span class="ph-logo-mark"></span>PromptHub</RouterLink>

        <ul class="ph-nav nav d-none d-lg-flex mx-auto">
          <li v-for="l in links" :key="l.to" class="nav-item">
            <RouterLink :to="l.to" class="nav-link text-nowrap">{{ l.label }}</RouterLink>
          </li>
        </ul>

        <div class="d-flex align-items-center gap-2 ms-auto ms-lg-0">
          <button class="btn btn-sm btn-link text-body px-2" :title="theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'" aria-label="Сменить тему" @click="toggleTheme">
            <i class="bi fs-5" :class="theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'"></i>
          </button>

          <template v-if="!store.isAuth">
            <RouterLink to="/login" class="btn btn-link text-body fw-semibold d-none d-sm-inline-block">Войти</RouterLink>
            <RouterLink to="/register" class="btn btn-primary d-none d-sm-inline-block">Регистрация</RouterLink>
            <RouterLink to="/login" class="btn btn-link text-body d-sm-none px-2" aria-label="Войти"><i class="bi bi-person-circle fs-5"></i></RouterLink>
          </template>

          <template v-else>
            <RouterLink to="/prompts/new" class="btn btn-primary d-none d-xl-inline-block text-nowrap"><i class="bi bi-plus-lg me-1"></i>Добавить промпт</RouterLink>
            <div class="position-relative user-menu">
              <button class="btn btn-link text-body text-decoration-none d-flex align-items-center gap-2 px-1" aria-haspopup="true" :aria-expanded="menu" @click="menu = !menu">
                <span class="position-relative d-inline-flex">
                  <UserAvatar :user="store.user" :size="34" />
                  <span v-if="store.isAdmin && store.newReports" class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger" style="font-size: .62rem" :title="`Новых жалоб: ${store.newReports}`">{{ store.newReports }}</span>
                </span>
                <span class="fw-semibold d-none d-sm-inline text-truncate" style="max-width: 140px">{{ store.user.name }}</span>
                <i class="bi bi-chevron-down small"></i>
              </button>
              <div v-if="menu" class="dropdown-menu show end-0 mt-1 shadow-sm" style="right: 0; left: auto; min-width: 220px">
                <div class="px-3 py-2 small text-muted border-bottom mb-1 text-truncate">{{ store.user.email }}</div>
                <RouterLink class="dropdown-item" :to="{ path: '/account', query: { tab: 'prompts' } }"><i class="bi bi-person me-2"></i>Личный кабинет</RouterLink>
                <RouterLink class="dropdown-item" :to="{ path: '/account', query: { tab: 'favorites' } }"><i class="bi bi-heart me-2"></i>Избранное</RouterLink>
                <RouterLink class="dropdown-item" :to="{ path: '/account', query: { tab: 'selections' } }"><i class="bi bi-collection me-2"></i>Мои подборки</RouterLink>
                <RouterLink class="dropdown-item d-xl-none" to="/prompts/new"><i class="bi bi-plus-lg me-2"></i>Добавить промпт</RouterLink>
                <RouterLink v-if="store.isAdmin" class="dropdown-item d-flex align-items-center" :to="store.newReports ? { path: '/admin', query: { tab: 'reports' } } : '/admin'"><i class="bi bi-shield-lock me-2"></i>Панель администратора<span v-if="store.newReports" class="badge rounded-pill text-bg-danger ms-auto">{{ store.newReports }}</span></RouterLink>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item text-danger" @click="doLogout"><i class="bi bi-box-arrow-right me-2"></i>Выйти</button>
              </div>
            </div>
          </template>

          <button class="btn btn-link text-body d-lg-none px-2" aria-label="Меню" :aria-expanded="open" @click="open = !open">
            <i class="bi fs-4" :class="open ? 'bi-x-lg' : 'bi-list'"></i>
          </button>
        </div>
      </div>

      <ul v-if="open" class="ph-nav nav flex-column d-lg-none pb-2">
        <li v-for="l in links" :key="l.to" class="nav-item">
          <RouterLink :to="l.to" class="nav-link">{{ l.label }}</RouterLink>
        </li>
        <li v-if="!store.isAuth" class="nav-item d-sm-none mt-2">
          <RouterLink to="/register" class="btn btn-primary w-100">Регистрация</RouterLink>
        </li>
      </ul>
    </nav>
  </header>
</template>
