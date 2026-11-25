<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pb, errorMessage, fileUrl } from '../pb'
import { store, refreshStats } from '../store'
import { toast } from '../toast'
import SelectMenu from '../components/SelectMenu.vue'

const route = useRoute()
const router = useRouter()
const editId = route.params.id || null

const form = ref({ title: '', description: '', text: '', usage: '', category: '', model: '', tags: '' })
const existing = ref(null)
const imageFile = ref(null)
const imagePreview = ref('')
const removeImage = ref(false)
const errors = ref({})
const saving = ref(false)
const loading = ref(!!editId)

const MAX_SIZE = 2 * 1024 * 1024

onMounted(async () => {
  if (!editId) return
  try {
    const p = await pb.collection('prompts').getOne(editId)
    if (p.author !== store.user.id && !store.isAdmin) {
      toast.error('Редактировать промпт может только его автор или администратор.')
      return router.replace(`/prompts/${editId}`)
    }
    existing.value = p
    form.value = {
      title: p.title, description: p.description, text: p.text, usage: p.usage || '',
      category: p.category, model: p.model, tags: (p.tags || []).join(', '),
    }
    if (p.image) imagePreview.value = fileUrl(p, p.image)
  } catch (e) {
    toast.error(errorMessage(e))
    router.replace('/catalog')
  } finally {
    loading.value = false
  }
})

function onFile(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  if (!['image/jpeg', 'image/png'].includes(f.type)) return toast.error('Превью: допустимы только изображения JPG и PNG.')
  if (f.size > MAX_SIZE) return toast.error('Превью: размер файла не должен превышать 2 МБ.')
  imageFile.value = f
  removeImage.value = false
  imagePreview.value = URL.createObjectURL(f)
}

function clearImage() {
  imageFile.value = null
  imagePreview.value = ''
  removeImage.value = !!existing.value?.image
}

