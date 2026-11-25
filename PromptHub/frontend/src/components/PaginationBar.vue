<script setup>
import { computed } from 'vue'
const props = defineProps({ page: Number, totalPages: Number, totalItems: Number, perPage: Number, noun: { type: Array, default: () => ['промпта', 'промптов', 'промптов'] } })
const emit = defineEmits(['change'])

const pages = computed(() => {
  const t = props.totalPages, p = props.page
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const set = new Set([1, 2, t - 1, t, p - 1, p, p + 1].filter((x) => x >= 1 && x <= t))
  const arr = [...set].sort((a, b) => a - b)
  const out = []
  arr.forEach((x, i) => { if (i && x - arr[i - 1] > 1) out.push('…'); out.push(x) })
  return out
})
const from = computed(() => (props.page - 1) * props.perPage + 1)
const to = computed(() => Math.min(props.page * props.perPage, props.totalItems))
</script>

<template>
  <nav v-if="totalPages > 1" class="d-flex flex-column flex-md-row align-items-center justify-content-center gap-3 mt-4" aria-label="Страницы">
    <ul class="pagination mb-0 flex-wrap justify-content-center">
      <li class="page-item" :class="{ disabled: page <= 1 }">
        <button class="page-link" @click="emit('change', page - 1)"><i class="bi bi-arrow-left"></i> Назад</button>
      </li>
      <li v-for="(p, i) in pages" :key="i" class="page-item" :class="{ active: p === page, disabled: p === '…' }">
        <button class="page-link" @click="p !== '…' && emit('change', p)">{{ p }}</button>
      </li>
      <li class="page-item" :class="{ disabled: page >= totalPages }">
        <button class="page-link" @click="emit('change', page + 1)">Вперёд <i class="bi bi-arrow-right"></i></button>
      </li>
    </ul>
    <span class="small text-muted">Показано {{ from }}–{{ to }} из {{ totalItems }}</span>
  </nav>
</template>
