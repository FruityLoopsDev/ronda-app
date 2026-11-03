# Auditoría Forense Exhaustiva y Plan de Ejecución para Cline — RONDA v2.3.1

> **Fecha de Auditoría:** 2026-11-02  
> **Arquitecto / Auditor:** Antigravity (Skills: `auditoria-ronda` + `project-security-auditor`)  
> **Ejecutor Asignado:** Cline (VS Code Autonomous Agent)  
> **Estado del Proyecto Base:** `v2.3.1-prod` (CRM v2 Fases F0–F3 completadas, `tsc --noEmit` 0 errores, `test:b2b` 19/19 OK)

---

## 1. Resumen Ejecutivo y Matriz de Hallazgos Activos
únicamente a tu UID maestro
Tras auditar las reglas de Firestore (`firestore.rules`), headers y políticas de `firebase.json`, endpoints Serverless (`functions-vercel/api/*.js`), flujos de autenticación/autorización (`src/auth.ts`, `src/portal-auth.ts`, `src/db.ts`), biometría KYC (`src/verification.ts`, `src/kyc-review.ts`), consolas Staff (`src/superadmin.ts`, `src/network.ts`, `src/entry-network.ts`, `src/crm.ts`) y landings transaccionales (`partners.html`, `invest.html`), se identificaron **8 hallazgos activos** (4 Críticos `P0`, 3 Altos `P1`, 1 Medio `P2` con 4 sub-vectores):

| ID | Severidad | Categoría | Archivo(s) y Líneas | Resumen del Problema |
| :--- | :---: | :--- | :--- | :--- |
| **P0-SEC-1** | 🔴 Crítico | Auth / Privilege Escalation | `firestore.rules:6-12` | `isMasterAdmin()` otorga rol `superadmin` a cualquier email `@ronda.uno` **sin verificar `email_verified == true`**. Permite crear cuentas con ese dominio en Firebase Auth y obtener permisos administrativos sobre Firestore. |
| **P0-SEC-2** | 🔴 Crítico | Data Leak / PII Inversores | `firestore.rules:341-345`, `invest.html:2198` | `/invest_tokens/{tokenId}` tiene `allow read: if true` (`get` + `list`). Permite listar todos los tokens y PII (`name`, `phone`, `notes`, `ring`) de inversores FFF sin autenticación. |
| **P0-SEC-3** | 🔴 Crítico | Flujo B2B Roto (`403`) | `firestore.rules:242-256`, `partners.html:2248`, `src/db.ts:878` | `partners.html` envía postulaciones de bares vía REST sin sesión (`status: 'lead'`, sin `sales_uid`), pero `firestore.rules:245` exige `request.auth != null && sales_uid == request.auth.uid`, bloqueando el 100% de leads entrantes de la landing B2B. |
| **P0-SEC-4** | 🔴 Crítico | Flujo KYC / Perfil Roto | `src/verification.ts:224-240,836`, `src/db.ts:545-575,626`, `firestore.rules:57,294-298` | (A) `verification.ts` escribe `uid` y `status: 'approved'` en `kycReviews`, pero las reglas exigen `userId` y `status == 'pending'`. (B) `CLIENT_ALLOWED_USER_FIELDS` omite `emergencyContact`, `kycStatus` e `isPendingManualReview`, y `firestore.rules` bloquea `isVerified`, perdiendo la verificación y el contacto de emergencia al recargar. (C) Fallback `setDoc` en `db.ts:626` no filtra `fields`. |
| **P1-SEC-5** | 🟠 Alto | Stored XSS en Consolas Staff | `src/superadmin.ts:764-886`, `src/network.ts:108-115`, `src/portal-auth.ts:439-440`, `src/entry-network.ts:198,223` | Interpolación en `innerHTML` sin `escapeHtml()` de nombres de usuarios, emails, teléfonos, bares y mensajes de error en paneles con sesión privilegiada (`superadmin`, `network`, `portal-auth`). |
| **P1-SEC-6** | 🟠 Alto | Mass Assignment & Regla `/users` | `src/auth.ts:187-197`, `firestore.rules:67` | (A) En `registerWithEmail`, el spread `...profileData` va al final del objeto `User`, pudiendo sobrescribir `uid`, `role`, `isVerified`. (B) `DB.countUsers()` falla con `PERMISSION_DENIED` para clientes nuevos porque `/users` no permite agregación no-staff, rompiendo el Club Fundador 100. |
| **P1-SEC-7** | 🟠 Alto | Integridad de Pagos y Web3 | `functions-vercel/api/wompi-webhook.js:58-115`, `functions-vercel/api/mint-nft.js:23,66-67` | (A) `wompi-webhook.js` no valida `tx.amount_in_cents` contra el precio real del evento (`events/{eventId}.price * 100`), no es idempotente y no limpia `paymentPending` en estado `VOIDED`. (B) `mint-nft.js` no verifica pertenencia de `venueId` para `admin` y genera un `txHash` falso con `Math.random()` si falta en el receipt. |
| **P2-SEC-8** | 🟡 Medio | Hardening Reglas y Geolocalización | `firebase.json:31`, `firestore.rules:157-169,284-289,355` | (A) `firebase.json` tiene `Permissions-Policy: geolocation=()`, bloqueando el GPS del navegador en producción (`crm.html` y `verification.ts`). (B) `/stats/visits` permite sobrescribir arbitrariamente el contador. (C) `/waitlist` no acota tamaño de campos. (D) `/chats` permite alterar `participants` en `update`. |

