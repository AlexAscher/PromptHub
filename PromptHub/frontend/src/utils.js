export const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export function parseDate(s) {
  if (!s) return null
  const d = new Date(String(s).replace(' ', 'T'))
  return isNaN(d) ? null : d
}

export function formatDate(s) {
  const d = parseDate(s)
  if (!d) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function sinceText(s) {
  const d = parseDate(s)
  if (!d) return ''
  return `с ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function relativeDay(s) {
  const d = parseDate(s)
  if (!d) return ''
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(new Date()) - start(d)) / 86400000)
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} ${plural(days, ['день', 'дня', 'дней'])} назад`
  return formatDate(s)
}

export function plural(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export function pluralize(n, forms) {
  return `${n} ${plural(n, forms)}`
}

export function ratingText(v) {
  return (Math.round((v || 0) * 10) / 10).toFixed(1).replace('.', ',')
}

export function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

export const REPORT_REASONS = {
  spam: 'Спам',
  broken: 'Нерабочий промпт',
  offensive: 'Оскорбительный контент',
}

export const REPORT_STATUSES = {
  new: 'Новая',
  resolved: 'Решена',
  rejected: 'Отклонена',
}

export const SORTS = {
  popular: { label: 'По популярности', value: '-views,-rating_count' },
  new: { label: 'Сначала новые', value: '-created' },
  rating: { label: 'По рейтингу', value: '-rating_avg,-rating_count' },
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (_) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch (_) {}
    document.body.removeChild(ta)
    return ok
  }
}
