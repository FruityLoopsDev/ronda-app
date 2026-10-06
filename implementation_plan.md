# Plan de Implementación: Módulo B2B Scouts y Hosters (v5.0)

Según el **Brief Final (v5.0)**, este es el plan estructurado por fases para integrar el esquema económico y operativo de afiliación (Scouts) y ejecución (Hosters) sobre la arquitectura de RONDA.

## Clasificación de Requisitos

### ✅ CONFIRMADO
- **Días Operativos:** Martes, Miércoles y Jueves.
- **Acuerdo de Barra (Bar):** Paquete máximo de COP 22.500 por asistente (impuestos incluidos).
- **Honorarios Base Hoster:** COP 250.000 brutos por evento de 3 horas. No depende del aforo (si el evento se realiza, se paga).
- **Hitos Scout:** 
  - La activación (Hito B) requiere mínimo 16 asistentes pagados con check-in único.
  - El residual estándar se paga por noches elegibles (máximo 1/semana, hasta 12 en 6 meses).
- **Seguridad/Validación:** Webhook duplicado o check-in sin pago no causan comisión. Ledger en Firestore protegido contra escritura directa del cliente. Idempotencia en transacciones.

### 🟡 PROPUESTA (Configurable en `config/` como draft hasta aprobación)
- **Hito C (Scout):** COP 100.000 al día 90 si el bar sigue activo con al menos 8 eventos. *(Pendiente confirmación de 8 eventos).*
- **Aceleradores Scout (Tiers):** Tier 1 (450k), Tier 2 (540k), Tier 3 (540k + residual 40k). 
- **Bono Calidad Hoster:** COP 30.000 adicionales (Desactivado).
- **Compensación Cancelación Tardía:** COP 100.000 al Hoster (Desactivado).
- **Límite Residual:** Máximo un residual semanal por bar.

### ⏳ PENDIENTE (Requiere Abogado/Contador)
- **Tributario:** Tasas de retención/IVA específicas según perfil fiscal (RUT, PILA). El sistema usará un perfil `tax_review` genérico por ahora para simular costos netos.
- **Cláusulas Contractuales:** Autorización final de los términos propuestos en el PDF para Corretaje y Prestación de Servicios.

---

## Plan por Fases (Instrucciones para Antigravity y Cline)

### Fase 1: Arquitectura de Datos y Reglas de Seguridad (Backend)
1. **Actualizar `firestore.rules`:** Añadir colecciones `scouts`, `hosts`, `commission_ledger`, `payouts` y `audit_logs` con restricciones estrictas de solo lectura para el titular.
2. **Modelo de Datos en TypeScript:** Ampliar las interfaces en `src/db.ts` para soportar:
   - `Lead` (incluyendo `milestone_status`, `first_valid_event_at`, `activation_month`).
   - `Venue` (incluyendo `bar_package_price_cop`, `agreed_weekdays`, `contract_id`).
   - `LedgerEntry` y `HostOffer`.
3. **Configuraciones (Draft):** Crear los esquemas de política de Scouts y Hosters (`config/scout_policy` y `config/host_policy`) con los valores en estado `draft`.

### Fase 2: Lógica de Liquidación (Emuladores / Modo Simulación)
1. **Verificadores Deterministas:**
   - `verifyCompletedEvent()`: Función que consolida el check-in vs transacciones pagadas reales. (Simulación local).
   - Motor de estado de Hitos (A, B, C y Residuales).
2. **Idempotencia:** Asegurar que los pagos `ledger_entry` usan identificadores deterministas (ej. `B_leadId`, `residual_venueId_weekNum`) para evitar dobles pagos por error de red.

### Fase 3: Paneles CRM e Interfaces (Frontend con Cline)
1. **Portal CRM (`src/crm.ts`):** 
   - Añadir la vista del *Scout Ledger* (estado de cuenta).
   - Mostrar el embudo de hitos para cada lead: `Firma (A) -> Activación 16+ (B) -> Retención 90d (C)`.
2. **Portal Admin / Hoster (`src/admin.ts`):**
   - Interfaz de "Ofertas de Evento" (Aceptar/Rechazar Hoster).
   - Estado de cuenta del Hoster (pago base vs. bonos retenidos).

### Fase 4: Despliegue y Auditoría
1. **Test E2E:** Probar el flujo completo: Crear Lead -> Simular 16 asistentes -> Validar generación de Hito B -> Generar Ledger Entry.
2. **Restricción de Pagos:** Implementar el flag `founder_mode` que impide que cualquier orden pase a estado `paid` o genere una transferencia externa sin aprobación explícita.

---

**Siguiente paso:** Revisa este plan. Si apruebas la clasificación, procederé a iniciar la **Fase 1** (modificando `firestore.rules` y `src/db.ts`).
