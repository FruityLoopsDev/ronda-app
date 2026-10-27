# TASK — Cline: Panel "Liquidaciones B2B" (Superadmin) + Ledger del Scout (CRM)

> **Delegado por:** Antigravity (Arquitecto) → **Ejecutor:** Cline
> **Spec fuente:** [b2b-scouts-hosters-spec-v5.md](./b2b-scouts-hosters-spec-v5.md) · **Playbook:** [playbook-scout-retencion-90d.md](./playbook-scout-retencion-90d.md)

## 0. Reglas innegociables
- **NO desplegar** (`firebase deploy`) ni ejecutar `migrate-b2b-leads.cjs --execute` sin autorización del fundador.
- **Cero pagos reales / pasarelas.** El desembolso es 100% manual: el superadmin transfiere por fuera y registra la referencia.
- Mantener diseño "Noche Premium" (CSS nativo, variables `--noche --barra --luz --botella --vino --papel --humo --linea`; fuentes Bodoni Moda / Space Grotesk / JetBrains Mono). **Sin Tailwind.**
- Terminología: **prohibido "Escandallo"** → usar "Precio de Barra Cerrado".
- Footer y versión estándar ya existen (`src/footer.ts`); no romperlos.
- No leer completos `src/client.ts` ni `index.html`. Usar grep + rangos.
- Políticas se leen de `src/config/b2b-policies.ts`; **no hardcodear montos**.

## 1. Archivos de contexto (ya listos, no reescribir su lógica)
| Archivo | Uso |
|---|---|
| `src/b2b-engine.ts` | `approvePayout(entries, approverUid, approverRole, transferRef, isSuperadminApproved, taxProfile)`, `processReversal`, etc. |
| `src/db.ts` | Interfaces `LedgerEntry`, `Payout`, `Scout`, `Host`, `AuditLog`; métodos `getLedgerEntries`, `saveLedgerEntry`, `getPayouts`, `savePayout`, `logAudit`, `getScout`, `getHost`. |
| `src/superadmin.ts` | `SuperAdminController` (`render()`, `setupListeners()`); aquí se agrega la pestaña. |
| `src/crm.ts` | `CRMController`; aquí se agrega "Mi Estado de Cuenta". |
| `firestore.rules` | Ledger/payouts: escritura solo `superadmin`. |

## 2. Entregables

### T1 — Pestaña "Liquidaciones B2B" en `src/superadmin.ts`
1. Nueva pestaña/sección con 3 bloques:
   - **Pendientes por pagar:** `LedgerEntry` con `status = 'payable'`, agrupadas por `payee_uid`. Columnas: beneficiario, tipo (scout/host), hito (A/B/C/residual/host_base/tier_adjustment), monto bruto COP, `payable_after`, motivo.
   - **En revisión / retenidas:** `status` `accrued` o `review` (p. ej. Hito B con ventana de 7 días) — solo lectura, con cuenta regresiva.
   - **Historial:** `Payout` conciliados + botón **Reversar** (llama `processReversal`, exige motivo, genera asiento negativo enlazado; nunca borrar).
2. Modal **"Aprobar desembolso"** por beneficiario:
   - Muestra total bruto, entradas incluidas y checklist **obligatorio**:
     - ☐ RUT verificado (`taxProfile.rutVerified`)
     - ☐ PILA del mes vigente verificada (`pilaVerified`)
     - ☐ Cuenta bancaria/Nequi a nombre del titular
   - Campo **Referencia de transferencia** (requerido).
   - Botón "Aprobar" **deshabilitado** hasta cumplir checklist + referencia. Al confirmar: `approvePayout(...)` con `approverRole='superadmin'` → `DB.savePayout` + `DB.saveLedgerEntry` (cada entrada actualizada) + `DB.logAudit`.
   - Errores del motor se muestran en un toast/diálogo (`RondaDialog` de `src/dialog.ts`), no `alert()`.
3. Persistencia del perfil fiscal: guardar `rutVerified`, `pilaVerified`, `pilaPeriod` (YYYY-MM) y `verified_by/at` en `scouts/{uid}` y `hosts/{uid}` (campos nuevos opcionales en interfaces de `db.ts`). Si `pilaPeriod` ≠ mes actual (America/Bogota) → tratar `pilaVerified` como falso.
4. Banner fijo: **"Modo desembolso manual — no se realizan transferencias automáticas."**

### T2 — Alta/gestión de Scouts y Hosters (superadmin)
- Lista + formulario mínimo para crear/editar `scouts/{uid}` y `hosts/{uid}` (nombre, email, estado, contrato, flags RUT/PILA). Solo superadmin escribe (ya cubierto por reglas).

### T3 — "Mi Estado de Cuenta" en `src/crm.ts` (rol `sales`/Scout)
- Solo lectura de **su propio** ledger: `DB.getLedgerEntries(auth.uid)`.
- Embudo por lead: `Firma (A) → Activación ≥16 pax (B) → Retención 90d / 8 eventos (C)` leyendo `lead.milestone_status`, `valid_event_count`, `retention_window_ends_at`.
- Indicador de progreso del Hito C: `valid_event_count / 8` y días restantes; alertas del playbook (día 60: <5 eventos = amarillo; día 75: <7 = rojo).
- Total devengado vs pagado; aviso si falta RUT/PILA: *"Sin RUT/PILA vigentes no podemos aprobar tu pago."*
- **No** mostrar ni permitir editar campos protegidos (`milestone_status`, `cohort_tier`, `verified_at`).

### T4 — Pruebas y calidad
- Añadir casos a `test/test-b2b-scouts-hosters.cjs` para: PILA vencida (mes anterior) bloquea; referencia vacía bloquea; reverso no borra y enlaza `original_entry_id`.
- (Opcional, recomendado) Prueba de reglas con emulador: `firebase emulators:start --only firestore,auth` y verificar que un usuario `sales` **no** puede escribir en `commission_ledger`/`payouts` ni modificar `milestone_status`.
- Ejecutar y dejar en verde: `npx tsc --noEmit`, `node test/test-b2b-scouts-hosters.cjs`, `node test/test-integrity-zero-functions.cjs`, `npm run build`.

## 3. Criterios de aceptación
1. Un `sales` no ve ni escribe el panel de Liquidaciones; solo `superadmin`.
2. No se puede aprobar un payout sin RUT + PILA vigente + referencia.
3. Aprobar el mismo payout dos veces no duplica pagos (idempotencia por `idempotency_key`/estado `paid`).
4. Todo pago/reverso genera `audit_logs`.
5. UI responsive (móvil y escritorio), estilo Noche Premium, footer intacto.
6. Build, tipos y las dos suites de pruebas en verde. Sin cambios de despliegue.

## 4. Al terminar, Cline reporta
Archivos tocados, capturas del panel (superadmin y CRM), salida de las pruebas y cualquier decisión que requiera al fundador. Luego: `graphify update .`.