---

## 2. Plan de Ejecución Paso a Paso para Cline

> **Instrucciones para Cline:**  
> Ejecuta las siguientes **4 Fases** en orden estricto. Al finalizar cada fase, corre `npx tsc --noEmit` para asegurar 0 regresiones de tipos. Al concluir la Fase 4, ejecuta la batería completa de validación de la Sección 3.

---

### FASE 1: Blindaje de Reglas de Firestore y Headers de Producción (`P0-SEC-1`, `P0-SEC-2`, `P0-SEC-3`, `P2-SEC-8`)

#### Tarea 1.1 — Exigir `email_verified` en `isMasterAdmin()` y restringir a UID maestro y `cesar@ronda.uno` (`firestore.rules:6-12`)
En `firestore.rules`, actualiza `isMasterAdmin()` para restringir el acceso SuperAdmin de emergencia **exclusivamente** al UID maestro o a `cesar@ronda.uno` con verificación de correo confirmada:

```javascript
    // SuperAdmin de Emergencia: Exclusivo UID maestro o cesar@ronda.uno verificado
    function isMasterAdmin() {
      return isSignedIn() && (
        request.auth.uid == 'hVX2RL2xJhRFurJJsAgdyVIaDT53' ||
        (
          request.auth.token.email_verified == true &&
          request.auth.token.email == 'cesar@ronda.uno'
        )
      );
    }
```

#### Tarea 1.2 — Impedir listado público de `/invest_tokens` (`firestore.rules:341-345`)
En `firestore.rules`, separa `read` en `get` (para validar un código puntual en `invest.html`) y `list` (exclusivo para `isSuperAdmin()`):

```javascript
    match /invest_tokens/{tokenId} {
      allow get: if true;
      allow list: if isSuperAdmin();
      allow create, update, delete: if isSuperAdmin();
    }
```

#### Tarea 1.3 — Habilitar ingesta segura de Leads B2B desde `partners.html` (`firestore.rules:242-256`, `partners.html:2248`, `src/db.ts:878`)
1. En `firestore.rules`, dentro de `match /leads/{leadId}`, permite la creación de postulaciones entrantes desde `partners.html` bajo un esquema estricto y permite a los Scouts leer/reclamar leads `unassigned`:
```javascript
    match /leads/{leadId} {
      allow read: if isSuperAdmin() || isAdmin() || (
        isSales() && (
          resource.data.sales_uid == request.auth.uid ||
          resource.data.scout_uid == request.auth.uid ||
          resource.data.sales_uid == 'unassigned'
        )
      );
      allow create: if (
        (isSales() || isSuperAdmin() || isAdmin()) &&
        request.resource.data.sales_uid == request.auth.uid &&
        request.resource.data.name is string &&
        request.resource.data.name.size() > 0 &&
        request.resource.data.name.size() <= 150
      ) || (
        // Ingesta pública acotada desde partners.html (postulación de bares B2B)
        request.resource.data.keys().hasOnly(['id', 'name', 'zone', 'phone', 'status', 'source', 'notes', 'createdAt', 'sales_uid']) &&
        request.resource.data.status == 'lead' &&
        request.resource.data.sales_uid == 'unassigned' &&
        request.resource.data.name is string && request.resource.data.name.size() > 0 && request.resource.data.name.size() <= 150 &&
        request.resource.data.zone is string && request.resource.data.zone.size() <= 80 &&
        request.resource.data.phone is string && request.resource.data.phone.size() <= 40 &&
        request.resource.data.source in ['Desde Calculadora', 'Formulario Directo', 'Landing B2B'] &&
        request.resource.data.notes is string && request.resource.data.notes.size() <= 1000
      );
      allow update: if isSuperAdmin() || isAdmin() || (
        isSales() && (
          resource.data.sales_uid == request.auth.uid ||
          resource.data.scout_uid == request.auth.uid ||
          (resource.data.sales_uid == 'unassigned' && request.resource.data.sales_uid == request.auth.uid)
        )
      );
      allow delete: if isSuperAdmin();
    }
```
2. En `partners.html` (alrededor de la línea 2258), agrega `sales_uid: { stringValue: 'unassigned' }` al payload `fields` enviado a `/documents/leads`.

