# PromptHub — запуск на Windows.
# Запускает Docker Desktop (если он выключен), собирает и поднимает контейнеры
# через Docker Compose и открывает сайт в браузере.
# Обычно запускается двойным щелчком по start.bat.

# 'Continue', а не 'Stop': в Windows PowerShell 5.1 вывод docker в stderr
# иначе превращается в исключение и обрывает скрипт.
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
Set-Location -LiteralPath $PSScriptRoot
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$port = if ($env:PH_PORT) { $env:PH_PORT } else { '8080' }
$env:PH_PORT = $port
$url = "http://localhost:$port"

function Fail([string]$message) {
    Write-Host ''
    Write-Host "Ошибка: $message" -ForegroundColor Red
    Write-Host ''
    Read-Host 'Нажмите Enter, чтобы закрыть окно'
    exit 1
}

function Test-Docker {
    cmd /c "docker info >nul 2>&1"
    return ($LASTEXITCODE -eq 0)
}

function Test-Site {
    try {
        $r = Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing -TimeoutSec 3
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

Write-Host '=============================================='
Write-Host '  PromptHub — каталог AI-промптов'
Write-Host '=============================================='

# 1. Docker установлен?
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    $dockerBin = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
    if (Test-Path (Join-Path $dockerBin 'docker.exe')) {
        $env:Path = "$dockerBin;$env:Path"
    } else {
        Fail 'Docker не найден. Установите Docker Desktop: https://www.docker.com/products/docker-desktop/'
    }
}

# 2. Запускаем Docker Desktop, если он не работает
if (-not (Test-Docker)) {
    Write-Host '-> Docker не запущен, запускаю Docker Desktop...'
    $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path $desktop) {
        Start-Process -FilePath $desktop | Out-Null
    } else {
        Fail 'Docker установлен, но не запущен. Запустите Docker Desktop вручную и повторите.'
    }
    Write-Host -NoNewline '-> Ожидаю готовности Docker'
    for ($i = 0; $i -lt 90; $i++) {
        if (Test-Docker) { break }
        Write-Host -NoNewline '.'
        Start-Sleep -Seconds 2
    }
    Write-Host ''
    if (-not (Test-Docker)) { Fail 'Docker не запустился за 3 минуты.' }
}

cmd /c "docker compose version >nul 2>&1"
if ($LASTEXITCODE -ne 0) { Fail 'не найден docker compose. Обновите Docker Desktop.' }

# Порт уже занят другой программой?
$busy = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue
if ($busy -and -not (Test-Site)) {
    $owner = (Get-Process -Id $busy[0].OwningProcess -ErrorAction SilentlyContinue).ProcessName
    if ($owner -notmatch 'docker|com\.docker|wslrelay|vpnkit') {
        Fail "порт $port занят программой '$owner'. Закройте её или запустите на другом порту: set PH_PORT=3000 и снова start.bat"
    }
}

# 3. Сборка и запуск контейнеров
Write-Host '-> Собираю и запускаю контейнеры (первый запуск может занять несколько минут)...'
cmd /c "docker compose up -d --build"
if ($LASTEXITCODE -ne 0) { Fail 'не удалось собрать или запустить контейнеры. Логи: docker compose logs' }

# 4. Ждём, пока сайт начнёт отвечать
Write-Host -NoNewline '-> Ожидаю запуска сайта'
for ($i = 0; $i -lt 60; $i++) {
    if (Test-Site) { break }
    Write-Host -NoNewline '.'
    Start-Sleep -Seconds 1
}
Write-Host ''
if (-not (Test-Site)) { Fail 'сайт не отвечает. Посмотрите логи: docker compose logs' }

# 5. Открываем браузер
Start-Process $url

Write-Host ''
Write-Host "PromptHub запущен: $url" -ForegroundColor Green
Write-Host ''
Write-Host '  Администратор:      admin@prompthub.local / admin12345'
Write-Host '  Пользователь:       alexey@prompthub.local / password123'
Write-Host "  Панель PocketBase:  $url/_/  (admin@prompthub.local / admin12345)"
Write-Host '  Почта (Mailpit):    http://localhost:8025  - письма сброса пароля'
Write-Host ''
Write-Host 'Остановить:  docker compose down      (в папке проекта)'
Write-Host 'Сбросить БД: docker compose down -v'
Write-Host ''
Write-Host 'Окно можно закрыть - сайт продолжит работать.'
Read-Host 'Нажмите Enter, чтобы закрыть окно'
