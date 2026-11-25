import PocketBase, { BaseAuthStore } from 'pocketbase'

// Сессия хранится отдельно для каждой вкладки (sessionStorage), поэтому в
// разных вкладках можно одновременно работать под разными пользователями.
// Последний вход дублируется в localStorage: новая вкладка подхватывает его,
// чтобы не приходилось входить заново. Вкладки друг друга не переключают.
const AUTH_KEY = 'ph_auth'

function readStorage(storage) {
  try {
    const raw = storage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

class TabAuthStore extends BaseAuthStore {
  constructor() {
    super()
    const saved = readStorage(window.sessionStorage) || readStorage(window.localStorage)
    if (saved?.token) super.save(saved.token, saved.record || null)
  }

  save(token, record) {
    super.save(token, record)
    const raw = JSON.stringify({ token, record })
    try { window.sessionStorage.setItem(AUTH_KEY, raw) } catch (_) {}
    try { window.localStorage.setItem(AUTH_KEY, raw) } catch (_) {}
  }

  clear() {
    const token = this.token
    super.clear()
    try { window.sessionStorage.removeItem(AUTH_KEY) } catch (_) {}
    // «последний вход» убираем, только если он принадлежит этой вкладке
    try {
      if (readStorage(window.localStorage)?.token === token) window.localStorage.removeItem(AUTH_KEY)
    } catch (_) {}
  }
}

// Клиент REST API PocketBase. В Docker nginx проксирует /api на сервер,
// поэтому используется тот же адрес, с которого открыт сайт.
export const pb = new PocketBase(import.meta.env.VITE_PB_URL || window.location.origin, new TabAuthStore())
pb.autoCancellation(false)

const FIELD_NAMES = {
  email: 'Email',
  password: 'Пароль',
  passwordConfirm: 'Подтверждение пароля',
  oldPassword: 'Текущий пароль',
  name: 'Имя пользователя',
  title: 'Название',
  text: 'Текст промпта',
  description: 'Описание',
  usage: 'Инструкция',
  category: 'Категория',
  model: 'Модель ИИ',
  image: 'Превью',
  avatar: 'Аватар',
  value: 'Оценка',
  reason: 'Причина',
  slug: 'Код (slug)',
  token: 'Ссылка',
}

const CODE_MESSAGES = {
  validation_required: 'обязательное поле',
  validation_is_email: 'некорректный email',
  validation_not_unique: 'такое значение уже используется',
  validation_values_mismatch: 'значения не совпадают',
  validation_min_text_constraint: 'слишком короткое значение',
  validation_max_text_constraint: 'слишком длинное значение',
  validation_length_out_of_range: 'недопустимая длина',
  validation_invalid_mime_type: 'допустимы только JPG и PNG',
  validation_file_size_limit: 'файл больше 2 МБ',
  validation_invalid_old_password: 'неверный текущий пароль',
  validation_invalid_token: 'ссылка недействительна или устарела',
  validation_invalid_format: 'неверный формат',
}

// Понятное пользователю сообщение об ошибке (ТЗ, п. 4.10.4)
export function errorMessage(err, fallback = 'Что-то пошло не так. Попробуйте ещё раз.') {
  if (!err) return fallback
  if (err.isAbort) return ''
  const data = err.response?.data || err.data?.data
  if (data && typeof data === 'object' && Object.keys(data).length) {
    return Object.entries(data)
      .map(([k, v]) => `${FIELD_NAMES[k] || k}: ${CODE_MESSAGES[v?.code] || v?.message || 'ошибка'}`)
      .join('; ')
  }
  const status = err.status
  if (status === 0) return 'Сервер недоступен. Проверьте подключение.'
  if (status === 403) return 'Недостаточно прав для этого действия.'
  if (status === 404) return 'Запись не найдена или у вас нет к ней доступа.'
  if (status === 401) return 'Необходимо войти в аккаунт.'
  const msg = err.response?.message || err.message
  if (msg && /[а-яё]/i.test(msg)) return msg
  return fallback
}

export function fileUrl(record, filename, thumb) {
  if (!record || !filename) return ''
  return pb.files.getURL(record, filename, thumb ? { thumb } : undefined)
}
