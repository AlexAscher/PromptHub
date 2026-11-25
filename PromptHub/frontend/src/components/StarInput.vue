<script setup>
import { ref } from 'vue'
const model = defineModel({ type: Number, default: 0 })
const hover = ref(0)
const labels = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично']
</script>

<template>
  <div class="star-input d-inline-flex align-items-center" @mouseleave="hover = 0" role="radiogroup" aria-label="Оценка">
    <button v-for="i in 5" :key="i" type="button" :class="{ on: (hover || model) >= i }"
            :aria-label="`${i} из 5`" :aria-checked="model === i" role="radio"
            @mouseenter="hover = i" @click="model = i">
      <i class="bi bi-star-fill"></i>
    </button>
    <span class="ms-2 small text-muted">{{ labels[hover || model] }}</span>
  </div>
</template>
