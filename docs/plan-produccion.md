# RONDA — Plan de trabajo: 100% producción + purga de base de datos

> **Estado:** EN EJECUCIÓN (Fase 2 ✅, Fase 3 pendiente)
> **Proyecto Firebase:** `ronda-uno` (ID: `la-ronda`, nº 391712707230) · URL: https://ronda-uno.web.app
> **Última actualización:** 2026-08-30 (purga ejecutada y verificada)

---

## 1. Objetivo

Llevar RONDA a **100% producción** y dejar la base de datos **purga total** (reset de datos, conservando esquema, reglas, índices, hosting y funciones) lista para clientes reales.

## 2. Alcance de la purga (confirmado con el dueño)

- **Reset total de datos**: vaciar todas las colecciones y subcolecciones de Firestore y **todos** los usuarios de Firebase Auth. ✅ **EJECUTADO (2026-08-30)**: 6 docs + 10 cuentas Auth eliminados; verificado 0/0.
- **NO se toca**: esquema (Firestore es schemaless; no hay migraciones), reglas (`firestore.rules`), índices, hosting, funciones, Storage.
- Storage: **el bucket `ronda-uno.firebasestorage.app` NO existe (404)** → nada que purgar (R9 resuelto).

## 3. Diagnóstico (auditoría rápida, 2026)

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| ✅ | App en línea: `https://ronda-uno.web.app` responde 200 | — | Verificado |
| ✅ | CI/CD: GitHub Actions despliega hosting a `live` en push a `main` con `VITE_IS_DEMO=false` | — | Verificado |
| ✅ | Reglas de Firestore endurecidas (roles, `transactions` solo servidor, sin auto-elevación) | — | Verificado |
| R1 | Demo mode por defecto: `isDemo: VITE_IS_DEMO !== 'false'` (build manual sin variable → BD en memoria) | Alta | ✅ HECHO (`build:prod`) |
| R2 | Wompi en sandbox: `VITE_WOMPI_PUBLIC_KEY` comentado en CI → llave `pub_test_...` | Crítica | Pendiente (sin llave prod) |
| R3 | Repo sin `.firebaserc`; `Desktop\.firebaserc` apunta a `opheleia-f4c4b` | Crítica | ✅ HECHO (`.firebaserc` → `ronda-uno`) |
| R4 | CI solo despliega hosting (rules y functions manual) | Alta | Parcial: rules en CI ✅ · functions sin Blaze |
| R5 | Functions en Node 16 (EOL) | Alta | Código listo (node 20) · deploy bloqueado por Blaze |
| R6 | Secrets de functions no verificados (`WOMPI_EVENTS_SECRET`, `POLYGON_RPC`, `RELAYER_PRIVATE_KEY`, `NFT_CONTRACT_ADDRESS`) | Alta | Pendiente (requiere Blaze para functions) |
| R7 | WIP sin commitear (`notifications.ts`, `satisfaction.ts`, etc.) en `feat/kyc-face-verify` (10 commits sobre `main`) | Media | Pendiente (decisión del dueño) |
| R8 | Sin inventario de datos pre-purga | Alta | ✅ HECHO (Fase 1) |
| R9 | Storage configurado sin uso en `src/` | Baja | ✅ HECHO (bucket no existe, 404) |
| R10 | Sin script de purga ni backup | Alta | ✅ HECHO (backup + purga ejecutada) |
| R11 | **Billing de `ronda-uno` CERRADO** ("billing account ... disabled in state closed") → sin GCS, sin Cloud Functions | **Crítica (bloqueador)** | **BLOQUEADO** — dueño sin presupuesto para Blaze por ahora |
| R12 | **No hay Cloud Functions desplegadas** (`functions:list` = vacío) → webhook Wompi, NFT y `processEventMatches` no existen | **Crítica (bloqueador)** | **BLOQUEADO** — depende de R11 |

**Colecciones activas** (según reglas/código): `users` (+ `users/{uid}/encounters`), `events` (+ `events/{id}/likes`), `venues`, `leads`, `transactions`, `waitlist`.

### Resultado de la auditoría (Fase 1, ejecutada)

| Colección | Docs | Observación |
|---|---|---|
| `users` | 5 | Todos de prueba: Julio César (cesarcruz@ronda.app), Juan Pérez (Firebase), Admin Bar Central (Firebase, rol `admin`), Julio/cesar (cesar@ronda.app), Andrés (andres@ronda.app) |
| `events` | 1 | `e1` stub (0 participantes, waiting) |
| `venues` / `leads` / `transactions` / `waitlist` | 0 | Vacías |
| Firebase Auth | 10 | Todos de prueba (cesar@ronda.uno, pablo@ronda.app, cliente@ronda.com, admin@ronda.com, …); 5 sin perfil en `users` |
| Subcolecciones | 0 | Sin `encounters` ni `likes` |

**Backup:** `backups/2026-08-30T00-09-04-453Z/` (6 docs + `inventory.json`) y `backups/auth-users.json` (10 cuentas Auth). Ambos excluidos de git (`.gitignore`).

## 4. Fases

### Fase 0 — Congelación y control de cambios
- [ ] Decidir destino del WIP (`feat/kyc-face-verify` → merge a `main` o descarte)
- [ ] Ventana de mantenimiento (app sin datos ~30–60 min)
- [ ] Tag de release pre-purga (ej. `v1.0.0-pre-purge`)

