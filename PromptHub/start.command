#!/bin/bash
# PromptHub — запуск одним двойным щелчком (macOS).
# Собирает и поднимает контейнеры через Docker Compose и открывает сайт в браузере.

cd "$(dirname "$0")" || exit 1

PORT="${PH_PORT:-8080}"
URL="http://localhost:${PORT}"

echo "=============================================="
echo "  PromptHub — каталог AI-промптов"
echo "=============================================="

fail() {
  echo
  echo "Ошибка: $1"
  echo
  read -r -p "Нажмите Enter, чтобы закрыть окно…" _
  exit 1
}

# Docker Desktop / colima / OrbStack обычно не попадают в PATH при запуске из Finder
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:$HOME/.orbstack/bin:$PATH"

command -v docker >/dev/null 2>&1 || fail "Docker не найден. Установите Docker Desktop: https://www.docker.com/products/docker-desktop/"

# 1. Запускаем Docker, если он не работает
if ! docker info >/dev/null 2>&1; then
  echo "→ Docker не запущен, запускаю…"
  if command -v colima >/dev/null 2>&1; then
    colima start || fail "не удалось запустить colima."
  elif [ -d "/Applications/OrbStack.app" ]; then
    open -a OrbStack
  elif [ -d "/Applications/Docker.app" ]; then
    open -a Docker
  else
    fail "Docker установлен, но не запущен. Запустите его вручную."
  fi
  echo -n "→ Ожидаю готовности Docker"
  for _ in $(seq 1 90); do
    docker info >/dev/null 2>&1 && break
    echo -n "."
    sleep 2
  done
  echo
  docker info >/dev/null 2>&1 || fail "Docker не запустился за 3 минуты."
fi

docker compose version >/dev/null 2>&1 || fail "не найден плагин docker compose."

# 2. Сборка и запуск контейнеров
echo "→ Собираю и запускаю контейнеры (первый запуск может занять несколько минут)…"
PH_PORT="$PORT" docker compose up -d --build || fail "не удалось собрать или запустить контейнеры."

# 3. Ждём, пока сайт начнёт отвечать
echo -n "→ Ожидаю запуска сайта"
for _ in $(seq 1 60); do
  if curl -fsS "${URL}/api/health" >/dev/null 2>&1; then
    echo " готово!"
    break
  fi
  echo -n "."
  sleep 1
done
echo

curl -fsS "${URL}/api/health" >/dev/null 2>&1 || fail "сайт не отвечает. Логи: docker compose logs"

# 4. Открываем браузер
open "$URL"

cat <<EOF

PromptHub запущен: ${URL}

  Администратор:      admin@prompthub.local / admin12345
  Пользователь:       alexey@prompthub.local / password123
  Панель PocketBase:  ${URL}/_/  (admin@prompthub.local / admin12345)
  Почта (Mailpit):    http://localhost:8025  — письма сброса пароля

Остановить:  docker compose down        (в папке проекта)
Сбросить БД: docker compose down -v

Окно можно закрыть — сайт продолжит работать.
EOF
