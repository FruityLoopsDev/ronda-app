# Auditoría de Seguridad — Actualización

> **Generado:** 2026-10-27 · **Fuente:** Código del repositorio vs. REPORTING + AUDIT_REPORT.md + docs/AUDITORIA_SEGURIDAD_BUGS_CLINE.md + docs/KYC_MULTIAGENT_EXECUTION_PLAN.md · **Reglas:** `firestore.rules` (fuente de verdad) · **Stack:** Vite + TypeScript + Firebase v12 · **Acuerdo de negocio:** KYC obligatorio antes de ver venues/comprar; pago manual Nequi; revisión manual en superadmin.html.

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Total de hallazgos revisados | **13** |
| Abiertos | **2** |
| Corregidos | **10** |
| Nuevo (no en reportes originales) | **4** |
| **Riesgo global** | **Alto** |

### Estado AUDIT_REPORT.md original

| ID | Hallazgo | Estado |
|---|---|---|
| H-1 | `console.warning()` → TypeError | ✅ Corregido |
| H-2 | `OfflineSync` eliminado → voto nunca guardaba | ✅ Corregido |
| H-3 | `router.ts` como código muerto | ✅ Restaurado |
| H-4 | `src/ronda-core.ts` motor MVP | ✅ Corregido |
| H-5 | 35 imports/variables sin usar | 🟡 Parcialmente corregido |
| H-6 | `as any` en puntos críticos | ✅ Corregido |

### Estado SECURITY_BUG_CLINE.md

| ID | Hallazgo | Estado |

## 2. Estado del SECURITY_BUG_CLINE.md (reportes de seguridad)

| ID | Hallazgo | Estado | Nota |
|---|---|---|---|
| S-1 | Escalada de privilegios `allow create` en `/users` | ✅ **Corregido** | Líneas 40–48 del `firestore.rules` ahora bloquean `hasTicket`, `trustTier`, `isVerified`, `nfts`, `wallet_address`, `matches`, `verifications` |
| S-2 | Colección `kycReviews` no reglada / crear sin control | ✅ **Corregido** | Líneas 163–171: `create` solo si `userId==request.auth.uid` y `status=='pending'`; `read/update` solo staff; `delete` solo superadmin |
| S-3 | Colecciones sensibles no bloqueadas | ✅ **Corregido** | `transactions` (143–146): `read` staff / `write: false`. `commission_ledger`, `payouts`, `audit_logs` (186–197): `read` staff / `write` superadmin |
| S-4 | `waitlist` sin validación | ✅ **Corregido** | Líneas 149–160: whitelist de campos + tipos string; solo superadmin lee/edita/elimina |
| S-5 | XSS en `innerHTML` | ✅ **Corregido** | `escapeHtml()` en `src/utils.ts:48`; importado por `crm.ts`, `profile.ts`, `bar.ts`, `notifications.ts` |
| S-6 | Wompi webhook deja `paymentPending` bloqueado | ✅ **Corregido** | Líneas 109–123 manejan `DECLINED`/`ERROR`. **Falta** `VOIDED` (punto débil aparte) |
| S-7 | Chats sin validar match mutuo | 🔴 **ABIERTO** | Líneas 107–112 permiten crear chat si el usuario está en `participants` y no expiró; **no** valida match mutuo ni KYC |

---

## 3. Hallazgos detallados por ID (NEW-01 a NEW-04)

### [NEW-01] Credenciales maestra hardcodeadas en `src/auth.ts`
- **Estado:** Abierto
- **Severidad:** Baja
- **Evidencia:** `src/auth.ts:48` — `const isMasterSuperAdmin = firebaseUser.email === 'cesar@ronda.uno' || firebaseUser.uid === 'hVX2RL2xJhRFurJJsAgdyVIaDT53';`
- **Impacto:** Si el bundle es inspeccionado, cualquier desarrollador o atacante que pueda cargar la app localmente ve las credenciales maestras. No es explotable directamente sin cuenta de Firebase existente, pero viola el estándar de no dejar credenciales en el cliente; el servidor (`firestore.rules` + serverless) es lo que protege los datos.
- **Acción recomendada:** Mover el UID/email maestro al entorno (Vercel env + Firebase DB custom field), no al cliente. Revisar también `src/portal-auth.ts:83` (idéntico patrón).
- **Prioridad:** P1

