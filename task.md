# 🔬 AUDITORÍA Y REFACTORIZACIÓN INTEGRAL — RONDA APP
## Plan Ultra-Avanzado para Cline (Ejecutor Autónomo)

> **Contexto:** Este documento fue elaborado por Antigravity (Arquitecto) tras un análisis exhaustivo del codebase.
> **Objetivo:** Garantizar que TODOS los flujos estén 100% operativos, el código sea robusto, tipado y mantenible.
> **Regla:** Lee `AGENTS.md` antes de comenzar. Usa `grep -n` antes de leer archivos completos. Marca `[x]` cada tarea completada.

---

## FASE 1 — COMPILACIÓN Y TIPADO ESTRICTO

### 1.1 Activar `strict: true` en `tsconfig.json`
- [x] Cambiar `"strict": false` → `"strict": true` en `tsconfig.json`.
- [x] Ejecutar `npx tsc --noEmit` y documentar todos los errores resultantes.
- [x] Corregir **cada error** de tipado sin usar `as any` salvo que sea técnicamente inevitable (ej. `window.WidgetCheckout`). Documentar cada `as any` restante con un comentario `// SAFETY:`.

### 1.2 Tipar `matches.ts` (JavaScript implícito dentro de TypeScript)
- [x] `src/matches.ts` tiene métodos sin tipar (`likeParticipant(myUid, targetUid)`, `calculateMutualMatches(participants)`, `createTemporaryChat(match)`, `generateReturnCoupon(userId)`). Agregar tipos explícitos a todos los parámetros y retornos.
- [x] Lo mismo para `src/ronda-core.ts`: métodos `_getPairKey(p1, p2)`, `getCollisionCost(p1, p2)`, `getAffinityScore(p1, p2)`, `generateNextRound(participants)` carecen de tipos. *(Nota: archivo muerto — SIN imports en `src/` — se eliminó (Fase 5.1).)*

### 1.3 Eliminar `as any` innecesarios
- [x] `src/app.ts:347` — `Auth.currentUser || { uid: 'guest', role: 'client' } as any` → crear un tipo `GuestUser` o usar el tipo `User` con valores por defecto.
- [x] `src/views/profile-modal.ts:150` — mismo patrón, misma solución.
- [x] `src/superadmin.ts:119` — `user.role = role as any` → ampliar el tipo `User.role` a un union type con todos los roles válidos.
- [x] `src/bar.ts:662` — `(window as any).Auth?.currentUser` → importar `Auth` directamente del módulo `./auth.js`.
- [x] `src/auth.ts:168` — `(this._getAuth() as any).currentUser` → usar el tipo correcto de Firebase Auth (`Auth` de `firebase/auth` ya tiene `.currentUser`).
- [x] `src/db.ts:203` — `event as any` en `setDoc` → definir la interfaz `RondaEvent` y usarla.
- [x] `src/firebase-config.ts` — `db` declarado como `let db: any` → tiparlo como `Firestore`. *(ya era `const db: Firestore` tras la optimización de IndexedDB.)*

### 1.4 Verificación final de compilación
- [x] Ejecutar `npx tsc --noEmit` — **cero errores**.
- [x] Ejecutar `npm run build` — **cero errores**.

---

## FASE 2 — AUDITORÍA DE FLUJOS FUNCIONALES

### 2.1 Flujo de Autenticación (`src/auth.ts` + `src/app.ts` + `index.html`)
- [ ] **Login con email:** Verificar que `Auth.loginWithEmail()` → `onAuthStateChanged` → `auth:login` event → `updateNavbar()` → `switchView('view-lobby')` funcione sin errores en consola.
- [ ] **Registro con email:** Verificar que `Auth.registerWithEmail()` crea el usuario en Firebase Auth Y en Firestore (`DB.saveUser`), incluyendo los campos `linkedinVerified`, `zodiacSign`, `birthDate`.
- [ ] **Perfil incompleto:** Verificar que `auth:needsProfile` event abre el `modal-profile` correctamente y que al guardar redirige a `view-lobby`.
- [ ] **Logout:** Verificar que `Auth.logout()` limpia `currentUser`, emite `auth:logout` y muestra `view-auth`.
- [ ] **Reconexión (sesión persistida):** Verificar que al recargar la página, `onAuthStateChanged` detecta la sesión existente, carga el perfil de Firestore y navega al panel correcto según el `role`.

