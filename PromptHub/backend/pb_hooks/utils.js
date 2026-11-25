// Общие функции для хуков PromptHub.
// Подключаются внутри обработчиков через require(`${__hooks}/utils.js`).

function isAdmin(e) {
  if (e.hasSuperuserAuth && e.hasSuperuserAuth()) return true
  return !!(e.auth && e.auth.collection().name === "users" && e.auth.getString("role") === "admin")
}

// Пересчёт средней оценки и числа оценок/отзывов промпта.
// Используется прямой SQL, чтобы не менять поле updated промпта.
function recalcPrompt(app, promptId) {
  if (!promptId) return
  const r = new DynamicModel({ c: 0, a: -0 })
  app.db()
    .newQuery("SELECT COUNT(*) AS c, COALESCE(AVG(value), 0) AS a FROM ratings WHERE prompt = {:p}")
    .bind({ p: promptId })
    .one(r)
  const rv = new DynamicModel({ c: 0 })
  app.db()
    .newQuery("SELECT COUNT(*) AS c FROM reviews WHERE prompt = {:p}")
    .bind({ p: promptId })
    .one(rv)
  app.db()
    .newQuery("UPDATE prompts SET rating_avg = {:a}, rating_count = {:c}, reviews_count = {:rc} WHERE id = {:p}")
    .bind({ a: Math.round(r.a * 10) / 10, c: r.c, rc: rv.c, p: promptId })
    .execute()
}

function nowISO() {
  return new Date().toISOString().replace("T", " ")
}

module.exports = { isAdmin, recalcPrompt, nowISO }