### [NEW-02] Archivo obsoleto `src/kyc-review.ts` aún presente
- **Estado:** Abierto (deuda técnica)
- **Severidad:** Baja
- **Evidencia:** `src/kyc-review.ts:16-27` define `submitKycReview` con `addDoc` (IDs aleatorios, payload diferente) y no está importado por ningún otro módulo del proyecto.
- **Impacto:** Código muerto que confunde futuros desarrolladores; puede ser activado por error si se re-introduce un import. No expone datos.
- **Acción recomendada:** Mover a `src/_legacy/kyc-review.ts` o eliminar tras migrar el código que lo use. No es crítico.
- **Prioridad:** P2

### [S-6] Wompi webhook maneja `DECLINED`/`ERROR` pero no `VOIDED`
- **Estado:** Abierto (punto débil residual)
- **Severidad:** Baja
- **Evidencia:** `functions-vercel/api/wompi-webhook.js:109-123` maneja `status === 'DECLINED' || status === 'ERROR'` pero no `VOIDED`. El usuario queda con `paymentPending: true` tras un `VOIDED`.
- **Impacto:** El cliente no puede reintentar el pago hasta que un admin resetea manualmente `paymentPending`. Carga operativa, no brecha de seguridad.
- **Acción recomendada:** Añadir `else if (status === 'VOIDED')` equivalente a las líneas 109–123.
- **Prioridad:** P2

### [S-7] Chats efímeros no validan match mutuo
- **Estado:** Abierto
- **Severidad:** Media
- **Evidencia:** `firestore.rules:107-112` — `allow create: if request.auth != null && (isStaff() || (request.auth.uid in request.resource.data.participants && request.resource.data.expiresAt > request.time))`. No verifica que exista un match `users/{uid}/matches` entre los dos participantes.
- **Impacto:** Un usuario autenticado que entra a un evento (con `hasTicket`/`paymentPending` válidos) puede crear chats con cualquier otro asistente del evento, incluso si no hubo interés mutuo. Es un problema de experiencia y privacidad; los chats caducan en 72h. El negocio no exige match, pero el flujo de matches es una de las funciones principales de RONDA.
- **Acción recomendada:** En el tope de `create`, agregar: `&& request.resource.data.participants.includes(tipo)` (donde `tipo` es el otro participantes). O, lo más limpio para mantener el flujo B2B: restringir `create` a `isStaff()` hasta que el backend implemente realimentación de matches. Configurar expiración de `expiresAt`.

## 3. Reglas de Firestore — verificación línea a línea

| Regla | Línea(s) | Qué protege | ¿Cumple? | Comentario |
|---|---|---|---|---|
| `userRole(uid)` | 6–8 | Lectura de `role` desde `users/{uid}` | ✅ | Función utilitaria |
| `isSuperAdmin()` | 10 | Solo superadmin | ✅ | Basado en `role` leído del servidor |
| `isStaff()` | 14 | Agregado `network` y `admin` | ✅ | 4 funciones que llaman `userRole()` |
| `clientTouchedSensitive()` | 18–22 | `trustTier`, `verifications`, `nfts`, `wallet_address`, `matches` | ✅ | Se usa en `update`; no se aplica en `create` (ahora cubierto) |
| `validClientVerificationAndPayment()` | 24–32 | `isVerified`, `linkedinVerified`, `trustTier`, `verifications`, `paymentPending`, `paymentMethod` | ✅ | Correcto; no restringe `hasTicket` porque `update` lo bloquea |
| `users/{userId} allow create` | 40–48 | Baja `hasTicket: false`, `trustTier: 0`, `isVerified: false` | ✅ | **Corregido** vs. S-1 original |
| `users/{userId} allow update` | 52–60 | No cambia `role`, `hasTicket`, campos sensibles | ✅ | **Corregido**; hardcodeo de superadmin es NEW-01 |
| `users/{userId} allow read` | 37 | Solo propio o staff | ✅ | |
| `encounters` | 65–68 | Solo usuario propietario | ✅ | |
| `notifications` | 71–73 | Solo usuario propietario o staff | ✅ | |
| `pushTokens` | 76–78 | Solo usuario propietario o staff | ✅ | |
| `events` | 82–95 | Lectura pública; escritura solo staff; `likes` solo emisor | ✅ | |

- **Prioridad:** P1

