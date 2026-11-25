/// <reference path="../pb_data/types.d.ts" />

// Схема данных PromptHub (ТЗ, п. 4.3 «Диаграмма классов»).
// Каждому классу соответствует коллекция PocketBase.

migrate((app) => {
  const ADMIN = '@request.auth.role = "admin"'
  const ACTIVE = '@request.auth.id != "" && @request.auth.is_active = true'

  const created = { type: "autodate", name: "created", onCreate: true, onUpdate: false }
  const updated = { type: "autodate", name: "updated", onCreate: true, onUpdate: true }

  // ---------- User ----------
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new SelectField({ name: "role", values: ["user", "admin"], maxSelect: 1 }))
  users.fields.add(new BoolField({ name: "is_active" }))
  users.fields.add(new TextField({ name: "bio", max: 500 }))
  const nameField = users.fields.getByName("name")
  nameField.required = true
  nameField.min = 2
  nameField.max = 40
  const avatarField = users.fields.getByName("avatar")
  avatarField.mimeTypes = ["image/jpeg", "image/png"]
  avatarField.maxSize = 2 * 1024 * 1024
  users.listRule = ""
  users.viewRule = ""
  users.createRule = ""
  users.updateRule = "id = @request.auth.id || " + ADMIN
  users.deleteRule = null
  // Заблокированный пользователь (is_active = false) не может войти.
  users.authRule = "is_active = true"
  app.save(users)

  // ---------- Category ----------
  const categories = new Collection({
    type: "base",
    name: "categories",
    listRule: "",
    viewRule: "",
    createRule: ADMIN,
    updateRule: ADMIN,
    deleteRule: ADMIN,
    fields: [
      { type: "text", name: "name", required: true, max: 60 },
      { type: "text", name: "slug", required: true, max: 60, pattern: "^[a-z0-9-]+$" },
      { type: "text", name: "icon", max: 8 },
      { type: "text", name: "description", max: 300 },
      { type: "number", name: "sort", onlyInt: true },
      created,
      updated,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_categories_slug ON categories (slug)"],
  })
  app.save(categories)

  // ---------- AIModel ----------
  const models = new Collection({
    type: "base",
    name: "ai_models",
    listRule: "",
    viewRule: "",
    createRule: ADMIN,
    updateRule: ADMIN,
    deleteRule: ADMIN,
    fields: [
      { type: "text", name: "name", required: true, max: 60 },
      { type: "text", name: "slug", required: true, max: 60, pattern: "^[a-z0-9-]+$" },
      { type: "number", name: "sort", onlyInt: true },
      created,
      updated,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_ai_models_slug ON ai_models (slug)"],
  })
  app.save(models)

  // ---------- Prompt ----------
  const prompts = new Collection({
    type: "base",
    name: "prompts",
    listRule: "",
    viewRule: "",
    createRule: ACTIVE + " && @request.body.author = @request.auth.id",
    updateRule: "(author = @request.auth.id && @request.auth.is_active = true) || " + ADMIN,
    deleteRule: "author = @request.auth.id || " + ADMIN,
    fields: [
      { type: "text", name: "title", required: true, min: 3, max: 100 },
      { type: "text", name: "text", required: true, min: 10, max: 2000 },
      { type: "text", name: "description", required: true, min: 10, max: 1000 },
      { type: "text", name: "usage", max: 1500 },
      { type: "relation", name: "category", required: true, maxSelect: 1, collectionId: categories.id, cascadeDelete: false },
      { type: "relation", name: "model", required: true, maxSelect: 1, collectionId: models.id, cascadeDelete: false },
      { type: "json", name: "tags", maxSize: 2000 },
      { type: "file", name: "image", maxSelect: 1, maxSize: 2 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png"], thumbs: ["600x340"] },
      { type: "relation", name: "author", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "number", name: "views", onlyInt: true, min: 0 },
      { type: "number", name: "rating_avg", min: 0, max: 5 },
      { type: "number", name: "rating_count", onlyInt: true, min: 0 },
      { type: "number", name: "reviews_count", onlyInt: true, min: 0 },
      { type: "date", name: "edited" },
      created,
      updated,
    ],
    indexes: [
      "CREATE INDEX idx_prompts_category ON prompts (category)",
      "CREATE INDEX idx_prompts_model ON prompts (model)",
      "CREATE INDEX idx_prompts_author ON prompts (author)",
      "CREATE INDEX idx_prompts_created ON prompts (created)",
    ],
  })
  app.save(prompts)

  // ---------- Rating ----------
  const ratings = new Collection({
    type: "base",
    name: "ratings",
    listRule: "",
    viewRule: "",
    createRule: ACTIVE + " && @request.body.user = @request.auth.id",
    updateRule: "user = @request.auth.id && @request.auth.is_active = true",
    deleteRule: "user = @request.auth.id || " + ADMIN,
    fields: [
      { type: "relation", name: "user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "relation", name: "prompt", required: true, maxSelect: 1, collectionId: prompts.id, cascadeDelete: true },
      { type: "number", name: "value", required: true, onlyInt: true, min: 1, max: 5 },
      created,
      updated,
    ],
    // один пользователь – одна оценка на промпт
    indexes: ["CREATE UNIQUE INDEX idx_ratings_user_prompt ON ratings (user, prompt)"],
  })
  app.save(ratings)

  // ---------- Review ----------
  const reviews = new Collection({
    type: "base",
    name: "reviews",
    listRule: "",
    viewRule: "",
    createRule: ACTIVE + " && @request.body.user = @request.auth.id",
    updateRule: "user = @request.auth.id && @request.auth.is_active = true",
    deleteRule: "user = @request.auth.id || " + ADMIN,
    fields: [
      { type: "relation", name: "user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "relation", name: "prompt", required: true, maxSelect: 1, collectionId: prompts.id, cascadeDelete: true },
      { type: "text", name: "text", required: true, min: 3, max: 1000 },
      created,
      updated,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_reviews_user_prompt ON reviews (user, prompt)"],
  })
  app.save(reviews)

  // ---------- Collection (подборки, в т.ч. «Избранное») ----------
  const selections = new Collection({
    type: "base",
    name: "selections",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: ACTIVE + " && @request.body.user = @request.auth.id",
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id && is_favorite = false",
    fields: [
      { type: "text", name: "name", required: true, max: 100 },
      { type: "relation", name: "user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "relation", name: "prompts", maxSelect: 1000, collectionId: prompts.id, cascadeDelete: false },
      { type: "bool", name: "is_favorite" },
      created,
      updated,
    ],
    indexes: ["CREATE INDEX idx_selections_user ON selections (user)"],
  })
  app.save(selections)

  // ---------- Report (жалобы) ----------
  const reports = new Collection({
    type: "base",
    name: "reports",
    listRule: "user = @request.auth.id || " + ADMIN,
    viewRule: "user = @request.auth.id || " + ADMIN,
    createRule: ACTIVE + " && @request.body.user = @request.auth.id",
    updateRule: ADMIN,
    deleteRule: ADMIN,
    fields: [
      { type: "select", name: "reason", required: true, maxSelect: 1, values: ["spam", "broken", "offensive"] },
      { type: "text", name: "comment", max: 1000 },
      { type: "select", name: "status", maxSelect: 1, values: ["new", "resolved", "rejected"] },
      { type: "text", name: "decision", max: 1000 },
      { type: "relation", name: "user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: "relation", name: "prompt", required: false, maxSelect: 1, collectionId: prompts.id, cascadeDelete: false },
      { type: "text", name: "prompt_title", max: 100 },
      { type: "relation", name: "prompt_author", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      created,
      updated,
    ],
  })
  app.save(reports)
}, (app) => {
  for (const name of ["reports", "selections", "reviews", "ratings", "prompts", "ai_models", "categories"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (_) {}
  }
})
