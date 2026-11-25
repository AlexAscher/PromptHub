<script setup>
import PromptCard from './PromptCard.vue'
defineProps({
  items: { type: Array, default: () => [] },
  loading: Boolean,
  variant: { type: String, default: 'default' },
  cols: { type: String, default: 'col-sm-6 col-lg-4' },
  skeletons: { type: Number, default: 6 },
  emptyText: { type: String, default: 'По вашему запросу ничего не найдено.' },
})
</script>

<template>
  <div class="row g-3">
    <template v-if="loading && !items.length">
      <div v-for="i in skeletons" :key="'s' + i" :class="cols">
        <div class="skeleton" style="height: 210px"></div>
      </div>
    </template>
    <template v-else-if="items.length">
      <div v-for="p in items" :key="p.id" :class="cols">
        <PromptCard :prompt="p" :variant="variant" />
      </div>
    </template>
    <div v-else class="col-12">
      <div class="ph-card empty-state">
        <i class="bi bi-search"></i>
        <div class="fw-semibold text-body mb-1">{{ emptyText }}</div>
        <slot name="empty"><div class="small">Попробуйте изменить запрос или сбросить фильтры.</div></slot>
      </div>
    </div>
  </div>
</template>
