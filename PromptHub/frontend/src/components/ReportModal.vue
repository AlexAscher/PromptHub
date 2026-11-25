<script setup>
import { ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { pb, errorMessage } from '../pb'
import { store } from '../store'
import { toast } from '../toast'
import { REPORT_REASONS } from '../utils'

const props = defineProps({ promptId: String })
const emit = defineEmits(['close'])
const reason = ref('')
const comment = ref('')
const busy = ref(false)

async function submit() {
  if (!reason.value) return toast.error('Выберите причину жалобы.')
  busy.value = true
  try {
    await pb.collection('reports').create({
      reason: reason.value,
      comment: comment.value.trim(),
      user: store.user.id,
      prompt: props.promptId,
    })
    toast.success('Жалоба отправлена. Администратор рассмотрит её в ближайшее время.')
    emit('close')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseModal title="Пожаловаться на промпт" @close="emit('close')">
    <form @submit.prevent="submit">
      <div class="mb-3">
        <div class="form-label">Причина</div>
        <div v-for="(label, key) in REPORT_REASONS" :key="key" class="form-check mb-1">
          <input :id="'r-' + key" v-model="reason" class="form-check-input" type="radio" :value="key" />
          <label :for="'r-' + key" class="form-check-label">{{ label }}</label>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label" for="r-comment">Комментарий <span class="text-muted fw-normal">(необязательно)</span></label>
        <textarea id="r-comment" v-model="comment" class="form-control" rows="3" maxlength="1000" placeholder="Опишите проблему подробнее"></textarea>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-light-ph" @click="emit('close')">Отмена</button>
        <button class="btn btn-danger" :disabled="busy">Отправить жалобу</button>
      </div>
    </form>
  </BaseModal>
</template>