### 2.2 Flujo de Navegación (`src/router.ts` + `src/app.ts`)
- [ ] **Nota Crítica:** `src/router.ts` exporta `Router` pero `src/app.ts` no lo usa; `app.ts` tiene su propia lógica de `switchView`/`getPathViewMapping` duplicada. Decidir: ¿unificar en Router o eliminar `router.ts`? Elegir la opción que minimice el diff y unificar.
- [ ] **URL directa `/admin`:** Verificar que `admin.html` carga su propio entry point (`src/entry-admin.ts`) y no depende de `app.ts`.
- [ ] **URL directa `/superadmin`:** Verificar lo mismo con `superadmin.html` / `src/entry-superadmin.ts`.
- [ ] **URL directa `/crm`:** Verificar `crm.html` / `src/entry-crm.ts`.
- [ ] **URL directa `/network`:** Verificar `network.html` / `src/entry-network.ts`.
- [ ] **Botón Atrás del navegador (popstate):** Verificar que funciona entre `view-lobby` ↔ `view-client` ↔ `view-profile` sin quedar en pantalla negra.

### 2.3 Flujo de Descubrimiento de Eventos (`src/client.ts`)
- [ ] **`renderDiscoveryFeed()`:** Verificar que el `#discovery-feed` se llena con las tarjetas de `RONDA_EVENTS`. Si está vacío, investigar si `view-lobby` tiene clase `.on` aplicada.
- [ ] **Click en tarjeta de evento:** Verificar que `openEventModal(eventId)` abre el modal con la información correcta del evento (fecha, bar, precio, carta de cócteles).
- [ ] **Reserva bloqueada:** Si ya hay una reserva activa, verificar que las demás tarjetas muestran 🔒 y el toast de bloqueo aparece.

### 2.4 Flujo de Pago (`src/payment.ts`)
- [ ] **Wompi Widget:** Si `VITE_WOMPI_PUBLIC_KEY` está definida, verificar que `loadWompiWidget()` carga el script dinámicamente y `WidgetCheckout` se invoca correctamente.
- [ ] **Fallback Nequi QR:** Si NO hay llave de Wompi, verificar que se muestra el `RondaDialog.confirm` con la imagen QR de Nequi y que al confirmar "Ya pagué" se marca `user.paymentPending = true` y `user.paymentMethod = 'nequi'`.
- [ ] **Seguridad:** Confirmar que `hasTicket` NUNCA se escribe desde el cliente; solo `paymentPending`. Buscar con `grep -n "hasTicket.*=.*true" src/` y asegurar que solo ocurre en el backend o en reglas de Firestore.

### 2.5 Flujo Post-Evento (Likes → Matches → Chat 72h)
- [ ] **`DB.pushLike()`:** Verificar que escribe en `events/{eventId}/likes/{fromUid}_{toUid}` con `{ from, to, like }`.
- [ ] **`DB.processEventMatches()`:** Verificar que:
  1. Intenta llamar a Vercel API primero (si `VITE_VERCEL_API_URL` está configurada).
  2. Si falla (timeout 4s), cae al fallback local.
  3. El fallback local lee los likes de Firestore, llama a `Matches.findMutualMatchesFromLikes()` y escribe los matches.
- [ ] **`findMutualMatchesFromLikes()`:** Verificar la lógica de derivar `from` del `id` del documento (seguridad: prevenir spoofing).
- [ ] **Chat temporal:** Verificar que `createTemporaryChat()` genera un `chatId` con expiración a 72h.

### 2.6 Flujo KYC / Verificación de Identidad (`src/verification.ts` + `src/face-verify.ts`)
- [ ] **LinkedIn Validation:** Verificar `validateLinkedInUrl()` acepta formatos válidos (`linkedin.com/in/...`) y rechaza URLs inválidas.
- [ ] **LinkedIn Verification:** Verificar `verifyLinkedInProfile()` extrae slug, headline y badge.
- [ ] **Verificación Facial (modo real):** Cuando `kycSimulated: false`, verificar que `startVerification()` solicita cámara, carga modelos de `face-api`, extrae descriptores y compara selfie vs documento.
- [ ] **Verificación Facial (modo simulado):** Cuando `kycSimulated: true`, verificar que devuelve `true` inmediatamente sin solicitar cámara.
- [ ] **OCR de Cédula:** Verificar que `validateCedulaText()` detecta "REPUBLICA DE COLOMBIA" y "CEDULA DE CIUDADANIA".

### 2.7 Panel Admin / Anfitrión (`src/bar.ts` + `admin.html`)
- [ ] **Escáner QR:** Verificar que `html5-qrcode` se inicializa y escanea códigos de reserva.
- [ ] **Asignación de mesas:** Verificar que el anfitrión puede asignar participantes a mesas.
- [ ] **Campanadas de rotación:** Verificar que el sistema de rotación `buildV2Plan` / `buildNightPlan` genera rondas válidas.
- [ ] **Cálculo de matches:** Verificar que el botón de "Calcular Matches" invoca `DB.processEventMatches()`.

