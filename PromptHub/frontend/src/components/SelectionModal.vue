<script setup>
import { ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { store, inSelection, toggleInSelection, createSelection, isFavorite, toggleFavorite } from '../store'
import { errorMessage } from '../pb'
import { toast } from '../toast'

const props = defineProps({ promptId: String })
const emit = defineEmits(['close'])
const name = ref('')
const busy = ref(false)

async function create() {
  const n = name.value.trim()
  if (!n) return
  busy.value = true
  try {
    const sel = await createSelection(n)
    await toggleInSelection(sel, props.promptId)
    name.value = ''
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseModal title="Сохранить в подборку" @close="emit('close')">
    <p class="small text-muted">Подборки приватны — их видите только вы.</p>
    <div class="list-group mb-3">
      <label class="list-group-item d-flex align-items-center gap-2 cursor-pointer">
        <input class="form-check-input m-0" type="checkbox" :checked="isFavorite(promptId)" @change="toggleFavorite(promptId)" />
        <i class="bi bi-heart-fill" style="color: #e0457b"></i> Избранное
      </label>
      <label v-for="s in store.selections" :key="s.id" class="list-group-item d-flex align-items-center gap-2 cursor-pointer">
        <input class="form-check-input m-0" type="checkbox" :checked="inSelection(s, promptId)" @change="toggleInSelection(s, promptId)" />
        <i class="bi bi-collection text-muted"></i> {{ s.name }}
        <span class="ms-auto small text-muted">{{ s.prompts?.length || 0 }}</span>
      </label>
    </div>
    <form class="d-flex gap-2" @submit.prevent="create">
      <input v-model="name" class="form-control" maxlength="100" placeholder="Новая подборка, например «Для работы»" />
      <button class="btn btn-primary flex-shrink-0" :disabled="busy || !name.trim()">Создать</button>
    </form>
  </BaseModal>
</template>
