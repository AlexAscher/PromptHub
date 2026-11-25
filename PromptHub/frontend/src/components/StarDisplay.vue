<script setup>
defineProps({ value: { type: Number, default: 0 }, size: { type: String, default: '1em' } })
</script>

<template>
  <span class="stars" :style="{ fontSize: size }" :aria-label="`Оценка ${value} из 5`">
    <i v-for="i in 5" :key="i" class="bi"
       :class="value >= i - 0.25 ? 'bi-star-fill' : value >= i - 0.75 ? 'bi-star-half' : 'bi-star-fill off'"></i>
  </span>
</template>