const tagsList = computed(() => [...new Set(form.value.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10))

function validate() {
  const f = form.value
  const e = {}
  if (f.title.trim().length < 3) e.title = 'Минимум 3 символа.'
  if (f.title.length > 100) e.title = 'Максимум 100 символов.'
  if (f.description.trim().length < 10) e.description = 'Опишите назначение промпта (минимум 10 символов).'
  if (f.text.trim().length < 10) e.text = 'Минимум 10 символов.'
  if (f.text.length > 2000) e.text = 'Максимум 2000 символов.'
  if (!f.category) e.category = 'Выберите категорию.'
  if (!f.model) e.model = 'Выберите нейросеть.'
  errors.value = e
  return !Object.keys(e).length
}

async function submit() {
  if (!validate()) return toast.error('Проверьте правильность заполнения формы.')
  saving.value = true
  const fd = new FormData()
  const f = form.value
  fd.append('title', f.title.trim())
  fd.append('description', f.description.trim())
  fd.append('text', f.text.trim())
  fd.append('usage', f.usage.trim())
  fd.append('category', f.category)
  fd.append('model', f.model)
  fd.append('tags', JSON.stringify(tagsList.value))
  if (imageFile.value) fd.append('image', imageFile.value)
  else if (removeImage.value) fd.append('image', '')
  try {
    let rec
    if (editId) {
      rec = await pb.collection('prompts').update(editId, fd)
      toast.success('Изменения сохранены')
    } else {
      fd.append('author', store.user.id)
      rec = await pb.collection('prompts').create(fd)
      toast.success('Промпт опубликован и уже доступен в каталоге')
    }
    refreshStats()
    router.push(`/prompts/${rec.id}`)
  } catch (e) {
    const data = e.response?.data || {}
    errors.value = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.message]))
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="container py-4 py-md-5" style="max-width: 860px">
    <nav class="ph-breadcrumb mb-2">
      <RouterLink to="/">Главная</RouterLink> / <RouterLink :to="{ path: '/account', query: { tab: 'prompts' } }">Мои промпты</RouterLink> / {{ editId ? 'Редактирование' : 'Новый промпт' }}
    </nav>
    <h1 class="h2 mb-1">{{ editId ? 'Редактирование промпта' : 'Добавить промпт' }}</h1>
    <p class="text-muted mb-4">{{ editId ? 'Изменения появятся в каталоге сразу после сохранения.' : 'Промпт появится в каталоге сразу после публикации. Ознакомьтесь с ' }}<RouterLink v-if="!editId" to="/page/rules">правилами публикации</RouterLink><template v-if="!editId">.</template></p>

    <div v-if="loading" class="skeleton" style="height: 500px"></div>
    <form v-else class="ph-card p-3 p-md-4" novalidate @submit.prevent="submit">
      <div class="mb-3">
        <label class="form-label" for="f-title">Название <span class="text-danger">*</span></label>
        <input id="f-title" v-model="form.title" class="form-control" :class="{ 'is-invalid': errors.title }" maxlength="100" placeholder="Например: Пост для соцсетей о новом продукте" />
        <div class="d-flex justify-content-between small mt-1">
          <span class="text-danger">{{ errors.title }}</span><span class="text-muted">{{ form.title.length }}/100</span>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-sm-6">
          <label class="form-label" for="f-cat">Категория <span class="text-danger">*</span></label>
          <SelectMenu v-model="form.category" input-id="f-cat" class="w-100" placeholder="Выберите категорию" :invalid="!!errors.category"
                      :options="store.categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))" />
          <div class="small text-danger mt-1">{{ errors.category }}</div>
        </div>
        <div class="col-sm-6">
          <label class="form-label" for="f-model">Нейросеть <span class="text-danger">*</span></label>
          <SelectMenu v-model="form.model" input-id="f-model" class="w-100" placeholder="Выберите модель ИИ" :invalid="!!errors.model"
                      :options="store.models.map((m) => ({ value: m.id, label: m.name }))" />
          <div class="small text-danger mt-1">{{ errors.model }}</div>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="f-desc">Описание <span class="text-danger">*</span></label>
        <textarea id="f-desc" v-model="form.description" class="form-control" :class="{ 'is-invalid': errors.description }" rows="2" maxlength="1000" placeholder="Кратко: какую задачу решает промпт"></textarea>
        <div class="small text-danger mt-1">{{ errors.description }}</div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="f-text">Текст промпта <span class="text-danger">*</span></label>
        <textarea id="f-text" v-model="form.text" class="form-control font-monospace" :class="{ 'is-invalid': errors.text }" rows="9" maxlength="2000" placeholder="Ты — опытный специалист… Используйте [квадратные скобки] для данных, которые пользователь заменит."></textarea>
        <div class="d-flex justify-content-between small mt-1">
          <span class="text-danger">{{ errors.text }}</span>
          <span :class="form.text.length > 1900 ? 'text-warning' : 'text-muted'">{{ form.text.length }}/2000</span>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="f-usage">Инструкция по применению</label>
        <textarea id="f-usage" v-model="form.usage" class="form-control" rows="3" maxlength="1500" placeholder="Каждый шаг с новой строки"></textarea>
      </div>

      <div class="mb-3">
        <label class="form-label" for="f-tags">Теги</label>
        <input id="f-tags" v-model="form.tags" class="form-control" placeholder="smm, реклама, пост — через запятую, до 10 тегов" />
        <div v-if="tagsList.length" class="d-flex flex-wrap gap-1 mt-2">
          <span v-for="t in tagsList" :key="t" class="chip chip-tag">#{{ t }}</span>
        </div>
      </div>

      <div class="mb-4">
        <div class="form-label">Превью-изображение</div>
        <div v-if="imagePreview" class="position-relative d-inline-block mb-2">
          <img :src="imagePreview" alt="Превью" class="rounded-3 border" style="max-height: 180px; max-width: 100%" />
          <button type="button" class="btn btn-sm btn-light position-absolute top-0 end-0 m-1" aria-label="Удалить изображение" @click="clearImage"><i class="bi bi-x-lg"></i></button>
        </div>
        <div>
          <label class="btn btn-light-ph btn-sm">
            <i class="bi bi-image me-1"></i>{{ imagePreview ? 'Заменить' : 'Загрузить изображение' }}
            <input type="file" accept="image/jpeg,image/png" hidden @change="onFile" />
          </label>
          <span class="small text-muted ms-2">JPG или PNG, до 2 МБ</span>
        </div>
      </div>

      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-primary btn-lg px-4" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>{{ editId ? 'Сохранить изменения' : 'Опубликовать' }}
        </button>
        <button type="button" class="btn btn-light-ph btn-lg" @click="router.back()">Отмена</button>
      </div>
    </form>
  </div>
</template>
