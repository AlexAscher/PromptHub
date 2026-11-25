<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { pb, errorMessage } from '../pb'
import { toast } from '../toast'
import { formatDate, pluralize } from '../utils'
import UserAvatar from '../components/UserAvatar.vue'
import PromptGrid from '../components/PromptGrid.vue'
import PaginationBar from '../components/PaginationBar.vue'
import NotFoundView from './NotFoundView.vue'

const route = useRoute()
const id = route.params.id
const user = ref(null)
const notFound = ref(false)
const items = ref([])
const page = ref(1)
const totalPages = ref(0)
const total = ref(0)
const loading = ref(true)

async function loadPrompts(p = 1) {
  loading.value = true
  try {
    const res = await pb.collection('prompts').getList(p, 9, {
      filter: pb.filter('author = {:a}', { a: id }),
      sort: '-created',
      expand: 'category,model,author',
    })
    items.value = res.items
    page.value = p
    totalPages.value = res.totalPages
    total.value = res.totalItems
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    user.value = await pb.collection('users').getOne(id)
    document.title = `${user.value.name} — PromptHub`
    loadPrompts()
  } catch (e) {
    notFound.value = true
  }
})
</script>

<template>
  <NotFoundView v-if="notFound" text="Пользователь не найден." />
  <div v-else-if="user" class="container py-4 py-md-5">
    <nav class="ph-breadcrumb mb-3"><RouterLink to="/">Главная</RouterLink> / <RouterLink to="/authors">Авторы</RouterLink> / {{ user.name }}</nav>
    <div class="ph-card p-4 d-flex flex-column flex-sm-row align-items-sm-center gap-4 mb-4">
      <UserAvatar :user="user" :size="96" />
      <div>
        <h1 class="h2 mb-1">{{ user.name }} <span v-if="user.role === 'admin'" class="chip chip-accent align-middle">Администратор</span></h1>
        <p v-if="user.bio" class="mb-2">{{ user.bio }}</p>
        <div class="text-muted small">
          На PromptHub с {{ formatDate(user.created) }} · {{ pluralize(total, ['опубликованный промпт', 'опубликованных промпта', 'опубликованных промптов']) }}
        </div>
        <div v-if="user.is_active === false" class="badge text-bg-danger mt-2">Аккаунт заблокирован</div>
      </div>
    </div>
    <h2 class="h4 mb-3">Промпты автора</h2>
    <PromptGrid :items="items" :loading="loading" empty-text="Автор пока ничего не опубликовал.">
      <template #empty><span></span></template>
    </PromptGrid>
    <PaginationBar :page="page" :total-pages="totalPages" :total-items="total" :per-page="9" @change="loadPrompts" />
  </div>
</template>