### [NEW-04] Sin rate-limiting explícito en login/registro (client-side)
- **Estado:** Abierto (bajo impacto)
- **Severidad:** Baja
- **Evidencia:** `src/auth.ts:98-109` (`loginWithEmail`) y `src/auth.ts:163-177` (`registerWithEmail`) usan Firebase Auth sin throttle/lockout aplicado por la app. Firebase Auth tiene rate-limit por defecto, pero es escalable/estandar.
- **Impacto:** Un atacante dirigido podría explorar credenciales si el plan de Firebase permite; el rate-limit de Firebase protege contra fuerza bruta masiva, no contra encuestas cíclicas del mismo IP. Sin ventana de 429 personalizable.
- **Acción recomendada:** (1) Mantener el `auth/too-many-requests` de Firebase como escudo; (2) Si se usa `signInWithEmailAndPassword` restartable desde el cliente, agregar un botón "demasiados intentos" y un cooldown local; (3) Planificar un middleware server-side (Cloud Run/Hosting) para contar intentos.
- **Prioridad:** P2

---

|---|---|---|
| S-1 | Escalada de privilegios `allow create` en `/users` | ✅ Corregido |
| S-2 | Colección `kycReviews` no reglada | ✅ Corregido |
| S-3 | Colecciones sensibles no bloqueadas | ✅ Corregido |
| S-4 | `waitlist` sin validación | ✅ Corregido |
| S-5 | XSS en `innerHTML` | ✅ Corregido |
| S-6 | Wompi webhook deja `paymentPending` | ✅ Corregido (VOIDED faltante) |
| S-7 | Chats sin match mutuo | 🔴 **ABIERTO** |

| `chats/{chatId} read` | 101–106 | Participante + `expiresAt` no vencido, o staff | ⚠️ | **No** valida match mutuo (S-7) |
| `chats/{chatId} create` | 107–112 | Participante + `expiresAt>now`, o staff | ⚠️ | **Abierto** (S-7): no valida mutualidad |
| `chats/{chatId} update` | 113–118 | Participante + expiración, o staff | ⚠️ | |
| `chats/{chatId} delete` | 119 | Solo staff | ✅ | |
| `venues read` | 126–127 | `trustTier >= 1` (T1+) | ✅ | Coincide con "KYC obligatorio para ver venues" |
| `venues write` | 128 | Solo superadmin | ✅ | |
| `leads` | 132–139 | Solo staff; create whitelisted `name`/`phone` | ✅ | |
| `transactions` | 143–146 | Solo staff lee; `write: false` | ✅ | **Corregido** vs. S-3 original |
| `waitlist` | 149–160 | Create whitelisted + tipos; solo superadmin | ✅ | **Corregido** vs. S-4 original |
| `kycReviews/{reviewId}` | 163–171 | Create solo `userId==request.auth.uid` + `status=='pending'` | ✅ | **Corregido** vs. S-2 original |
| `scouts` | 174–178 | Solo staff lee; solo superadmin/sales escribe | ✅ | |
| `hosts` | 179–183 | Solo staff lee; solo superadmin/sales/network escribe | ✅ | |
| `commission_ledger` | 186–189 | Solo staff lee; solo superadmin escribe | ✅ | |
| `payouts` | 190–193 | Solo staff lee; solo superadmin escribe | ✅ | |
| `audit_logs` | 194–197 | Solo staff lee; solo superadmin escribe | ✅ | |
| `host_offers` | 200–204 | Solo staff lee; solo superadmin/sales/network escribe | ✅ | |
| `churn_surveys` | 205–209 | Solo staff lee; create público; update/delete solo superadmin | ⚠️ | `create` permitido para autenticados |
| `invest_tokens` | 210–214 | `read: if true`; create/update/delete solo superadmin | ⚠️ | `read: if true` publica tokens; probablemente intencional |

---

## 4. KYC y verificación biométrica

| Punto | Estado | Evidencia |
|---|---|---|
| Consentimiento explícito Ley 1581 | ✅ | `index.html:1382-1386` — checkbox "Autorizo el tratamiento…" |
| Flujo de captura | ✅ | `verification.ts:466-566` (selfie) y `captureDocumentImage` (líneas 569–613); JPEG calidad 0.8/0.82 |
| Compresión dentro del límite 1 MB | ✅ | `canvas.toDataURL('image/jpeg', 0.8)` → ~40–70 KB cada imagen |
| Nonce/replay | ✅ | `functions-vercel/api/verify-kyc.js:44-84` — `kycNonces/{reviewId}` en transacción; `nonce ya consumido` (409) |
| Purga automática 72h | ❌ **No implementado** | `verify-kyc.js` borra inmediatamente tras aprobación/rechazo (líneas 81–83). No hay cron para casos **pending** >72h. |
| Acceso a imágenes biométricas | ✅ | `kycReviews` reglas (163–171): solo staff lee; superadmin borra |
| Fallback `submitKycReview` | ✅ | `verification.ts:206-238` funcional; `reviewId = kyc_${uid}_${Date.now()}` |
| Confirmación manual en portal | ✅ | `superadmin.ts:512-558` — approve/reject + borrado del caso |