### Fase 1 — Auditoría y respaldo (pre-purga) ✅ COMPLETADA
- [x] `scripts/backup-db.cjs` (REST API + token gcloud, sin billing): inventario por colección + subcolecciones
- [x] Backup Firestore → `backups/<ts>/` (JSON por colección + `inventory.json`). *Nota: `gcloud firestore export` a GCS NO es posible (billing cerrado, R11); se usó export local vía REST.*
- [x] Exportar lista de Auth users → `backups/auth-users.json` (10 cuentas)
- [x] Verificación del backup (conteos vs auditoría) — consistente

### Fase 2 — Purga total ✅ COMPLETADA (2026-08-30)
- [x] `scripts/purge-db.cjs` (REST + Identity Toolkit, `--project ronda-uno` explícito):
  - [x] Borrar colecciones/subcolecciones: `users`, `encounters`, `events`, `likes`, `venues`, `leads`, `transactions`, `waitlist` → **6 docs eliminados**
  - [x] Borrar todos los usuarios de Firebase Auth (deshabilitar → `batchDelete`, lotes de 1000) → **10 cuentas eliminadas**
  - [x] Re-auditar: **0 docs, 0 users** (verificado con `backup-db.cjs` + `firebase auth:export`)
- [x] Storage: bucket NO existe (404) → sin datos

### Fase 3 — Reforestación mínima (bootstrap) ✅ COMPLETADA (2026-08-30)
- [x] Cuenta staff creada: **cesar@ronda.uno** (superadmin) — Auth UID `hVX2RL2xJhRFurJJsAgdyVIaDT53` + perfil en `users/{uid}` con `role: superadmin`
- [x] Credenciales guardadas en `backups/staff-cesar-credentials.txt` (gitignored) — cambiar contraseña tras primer login
- [ ] Smoke test de login del staff en producción (pendiente: requiere abrir la app; sugerido en Fase 5)

### Fase 4 — Cierre técnico de producción (parcial — Blaze bloquea functions)
- [x] R3: `.firebaserc` con `default: ronda-uno` ✅
- [x] R1: `scripts/build-prod.cjs` + `npm run build:prod` con `VITE_IS_DEMO=false` ✅
- [x] R4 (parcial): CI hosting-only ✅ · **rules desplegadas manualmente** (2026-08-30, ya estaban al día) · deploy ADC desde GH runners inestable (firebase-tools#10716) → comando manual documentado en el workflow
- [x] Fix CI: certs locales condicionales en `vite.config.ts` (build sin certs en CI) ✅
- [x] R5 (código): `engines` de functions → Node 20 (deploy pendiente de Blaze)
- [ ] R2: llave pública Wompi de producción + `VITE_WOMPI_PUBLIC_KEY` en CI — **bloqueado** (sin llave prod)
- [ ] R6: `firebase functions:secrets:set` — **bloqueado** (sin Blaze)
- [ ] Deploy functions — **bloqueado** (sin Blaze)

### Fase 5 — Verificación final y go-live
- [ ] Smoke tests E2E en producción (registro, login, evento, check-in, matches, widget Wompi con llave prod sin completar compra)
- [ ] Monitoreo: Cloud Logging / alertas en functions
- [ ] Runbook: backup, creación de evento, procesamiento de matches, secrets
- [ ] Actualizar README y docs con el estado final

## 5. Riesgos y mitigaciones

- **Despliegue a proyecto equivocado (R3)**: todo comando lleva `--project ronda-uno` explícito hasta agregar `.firebaserc`.
- **Pérdida de datos sin retorno (purga)**: backup verificado obligatorio antes de Fase 2; `purge-db.cjs` imprime conteos y pide confirmación (`--yes` para ejecutar).
- **Pagos en sandbox (R2)**: no anunciar cobros reales hasta configurar llave prod + webhook con `WOMPI_EVENTS_SECRET`.
- **Functions EOL (R5)**: si el deploy con Node 16 falla, es esperado; subir a Node 20 es prerequisito de Fase 4.

## 6. Decisiones pendientes del dueño

1. **Staff para Fase 3**: email(s) para las cuentas `superadmin`/`admin` que se recrearán (la purga ya eliminó las de prueba).
2. **Wompi producción (R2)**: conseguir llave pública de producción + `WOMPI_EVENTS_SECRET` (cuando haya presupuesto/Blaze).
3. **WIP (R7)**: ¿merge de `feat/kyc-face-verify` → `main` (incluye notificaciones/satisfacción) o descarte?

## 7. Registro de ejecución

| Fecha | Fase | Acción | Resultado |
|---|---|---|---|
| 2026-08-30 | 0/1 | Creación del plan + auditoría + backup | ✅ `docs/plan-produccion.md` · `scripts/backup-db.cjs` · `backups/2026-08-30T00-09-04-453Z/` · `backups/auth-users.json` |
| 2026-08-30 | 2 | Purga total ejecutada y verificada | ✅ Firestore 6→0 docs · Auth 10→0 users · Storage sin bucket |
| 2026-08-30 | 4 | Blindajes sin Blaze | ✅ `.firebaserc` (R3) · `build:prod` (R1) · rules en CI (R4) · engines node 20 (R5) |
| 2026-08-30 | 3 | Bootstrap staff | ✅ superadmin cesar@ronda.uno creado (Auth + Firestore) |
| 2026-08-30 | git | Merge feat/kyc-face-verify → main + push | ✅ `94100b3..f35a309` · CI deploy OK (run 33283729514) |
| 2026-08-30 | 4 | Fixes CI | ✅ vite.config certs condicionales (a74a627) · revert rules step ADC (ca95737) · rules desplegadas manualmente |