### 2.8 Panel SuperAdmin (`src/superadmin.ts` + `superadmin.html`)
- [ ] **Listado de usuarios:** Verificar que carga y muestra usuarios de Firestore.
- [ ] **Cambio de rol:** Verificar que `changeUserRole()` actualiza el documento en Firestore.
- [ ] **Creación de eventos:** Verificar el flujo de crear un nuevo evento y guardarlo.

### 2.9 Panel CRM (`src/crm.ts` + `crm.html`)
- [ ] **Listado de leads:** Verificar que carga los registros de lista de espera.
- [ ] **WhatsApp deeplink:** Verificar que los botones de contacto generan URLs de WhatsApp correctas.

### 2.10 Panel Network (`src/network.ts` + `network.html`)
- [ ] **Matches del usuario:** Verificar que carga y muestra los matches del usuario autenticado.
- [ ] **Chat temporal:** Verificar que abre el chat si el match está dentro del periodo de 72h.

---

## FASE 3 — AUDITORÍA DE BACKEND SERVERLESS (Vercel)

### 3.1 `functions-vercel/api/_lib.js`
- [ ] Verificar que `verifyFirebaseToken(req)` valida el `Bearer` token de Firebase Auth correctamente.
- [ ] Verificar que `getFirestoreAdmin()` inicializa el SDK de Firebase Admin con las credenciales correctas (`FIREBASE_SERVICE_ACCOUNT_RONDA_UNO`).

### 3.2 `functions-vercel/api/process-matches.js`
- [ ] Verificar que lee los likes de `events/{eventId}/likes`, calcula matches mutuos y los escribe en Firestore.
- [ ] Verificar manejo de errores (evento no existe, sin likes, etc.).

### 3.3 `functions-vercel/api/mint-nft.js`
- [ ] Verificar que genera el hash keccak256 de prueba de asistencia.
- [ ] Verificar fallback si Polygon/IPFS no están disponibles.

### 3.4 `functions-vercel/api/wompi-webhook.js`
- [ ] Verificar que valida la firma de seguridad (`checksum` / `signature`) del evento de Wompi.
- [ ] Verificar que actualiza `hasTicket: true` en Firestore al recibir `APPROVED`.
- [ ] Verificar que responde con `200 OK` para evitar reintentos.

---

## FASE 4 — AUDITORÍA DE CONEXIÓN CON EMULADORES

### 4.1 `src/firebase-config.ts`
- [ ] Verificar que la detección de `localhost` conecta automáticamente a los emuladores (Auth: 9099, Firestore: 8081).
- [ ] Verificar que el `try/catch` en `initializeFirestore` con `persistentLocalCache` funciona y que el fallback a `getFirestore` se activa si hay conflicto de tabs.
- [ ] Verificar que en producción (no localhost) NO se conectan los emuladores.

### 4.2 Prueba E2E con emuladores
- [ ] Con emuladores corriendo (`npx firebase emulators:start --only auth,firestore`), abrir `https://localhost:5000/` y verificar que la consola muestra "Conectado a Firebase Local Emulator Suite".
- [ ] Crear un usuario de prueba vía registro y confirmar que aparece en el Emulator UI (`http://localhost:4000`).

---

## FASE 5 — LIMPIEZA DE CÓDIGO MUERTO Y DUPLICACIONES

### 5.1 Código muerto
- [x] `src/ronda-core.ts` — Verificado con `grep -rn "ronda-core" src/`: 0 imports. **Eliminado** (`git rm`).
- [x] `src/router.ts` — **CORRECCIÓN al plan de Antigravity:** NO es código muerto. `src/views/profile-modal.ts` sí lo importa y lo usa (`Router.matchesAutonomousRoute()`, `Router.current`). Se restauró tras detectar error de compilación. La lógica duplicada en `app.ts` queda documentada como deuda técnica.
- [x] `window.firebaseModules` — Verificado: 0 referencias en runtime tras la limpieza del CDN en `index.html` (Fase de rendimiento).

### 5.2 Imports no usados
- [x] Ejecutado `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` temporalmente: 35 hallazgos en 15 archivos. Limpiados los seguros (12 archivos: imports muertos y locales sin uso). Pendientes documentados en `AUDIT_REPORT.md`: `seedDemo` en `mem-rr-history.ts`, params públicos (`userInfo`, `postState`) y `bench.ts` (restringido: no tocar `mem-rr-v2/`).

### 5.3 Consistencia de exports
- [x] Verificado: 9 singletons siguen `export const X = new XService()`; sin instanciaciones duplicadas (solo alias `export const Admin = HostConsole` en `bar.ts`).

---

## FASE 6 — SEGURIDAD Y HARDENING

