<template>
  <footer class="ph-footer mt-5">
    <div class="container py-5">
      <div class="row g-4">
        <div class="col-lg-5">
          <div class="ph-logo mb-2"><span class="ph-logo-mark"></span>PromptHub</div>
          <p class="text-muted small mb-3" style="max-width: 340px">Бесплатный каталог промптов для работы с искусственным интеллектом.</p>
          <div class="small text-muted">© PromptHub, {{ year }}</div>
        </div>
        <div class="col-6 col-md-4 col-lg-2">
          <h6>Каталог</h6>
          <ul class="list-unstyled small d-grid gap-2 mb-0">
            <li><RouterLink to="/catalog">Все промпты</RouterLink></li>
            <li><RouterLink to="/categories">Категории</RouterLink></li>
            <li><RouterLink :to="{ path: '/catalog', query: { sort: 'popular' } }">Популярное</RouterLink></li>
            <li><RouterLink to="/authors">Авторы</RouterLink></li>
          </ul>
        </div>
        <div class="col-6 col-md-4 col-lg-2">
          <h6>О проекте</h6>
          <ul class="list-unstyled small d-grid gap-2 mb-0">
            <li><RouterLink to="/page/how-it-works">Как это работает</RouterLink></li>
            <li><RouterLink to="/page/rules">Правила публикации</RouterLink></li>
            <li><RouterLink to="/page/about">О проекте</RouterLink></li>
          </ul>
        </div>
        <div class="col-md-4 col-lg-3">
          <h6>Правовая информация</h6>
          <ul class="list-unstyled small d-grid gap-2 mb-0">
            <li><RouterLink to="/page/privacy">Политика конфиденциальности</RouterLink></li>
            <li><RouterLink to="/page/terms">Условия использования</RouterLink></li>
            <li><RouterLink to="/page/feedback">Обратная связь</RouterLink></li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
const year = new Date().getFullYear()
</script>
