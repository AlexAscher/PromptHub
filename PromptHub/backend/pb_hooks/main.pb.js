/// <reference path="../pb_data/types.d.ts" />

// Серверная бизнес-логика PromptHub: защита служебных полей,
// пересчёт рейтингов, счётчик просмотров, статистика для главной страницы.

// ===================== Пользователи =====================

onRecordCreateRequest((e) => {
  const u = require(`${__hooks}/utils.js`)
  if (!u.isAdmin(e)) {
    e.record.set("role", "user")
  }
  e.record.set("is_active", true)
  if (!e.record.getString("role")) e.record.set("role", "user")
  e.next()
}, "users")

onRecordUpdateRequest((e) => {
  const u = require(`${__hooks}/utils.js`)
  const orig = e.record.original()
  if (!u.isAdmin(e)) {
    e.record.set("role", orig.getString("role"))
    e.record.set("is_active", orig.getBool("is_active"))
  } else if (e.auth && e.auth.id === e.record.id) {
    // администратор не может заблокировать или разжаловать сам себя
    e.record.set("role", orig.getString("role"))
    e.record.set("is_active", true)
  }
  e.next()
}, "users")

// Избранное создаётся автоматически для каждого нового пользователя
onRecordAfterCreateSuccess((e) => {
  try {
    const col = e.app.findCollectionByNameOrId("selections")
    const fav = new Record(col)
    fav.set("name", "Избранное")
    fav.set("user", e.record.id)
    fav.set("is_favorite", true)
    e.app.save(fav)
  } catch (err) {
    console.log("favorites create error:", err)
  }
  e.next()
}, "users")

// Администратор видит email пользователей
onRecordEnrich((e) => {
  const auth = e.requestInfo && e.requestInfo.auth
  if (auth && auth.collection().name === "users" && auth.getString("role") === "admin") {
    e.record.ignoreEmailVisibility(true)
  }
  e.next()
}, "users")

// ===================== Промпты =====================

onRecordCreateRequest((e) => {
  const u = require(`${__hooks}/utils.js`)
  e.record.set("views", 0)
  e.record.set("rating_avg", 0)
  e.record.set("rating_count", 0)
  e.record.set("reviews_count", 0)
  e.record.set("edited", u.nowISO())
  let raw = []
  try { raw = JSON.parse(e.record.getString("tags") || "[]") } catch (_) {}
  const tags = []
  if (Array.isArray(raw)) {
    for (const t of raw) {
      const s = String(t).trim().toLowerCase().slice(0, 30)
      if (s && tags.indexOf(s) === -1) tags.push(s)
    }
  }
  e.record.set("tags", tags.slice(0, 10))
  e.next()
}, "prompts")

onRecordUpdateRequest((e) => {
  const u = require(`${__hooks}/utils.js`)
  if (!(e.hasSuperuserAuth && e.hasSuperuserAuth())) {
    const orig = e.record.original()
    for (const f of ["author", "views", "rating_avg", "rating_count", "reviews_count"]) {
      e.record.set(f, orig.get(f))
    }
  }
  let raw = []
  try { raw = JSON.parse(e.record.getString("tags") || "[]") } catch (_) {}
  const tags = []
  if (Array.isArray(raw)) {
    for (const t of raw) {
      const s = String(t).trim().toLowerCase().slice(0, 30)
      if (s && tags.indexOf(s) === -1) tags.push(s)
    }
  }
  e.record.set("tags", tags.slice(0, 10))
  e.record.set("edited", u.nowISO())
  e.next()
}, "prompts")

// ===================== Оценки и отзывы =====================

onRecordUpdateRequest((e) => {
  const orig = e.record.original()
  e.record.set("user", orig.getString("user"))
  e.record.set("prompt", orig.getString("prompt"))
  e.next()
}, "ratings", "reviews")

onRecordAfterCreateSuccess((e) => {
  require(`${__hooks}/utils.js`).recalcPrompt(e.app, e.record.getString("prompt"))
  e.next()
}, "ratings", "reviews")

onRecordAfterUpdateSuccess((e) => {
  require(`${__hooks}/utils.js`).recalcPrompt(e.app, e.record.getString("prompt"))
  e.next()
}, "ratings", "reviews")

onRecordAfterDeleteSuccess((e) => {
  require(`${__hooks}/utils.js`).recalcPrompt(e.app, e.record.getString("prompt"))
  e.next()
}, "ratings", "reviews")

