<script setup>
import { computed } from 'vue'
import { fileUrl } from '../pb'
import { initials } from '../utils'

const props = defineProps({
  user: Object,
  size: { type: Number, default: 36 },
  collectionId: String,
})
const src = computed(() => {
  const u = props.user
  if (!u?.avatar) return ''
  const rec = { ...u, collectionId: u.collectionId || props.collectionId || '_pb_users_auth_' }
  return fileUrl(rec, u.avatar, '100x100')
})
</script>

<template>
  <span class="avatar" :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.42 + 'px' }">
    <img v-if="src" :src="src" :alt="user?.name" loading="lazy" />
    <template v-else>{{ initials(user?.name) }}</template>
  </span>
</template>