#### Tarea 1.4 — Hardening de `/chats`, `/waitlist`, `/stats/visits` y `Permissions-Policy` (`firestore.rules`, `firebase.json`)
1. En `firestore.rules` (`match /chats/{chatId}`):
   - En `allow create`: exige `request.resource.data.participants is list && request.resource.data.participants.size() == 2 && request.auth.uid in request.resource.data.participants`.
   - En `allow update`: exige `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['participants', 'id', 'eventId', 'createdAt'])`.
2. En `firestore.rules` (`match /waitlist/{entryId}`):
   - Exige `request.resource.data.keys().size() <= 12 && request.resource.data.name.size() <= 120 && request.resource.data.email.size() <= 150`.
3. En `firestore.rules` (`match /stats/{statId}`):
   - En `allow create`: exige `statId == 'visits' && request.resource.data.keys().hasOnly(['count']) && request.resource.data.count == 1`.
   - En `allow update`: exige `statId == 'visits' && request.resource.data.keys().hasOnly(['count']) && request.resource.data.count == resource.data.count + 1`.
4. En `firebase.json` (línea 31):
   - Cambia `"value": "camera=(self), microphone=(self), geolocation=()"` por `"value": "camera=(self), microphone=(self), geolocation=(self)"` para no bloquear el GPS en `/crm.html` ni en `Verification.requestLocation()`.

---

### FASE 2: Reparación del Flujo KYC, Perfil de Usuario y Registro (`P0-SEC-4`, `P1-SEC-6`)

#### Tarea 2.1 — Alinear esquema de `kycReviews` y persistencia de `kycStatus` / `emergencyContact` (`src/verification.ts`, `src/db.ts`, `firestore.rules`)
1. En `src/verification.ts`:
   - En `submitManualKycReview` (línea 224) y en el flujo de revisión de documento (línea 827): incluye siempre `userId: user.uid` además de `uid: user.uid`, y usa `status: 'pending'` al crear el documento en `kycReviews` desde el cliente (o invoca `POST /api/verify-kyc` con el Bearer token del usuario cuando la biometría automática apruebe el rostro para que el Admin SDK marque `isVerified: true` de forma segura).
2. En `src/db.ts` (`CLIENT_ALLOWED_USER_FIELDS`, líneas 545–575):
   - Añade `'emergencyContact'`, `'kycStatus'` e `'isPendingManualReview'` a `CLIENT_ALLOWED_USER_FIELDS`.
   - En el bloque `catch` de `DB.updateUserProfile` (línea 626), reemplaza `...fields` por `...safeFields` para impedir que el fallback `setDoc` escriba campos prohibidos como `role` o `isVerified`.
3. En `firestore.rules` (`match /users/{userId}`, líneas 53–64):
   - Permite que el propio usuario actualice `kycStatus` únicamente a `'pending'` (nunca a `'verified'` directamente desde cliente) y asegura que `/api/verify-kyc` sea quien escriba `isVerified: true` y `kycStatus: 'verified'`.

#### Tarea 2.2 — Prevenir Mass Assignment en `AuthService.registerWithEmail` y corregir Club Fundador 100 (`src/auth.ts:171-200`)
1. En `src/auth.ts` (`registerWithEmail`, línea 180):
   - Coloca `...profileData` **antes** de los campos de seguridad fijos para que nunca pueda sobrescribir `uid`, `role`, `isVerified`, `strikes` ni `noShowCount`:
   ```typescript
   const newProfile: User = {
       ...profileData,
       uid: cred.user.uid,
       role: 'client',
       name,
       email,
       phoneNumber: phone,
       gender,
       age,
       locality,
       avatar: gender === 'M' ? '🧔🏻' : '👩🏻',
       verificationStatus: true,
       isVerified: false,
   };
   ```
