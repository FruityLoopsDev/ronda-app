#Requires -Version 5.1
#
.SYNOPSIS
  Depurador de limpieza para dejar RONDA listo para produccion.

.DESCRIPTION
  Elimina datos ficticios, bases de datos locales, datos del emulador Firebase,
  logs, backups, cachés y artefactos de build.

  Por defecto hace DRY-RUN solo muestra qué borraría.
  Para borrar realmente
      powershell -ExecutionPolicy Bypass -File scriptscleanup-production.ps1 -Apply

  Limpieza extrema, incluyendo node_modules
      powershell -ExecutionPolicy Bypass -File scriptscleanup-production.ps1 -Apply -Deep

.NOTES
  No borra .env.template, firebase.json, firestore.rules, firestore.indexes.json,
  archivos HTMLJSTS de produccion ni configuracion del proyecto.
#

[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$Deep
)

$ErrorActionPreference = Stop
$Root = (Resolve-Path (Join-Path $PSScriptRoot ..)).Path

Write-Host 
Write-Host RONDA - Depurador de limpieza para produccion -ForegroundColor Cyan
Write-Host Proyecto $Root
Write-Host 

if (-not $Apply) {
    Write-Host MODO DRY-RUN no se eliminara nada. -ForegroundColor Yellow
    Write-Host Para ejecutar la limpieza real, usa -Apply -ForegroundColor Yellow
} else {
    Write-Host MODO APPLY se eliminaran los archivos y carpetas seleccionados. -ForegroundColor Red
}

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

function Remove-Target {
    param(
        [string]$Path,
        [string]$Reason
    )

    if ([string]IsNullOrWhiteSpace($Path)) { return }
    if (-not (Test-Path -LiteralPath $Path)) { return }

    $item = Get-Item -LiteralPath $Path -Force
    $relative = [System.IO.Path]GetRelativePath($Root, $item.FullName)

    if ($Apply) {
        try {
            Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop
            Write-Host [BORRADO] $relative - $Reason -ForegroundColor Green
        } catch {
            Write-Warning No se pudo borrar $relative - $($_.Exception.Message)
        }
    } else {
        Write-Host [PENDIENTE] $relative - $Reason -ForegroundColor Yellow
    }
}

function Remove-TargetPattern {
    param(
        [string]$Pattern,
        [string]$Reason
    )

    $matches = Get-ChildItem -Path $Root -Recurse -Force -File -Filter $Pattern -ErrorAction SilentlyContinue 
        Where-Object {
            $_.FullName -notmatch 'node_modules' -and
            $_.FullName -notmatch '.git'
        }

    foreach ($file in $matches) {
        Remove-Target -Path $file.FullName -Reason $Reason
    }
}

# ---------------------------------------------------------------------------
# 1. Artefactos de build y despliegue
# ---------------------------------------------------------------------------

Write-Host 
Write-Host 1. Limpiando artefactos de build y despliegue... -ForegroundColor Cyan

Remove-Target -Path (Join-Path $Root dist) -Reason Build anterior
Remove-Target -Path (Join-Path $Root .firebase) -Reason Cache de despliegue Firebase
Remove-Target -Path (Join-Path $Root firebase-debug.log) -Reason Log de Firebase
Remove-Target -Path (Join-Path $Root firestore-debug.log) -Reason Log de Firestore
Remove-Target -Path (Join-Path $Root ui-debug.log) -Reason Log del emulador UI

# ---------------------------------------------------------------------------
# 2. Datos locales del emulador Firebase
# ---------------------------------------------------------------------------

Write-Host 
Write-Host 2. Limpiando datos del emulador Firebase... -ForegroundColor Cyan

$emulatorDirs = @(
    firebase-emulator-data,
    .firebase-emulator,
    emulator-data,
    firestore_data,
    firestore-export,
    auth_export,
    storage_export
)

foreach ($dir in $emulatorDirs) {
    Remove-Target -Path (Join-Path $Root $dir) -Reason Datos locales del emulador Firebase
}

Remove-TargetPattern -Pattern .export -Reason Exportacion local del emulador
Remove-TargetPattern -Pattern .snapshot -Reason Snapshot local del emulador

# ---------------------------------------------------------------------------
# 3. Bases de datos y archivos de datos locales
# ---------------------------------------------------------------------------

Write-Host 
Write-Host 3. Limpiando bases de datos y archivos de datos locales... -ForegroundColor Cyan

$dbPatterns = @(
    .db,
    .sqlite,
    .sqlite3,
    .db-shm,
    .db-wal,
    .ldb,
    .jsonl,
    .ndjson
)

