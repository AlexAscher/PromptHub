<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
const props = defineProps({ title: String, wide: Boolean })
const emit = defineEmits(['close'])
const onKey = (e) => { if (e.key === 'Escape') emit('close') }
onMounted(() => { document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden' })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <div class="ph-modal-backdrop" @mousedown.self="emit('close')">
      <div class="ph-modal" :style="wide ? 'max-width: 720px' : ''" role="dialog" aria-modal="true" :aria-label="title">
        <div class="d-flex align-items-center justify-content-between px-4 pt-4 pb-2">
          <h5 class="mb-0">{{ title }}</h5>
          <button class="btn-close" aria-label="Закрыть" @click="emit('close')"></button>
        </div>
        <div class="px-4 pb-4 pt-2"><slot /></div>
      </div>
    </div>
  </Teleport>
</template>
