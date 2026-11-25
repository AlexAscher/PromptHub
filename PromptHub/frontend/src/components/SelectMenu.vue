<script setup>
// Выпадающий список на HTML/CSS вместо системного <select>:
// одинаково открывается во всех браузерах и встроенных webview.
import { ref, computed, nextTick, onMounted, onBeforeUnmount, useId } from 'vue'

const model = defineModel({ type: [String, Number], default: '' })
const props = defineProps({
  options: { type: Array, required: true }, // [{ value, label }]
  placeholder: { type: String, default: 'Выберите…' },
  invalid: Boolean,
  size: { type: String, default: '' }, // '' | 'sm'
  inputId: String,
  ariaLabel: String,
})
const emit = defineEmits(['change'])

const uid = useId()
const open = ref(false)
const active = ref(-1)
const root = ref(null)
const list = ref(null)

const current = computed(() => props.options.find((o) => o.value === model.value))

function toggle() {
  open.value ? close() : show()
}
async function show() {
  open.value = true
  active.value = Math.max(0, props.options.findIndex((o) => o.value === model.value))
  await nextTick()
  list.value?.children[active.value]?.scrollIntoView({ block: 'nearest' })
}
function close() {
  open.value = false
}
function choose(o) {
  if (o.value !== model.value) {
    model.value = o.value
    emit('change', o.value)
  }
  close()
}
function onKey(e) {
  const n = props.options.length
  if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault()
    if (!open.value) return show()
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    nextTick(() => list.value?.children[active.value]?.scrollIntoView({ block: 'nearest' }))
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (open.value && props.options[active.value]) choose(props.options[active.value])
    else show()
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    close()
  }
}
const onDoc = (e) => {
  if (open.value && root.value && !root.value.contains(e.target)) close()
}
onMounted(() => document.addEventListener('mousedown', onDoc))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDoc))
</script>

<template>
  <div ref="root" class="ph-select" :class="{ open }">
    <button
      :id="inputId"
      type="button"
      class="form-select text-start"
      :class="{ 'is-invalid': invalid, 'form-select-sm': size === 'sm' }"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="uid"
      :aria-label="ariaLabel"
      @click="toggle"
      @keydown="onKey"
    >
      <span :class="{ 'text-muted': !current }">{{ current ? current.label : placeholder }}</span>
    </button>
    <ul v-show="open" :id="uid" ref="list" class="ph-select-menu" role="listbox">
      <li
        v-for="(o, i) in options"
        :key="o.value"
        role="option"
        :aria-selected="o.value === model"
        :class="{ selected: o.value === model, active: i === active }"
        @mouseenter="active = i"
        @mousedown.prevent="choose(o)"
      >
        <span class="flex-grow-1">{{ o.label }}</span>
        <i v-if="o.value === model" class="bi bi-check2"></i>
      </li>
    </ul>
  </div>
</template>