// ===================== Подборки =====================

onRecordCreateRequest((e) => {
  if (e.record.getBool("is_favorite")) {
    const existing = e.app.findRecordsByFilter(
      "selections", "user = {:u} && is_favorite = true", "", 1, 0, { u: e.record.getString("user") }
    )
    if (existing.length > 0) {
      throw new BadRequestError("Избранное уже существует.")
    }
  }
  e.next()
}, "selections")

onRecordUpdateRequest((e) => {
  const orig = e.record.original()
  e.record.set("user", orig.getString("user"))
  e.record.set("is_favorite", orig.getBool("is_favorite"))
  e.next()
}, "selections")

// ===================== Жалобы =====================

onRecordCreateRequest((e) => {
  e.record.set("status", "new")
  e.record.set("decision", "")
  const promptId = e.record.getString("prompt")
  if (!promptId) throw new BadRequestError("Не указан промпт.")
  const p = e.app.findRecordById("prompts", promptId)
  e.record.set("prompt_title", p.getString("title"))
  e.record.set("prompt_author", p.getString("author"))
  e.next()
}, "reports")

onRecordUpdateRequest((e) => {
  const orig = e.record.original()
  for (const f of ["user", "reason", "comment", "prompt_title", "prompt_author"]) {
    e.record.set(f, orig.get(f))
  }
  e.next()
}, "reports")

// ===================== Собственные API =====================

// Счётчик просмотров промпта
routerAdd("POST", "/api/ph/prompts/{id}/view", (e) => {
  const id = e.request.pathValue("id")
  e.app.db()
    .newQuery("UPDATE prompts SET views = views + 1 WHERE id = {:id}")
    .bind({ id: id })
    .execute()
  return e.json(200, { ok: true })
})

// Статистика: число промптов по категориям и моделям, общие показатели
routerAdd("GET", "/api/ph/stats", (e) => {
  const byCat = arrayOf(new DynamicModel({ id: "", c: 0 }))
  e.app.db().newQuery("SELECT category AS id, COUNT(*) AS c FROM prompts GROUP BY category").all(byCat)
  const byModel = arrayOf(new DynamicModel({ id: "", c: 0 }))
  e.app.db().newQuery("SELECT model AS id, COUNT(*) AS c FROM prompts GROUP BY model").all(byModel)
  const totals = new DynamicModel({ prompts: 0, authors: 0, users: 0, ratings: 0 })
  e.app.db().newQuery(
    "SELECT (SELECT COUNT(*) FROM prompts) AS prompts, " +
    "(SELECT COUNT(DISTINCT author) FROM prompts) AS authors, " +
    "(SELECT COUNT(*) FROM users) AS users, " +
    "(SELECT COUNT(*) FROM ratings) AS ratings"
  ).one(totals)

  const categories = {}
  for (const r of byCat) categories[r.id] = r.c
  const models = {}
  for (const r of byModel) models[r.id] = r.c

  return e.json(200, {
    categories: categories,
    models: models,
    totals: { prompts: totals.prompts, authors: totals.authors, users: totals.users, ratings: totals.ratings },
  })
})

// Список авторов с числом опубликованных промптов и средним рейтингом
routerAdd("GET", "/api/ph/authors", (e) => {
  const rows = arrayOf(new DynamicModel({ id: "", name: "", avatar: "", bio: "", created: "", prompts: 0, rating: -0, views: 0 }))
  e.app.db().newQuery(
    "SELECT u.id AS id, u.name AS name, u.avatar AS avatar, u.bio AS bio, u.created AS created, " +
    "COUNT(p.id) AS prompts, COALESCE(AVG(NULLIF(p.rating_avg, 0)), 0) AS rating, COALESCE(SUM(p.views), 0) AS views " +
    "FROM users u JOIN prompts p ON p.author = u.id " +
    "WHERE u.is_active = 1 GROUP BY u.id ORDER BY prompts DESC, rating DESC"
  ).all(rows)
  const usersCol = e.app.findCollectionByNameOrId("users")
  return e.json(200, {
    collectionId: usersCol.id,
    items: rows.map((r) => ({
      id: r.id, name: r.name, avatar: r.avatar, bio: r.bio, created: r.created,
      prompts: r.prompts, rating: Math.round(r.rating * 10) / 10, views: r.views,
    })),
  })
})