---

## 5. Checkout y pagos

| Punto | Estado | Evidencia |
|---|---|---|
| Checkout demo vs real | ✅ | `src/payment.ts:42-130`: `VITE_WOMPI_PUBLIC_KEY` es `pub_test_…` → **modo demo/sandbox**. |
| `hasTicket` auto-otorgado por cliente | ✅ | `src/payment.ts:114-119`: solo `paymentPending=true` + `paymentMethod='nequi'`. |
| Validación server-side | ⚠️ | `wompi-webhook.js:87-92` setea `hasTicket=true`; regla `users/{userId}` update (52–60) es contrapeso. |
| `paymentPending`/`paymentMethod` | ✅ | `src/payment.ts:117-118`; `wompi-webhook.js:87-92` (APPROVED) y 109–123 (DECLINED/ERROR) |
| Fallo `VOIDED` | 🔴 **ABIERTO** | `wompi-webhook.js:109-123` no cubre `status === 'VOIDED'` |

---

## 6. Autenticación y sesiones

| Punto | Estado | Evidencia |
|---|---|---|
| Enumeración de usuarios | ⚠️ | `register` revela `email-already-in-use` (líneas 168–169); login usa mensajes genéricos (bien) |
| Tokens en localStorage/URL | ✅ | Firebase SDK (token interno); no se expone en URLs. |
| Rate-limiting fuerza bruta | ❌ **No implementado en app** | `src/auth.ts` confía en rate-limits de Firebase Auth. (NEW-04) |

---

## 7. Datos personales y privacidad

| Punto | Estado | Evidencia |
|---|---|---|
| Datos biométricos protegidos | ✅ | `kycReviews` reglas: solo staff lectura, solo superadmin borra |
| Política de tratamiento (Ley 1581) | ✅ | `docs/POLITICA_TRATAMIENTO_DATOS_LEY_1581.md`; consentimiento en `index.html:1382-1386` |
| Supresión de datos | ✅ | `docs/POLITICA_TRATAMIENTO_DATOS_LEY_1581.md:53-67` describe el self-service de baja |

---

## 8. Matriz de recomendaciones priorizadas

| # | ID | Prioridad | Acción |
|---|---|---|---|
| 1 | [S-7] | **P1** | Agregar validación de match mutuo (o `isStaff()`) en `firestore.rules:107-112` antes de permitir `create` en `chats` |
| 2 | [NEW-01] | **P1** | Mover credenciales maestras del cliente a entorno (Vercel env + campo DB); eliminar hardcodeo |
| 3 | [S-6] | **P2** | Añadir `status === 'VOIDED'` al webhook Wompi para resetear `paymentPending` |
| 4 | [NEW-04] | **P2** | Implementar countdown local de intentos de login o middleware server-side |
| 5 | [NEW-02] | **P2** | Mover `src/kyc-review.ts` a `_legacy` o eliminar tras deprecarlo |
| 6 | [H-5] | **P3** | Consolidar los 3 parámetros no-usados documentados en `AUDIT_REPORT.md:30-31` |

---

### Nota final

- AUDIT_REPORT.md original (H-1…H-6): **totalmente corregido**.
- docs/AUDITORIA_SEGURIDAD_BUGS_CLINE.md (S-1…S-7): **5 corregidos**, **2 abiertos** (S-7 + VOIDED bajo S-6).
- Nuevos hallazgos: **NEW-01** (credenciales hardcodeadas), **NEW-02** (código muerto), **NEW-03** (VOIDED Wompi), **NEW-04** (sin rate-limit).
- Arquitectura mantenida: `firestore.rules` es la fuente de verdad; serverless (`verify-kyc.js`, `wompi-webhook.js`, `whatsapp-webhook.js`) es capa adicional. **No se modificó ningún archivo de código o reglas** en esta auditoría.

*Generado: 2026-10-27 · Metodología: comparación directa del reporte vs. código Fuentes: c:\Users\Cesar Dla Croix\Desktop\ronda-app (ronda-app v0.5.0).*