foreach ($pattern in $dbPatterns) {
    Remove-TargetPattern -Pattern $pattern -Reason Base de datos o archivo de datos local
}

# Carpetas tipicas de datos persistentes locales
$dataDirs = @(
    data,
    database,
    db,
    local-data,
    mock-data,
    seed-data,
    fixtures,
    test-data,
    test-fixtures,
    __mocks__
)

foreach ($dir in $dataDirs) {
    Remove-Target -Path (Join-Path $Root $dir) -Reason Datos locales, mocks o fixtures
}

# ---------------------------------------------------------------------------
# 4. Logs, backups y archivos temporales
# ---------------------------------------------------------------------------

Write-Host 
Write-Host 4. Limpiando logs, backups y temporales... -ForegroundColor Cyan

Remove-Target -Path (Join-Path $Root backups) -Reason Backups locales con posible PII
Remove-Target -Path (Join-Path $Root tmp) -Reason Archivos temporales
Remove-Target -Path (Join-Path $Root temp) -Reason Archivos temporales
Remove-Target -Path (Join-Path $Root .tmp) -Reason Archivos temporales
Remove-Target -Path (Join-Path $Root .cache) -Reason Cache local

Remove-TargetPattern -Pattern .log -Reason Log local
Remove-TargetPattern -Pattern .bak -Reason Backup local
Remove-TargetPattern -Pattern .old -Reason Archivo obsoleto
Remove-TargetPattern -Pattern .tmp -Reason Archivo temporal
Remove-TargetPattern -Pattern .orig -Reason Archivo de conflicto o respaldo

# ---------------------------------------------------------------------------
# 5. Archivos de prueba, migracion y utilidades de desarrollo
# ---------------------------------------------------------------------------

Write-Host 
Write-Host 5. Revisando scripts y archivos de prueba... -ForegroundColor Cyan

# Estos son archivos identificados como utilidades de migracion, refactor o prueba.
# Se marcan como candidatos Cline debe confirmar que ya no se necesitan antes de borrarlos.
$devUtilityFiles = @(
    fix-collisions.js,
    refactor.js,
    update-html.cjs,
    migrate.ps1,
    ronda-artifact.html
)

foreach ($file in $devUtilityFiles) {
    Remove-Target -Path (Join-Path $Root $file) -Reason Script o artefacto de desarrollomigracion
}

# Busca archivos con nombres de prueba o demo, fuera de node_modules y .git
$testNamePatterns = @(
    test.html,
    demo.html,
    mock.html,
    sandbox.html,
    prototype.html,
    test.js,
    demo.js,
    mock.js,
    seed.js,
    fixture.js
)

foreach ($pattern in $testNamePatterns) {
    Remove-TargetPattern -Pattern $pattern -Reason Archivo de prueba, demo, mock o seed
}

# ---------------------------------------------------------------------------
# 6. Limpieza profunda opcional
# ---------------------------------------------------------------------------

if ($Deep) {
    Write-Host 
    Write-Host 6. Limpieza profunda habilitada... -ForegroundColor Cyan

    Remove-Target -Path (Join-Path $Root node_modules) -Reason Dependencias instaladas; se pueden restaurar con npmpnpm install
    Remove-Target -Path (Join-Path $Root .vite) -Reason Cache de Vite
    Remove-Target -Path (Join-Path $Root node_modules.vite) -Reason Cache de Vite
    Remove-Target -Path (Join-Path $Root .pnpm-store) -Reason Cache local de pnpm
}

# ---------------------------------------------------------------------------
# 7. Verificacion final
# ---------------------------------------------------------------------------

Write-Host 
Write-Host 7. Verificacion final... -ForegroundColor Cyan

$requiredFiles = @(
    package.json,
    firebase.json,
    firestore.rules,
    firestore.indexes.json,
    .env.template,
    index.html,
    landing.html,
    invest.html,
    partners.html,
    vite.config.ts
)

$missing = @()

foreach ($file in $requiredFiles) {
    $path = Join-Path $Root $file
    if (-not (Test-Path -LiteralPath $path)) {
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Warning Faltan archivos esenciales del proyecto
    $missing  ForEach-Object { Write-Warning  - $_ }
    exit 1
}

Write-Host Archivos esenciales verificados correctamente. -ForegroundColor Green

if ($Apply) {
    Write-Host 
    Write-Host Limpieza completada. El proyecto quedo preparado para el siguiente paso de produccion. -ForegroundColor Green
    Write-Host Siguiente paso recomendado npm install && npm run buildprod -ForegroundColor Cyan
} else {
    Write-Host 
    Write-Host Dry-run completado. Revisa la lista anterior y ejecuta con -Apply cuando estes seguro. -ForegroundColor Yellow
}