### 6.1 Reglas de Firestore (`firestore.rules`)
- [x] Verificado (sesión de seguridad previa): `users/{uid}` solo escribible por su dueño salvo campos sensibles (`clientTouchedSensitive()`), likes solo con prefijo `request.auth.uid`, `hasTicket`/`role` no escribibles por cliente, `transactions` write=false.
- [x] No existen reglas permisivas; reglas endurecidas aplicadas.

### 6.2 Variables de entorno
- [x] `.gitignore` incluye `.env`, `.env.local` y `service-account*.json` (añadido en sesión de seguridad).
- [x] `firebase-config.ts` solo contiene llaves PÚBLICAS web (apiKey/cliente), no secretos.

### 6.3 CSP y Headers de Seguridad
- [x] `firebase.json` → `hosting.headers` con CSP (Firebase, Google Fonts permitidos), HSTS, X-Frame-Options, nosniff, Permissions-Policy.

---

## FASE 7 — VERIFICACIÓN FINAL

### 7.1 Compilación limpia
- [x] `npx tsc --noEmit` → **0 errores** (con `strict: true`).
- [x] `npx vite build` → **0 errores** (149 módulos; warnings de chunk size aceptables/preexistentes).

### 7.2 Smoke test con emuladores
- [ ] **PENDIENTE (requiere navegador):** Abrir `https://localhost:5000/` → Login con PIN → Login interno → Verificar que el discovery feed muestra los eventos.
- [ ] **PENDIENTE (requiere navegador):** Abrir `https://localhost:5000/admin.html` → Verificar que carga el panel del anfitrión.
- [ ] **PENDIENTE (requiere navegador):** Abrir `https://localhost:5000/superadmin.html` → Verificar que carga el panel de superadmin.
- [ ] **PENDIENTE (requiere navegador):** Abrir `https://localhost:5000/landing.html` → Verificar que carga la landing page pública.

### 7.3 Motor de matching
- [x] `node src/mem-rr-v2/bench.ts` → **✅ BENCH OK** — todas las aserciones pasaron (solvers vs fuerza bruta: 0 discrepancias; v2 cumple recencia/afinidad/fairness/cobertura; pares bloqueados: 0 violaciones; rendimiento: plan 12+12×9 en 0.0 ms).

### 7.4 Reporte final
- [x] Creado `AUDIT_REPORT.md` en la raíz del proyecto con hallazgos, archivos modificados/eliminados y deuda técnica.

---

## FASE 8 — TRUST TIERS Y KYC MULTI-AGENTE (SEGMENTO SIN LINKEDIN)

> **Documento de Trazabilidad Principal:** `docs/KYC_MULTIAGENT_EXECUTION_PLAN.md`  
> **Requisito del Negocio:** T2 obligatorio para comprar tickets y entrar a rotación. Costo $0.00 COP.

### 8.1 Tareas Asignadas a Cline (Ejecutor Autónomo)
- [ ] **[C-1] UI Captura Biométrica con Óvalo Guía:** En `src/verification.ts`, agregar al canvas de captura un óvalo guía semitransparente con feedback visual en tiempo real (rojo = fuera de cuadro/desenfocado, verde = óptimo para captura).
- [ ] **[C-2] Componente de Reto de Liveness en Pantalla:** Implementar el display interactivo que muestra las instrucciones aleatorias al usuario ("Parpadea ahora", "Gira la cabeza suavemente").
- [ ] **[C-3] Escáner de Cédula:** Integrar escaneo de código de barras/MRZ para el reverso del documento de identidad.
- [ ] **[C-4] Cola de Revisión Manual en SuperAdmin:** En `superadmin.html`, implementar el panel para el Administrador Central para revisar casos pendientes en `kycReviews` (visor de fotos lado a lado, métricas de confianza, botones de Aprobar T1 / Rechazar).
- [ ] **[C-5] Gating Estricto de Tier 2:** En `src/client.ts` y `src/bar.ts`, verificar que los usuarios con `trustTier < 2` no puedan comprar entradas ni ser admitidos al check-in sin pasar antes por verificación.

---

## ⚠️ RESTRICCIONES IMPORTANTES PARA CLINE

1. **NO modifiques `AGENTS.md` ni `docs/index.md`** (Prompt Caching).
2. **NO modifiques `src/mem-rr-v2/`** — ese módulo es responsabilidad exclusiva de DeepSeek Harness.
3. **NO modifiques `index.html` completo** — es un archivo XL (2479 líneas). Usa `grep -n` para localizar líneas específicas y edita solo los rangos necesarios.
4. **NO modifiques `src/client.ts` completo** — es un archivo XL (1938 líneas). Misma regla.
5. **Ejecuta `npx tsc --noEmit` después de CADA fase** para verificar que no introduces regresiones.
6. **Si un flujo requiere datos de prueba en Firestore**, créalos via los emuladores, no hardcodees datos en el código.

