<script setup>
import { toasts, dismiss } from '../toast'
const icons = { success: 'bi-check-circle-fill text-success', danger: 'bi-exclamation-octagon-fill text-danger', info: 'bi-info-circle-fill text-accent' }
</script>

<template>
  <div class="ph-toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="ph-toast" :class="t.type" role="status">
        <i class="bi mt-1" :class="icons[t.type]"></i>
        <div class="flex-grow-1">{{ t.message }}</div>
        <button class="btn-close btn-sm" aria-label="Закрыть" @click="dismiss(t.id)"></button>
      </div>
    </TransitionGroup>
  </div>
</template>
