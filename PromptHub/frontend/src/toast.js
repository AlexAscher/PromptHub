import { reactive } from 'vue'

// Всплывающие системные сообщения (Toast), ТЗ п. 4.2.10
export const toasts = reactive([])
let seq = 0

export function toast(message, type = 'success', timeout = 3500) {
  if (!message) return
  const id = ++seq
  toasts.push({ id, message, type })
  setTimeout(() => dismiss(id), timeout)
}

export function dismiss(id) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i !== -1) toasts.splice(i, 1)
}

toast.success = (m) => toast(m, 'success')
toast.error = (m) => toast(m, 'danger', 5000)
toast.info = (m) => toast(m, 'info')