2. En `src/auth.ts` (línea 193):
   - Envuelve `DB.countUsers()` en un `try/catch` silencioso o lee un contador público en `/stats/founders` para que el fallo de permisos de `getCountFromServer(collection(db, 'users'))` no arroje errores en consola durante el registro.

---

### FASE 3: Sanitización Anti-XSS en Consolas Operativas (`P1-SEC-5`)

#### Tarea 3.1 — Sanitizar `src/superadmin.ts` (`renderEventsSection` y `renderBookingsSection`)
1. Importa `escapeHtml` desde `./utils` al inicio de `src/superadmin.ts`.
2. En `renderEventsSection` (líneas 760–815), aplica `escapeHtml()` a `e.name`, `e.venueName`, `e.dayDate`, `e.time` y `e.locality`.
3. En `renderBookingsSection` (líneas 860–886), aplica `escapeHtml()` a `b.user.name`, `b.user.email`, `b.user.phoneNumber`, `b.reservation.venueName`, `b.reservation.dayDate` y `b.reservation.eventId`.

#### Tarea 3.2 — Sanitizar `src/network.ts`, `src/entry-network.ts` y `src/portal-auth.ts`
1. En `src/network.ts` (líneas 108–115): envuelve `v.name`, `v.zone`, `v.address` y `conflicts[0].conflictingVenueName` con `escapeHtml(...)`.
2. En `src/entry-network.ts` (líneas 198 y 223): importa `escapeHtml` de `./utils` y sanitiza `message` y `errorText` antes de inyectarlos en `innerHTML`.
3. En `src/portal-auth.ts` (líneas 439–440): importa `escapeHtml` de `./utils` y sanitiza `user.name || user.email || user.uid` y `user.role` en `injectPortalHeaderBar`.

---

### FASE 4: Integridad de Webhooks de Pago y Endpoints Web3 (`P1-SEC-7`)

#### Tarea 4.1 — Validar precio del evento e idempotencia en `functions-vercel/api/wompi-webhook.js`
1. En `functions-vercel/api/wompi-webhook.js` (líneas 65–95):
   - Lee el documento `events/{eventId}` antes de confirmar la reserva.
   - Verifica que `tx.amount_in_cents >= Math.round(Number(eventData.price || 0) * 100)` y `tx.currency === 'COP'`. Si el monto pagado es menor al precio oficial del evento, registra una alerta en `payment_alerts` y rechaza la activación del ticket.
   - Verifica idempotencia: si `user.reservations` ya contiene una reserva con `wompiTransactionId === tx.id` y `status === 'confirmed'`, responde `200 OK` sin duplicar cupos (`eventCapacity.${eventId}`).
   - En la línea 109, incluye `tx.status === 'VOIDED'` junto a `'DECLINED'` y `'ERROR'` para limpiar `paymentPending`.

#### Tarea 4.2 — Autorización por `venueId` y eliminación de `txHash` falso en `functions-vercel/api/mint-nft.js`
1. En `functions-vercel/api/mint-nft.js`:
   - Si `caller.role === 'admin'`, verifica que `eventData.venueId === caller.venueId` antes de permitir el minting.
   - Elimina el fallback `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}` (líneas 66–67). Usa `receipt.hash || receipt.transactionHash` y, si no existe, lanza un error explícito `502 Bad Gateway` en lugar de persistir un hash falso en Firestore.

---

## 3. Protocolo de Verificación Obligatorio (Post-Ejecución Cline)

Una vez aplicadas las 4 fases, Cline debe ejecutar en orden:

1. **Chequeo estático TypeScript:**
   ```bash
   npx tsc --noEmit
   ```
2. **Tests unitarios y de regresión B2B / CRM:**
   ```bash
   node test/test-crm-commission.cjs
   npm run test:b2b
   ```
3. **Auditoría de contratos HTML / Footers:**
   ```bash
   npm run check:html
   ```
4. **Build de producción multi-página (Vite):**
   ```bash
   npm run build
   ```
5. **Actualización del grafo de conocimiento:**
   ```bash
   graphify update .
   ```
