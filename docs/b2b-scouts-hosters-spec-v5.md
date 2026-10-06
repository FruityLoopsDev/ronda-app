# RONDA B2B — Módulo de Scouts y Hosters (Especificación y Entrega v5.0)

> **Estado:** Implementado en arquitectura local y validado con pruebas automatizadas en emuladores / Node.js.  
> **Modo Financiero:** Modo de Liquidación de Prueba (CERO transferencias bancarias reales sin autorización explícita del fundador).

---

## 1. Clasificación de Requisitos y Fuentes de Verdad

### 🟢 1.1. CONFIRMADO POR EL FUNDADOR (Vigente en el Motor)
| Parámetro | Valor Confirmado | Impacto en el Sistema |
| :--- | :--- | :--- |
| **Días Operativos** | Martes, Miércoles y Jueves | Restricción estricta en `America/Bogota`. Eventos en viernes/fin de semana son rechazados para comisiones. |
| **Acuerdo de Barra** | Máximo **$22.500 COP** | Tarifa final por asistente con paquete de consumiciones (no por bebida), impuestos incluidos. |
| **Honorarios Base Hoster** | **$250.000 COP** | Por evento cumplido de 3 horas. No depende del aforo del Scout (el Hoster cobra aunque RONDA venda pocos tickets). |
| **Eventos del Fundador** | **$0 COP** en caja | Se registra un costo analítico de reemplazo de $250.000 COP pero con pago transferible en $0 COP (`founder_mode`). |
| **Seguridad Financiera** | Cero pagos automáticos | Ni el Scout ni el Hoster pueden autoasignarse comisiones, editar su ledger ni alterar verificaciones desde cliente. |

---

### 🟡 1.2. POLÍTICAS PROPUESTAS (Configurables y en Estado `draft`)
Ubicación: [`src/config/b2b-policies.ts`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/config/b2b-policies.ts)

*   **Ticket Escenario:** $75.000 COP (precio modelado al consumidor vs $65.000 COP de referencia anterior).
*   **Hito A (Scout):** $100.000 COP tras firma y verificación independiente.
*   **Hito B (Scout):** $250.000 COP tras el primer evento válido con al menos 16 asistentes pagados y con check-in único.
*   **Hito C (Scout):** $100.000 COP evaluado únicamente a partir del día 90 si el bar sigue activo y tiene al menos 8 eventos válidos.
*   **Residual Estándar:** $30.000 COP por noche válida posterior a la activación (máximo 1 residual por semana, hasta 12 residuales dentro de 6 meses). El evento de activación (#1) no genera residual.
*   **Tiers Mensuales (Cohorte):**
### 🟢 1.2. DECISIONES CONFIRMADAS POR EL FUNDADOR (5 de Octubre de 2026)
1.  **Ticket Final B2C:** Ratificado en **$75.000 COP** (precio final al consumidor con IVA 19% hipotético en modelo conservador).
2.  **Hito C del Scout:** Ratificado en **$100.000 COP** evaluado formalmente a los 90 días con mínimo **8 eventos válidos** y bar activo.
3.  **Plan de Acción para el Scout:** Creado el [**Playbook Operativo de 90 Días**](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/playbook-scout-retencion-90d.md) con el paso a paso semanal para asegurar la retención del bar y el cobro del Hito C.
4.  **Cumplimiento Fiscal Obligatorio (RUT y PILA):** Ningún colaborador o prestador (Scout o Hoster) puede recibir desembolsos sin tener su **RUT verificado** y soporte de **planilla PILA** del mes vigente.
5.  **Flujo de Desembolso:** El desembolso es exclusivamente **Manual y Aprobado por el Super Administrador** tras verificar comprobante de transferencia bancaria y cumplimiento documental.

---

### 🟡 1.3. POLÍTICAS PROPUESTAS (En reserva o desactivadas)
Ubicación: [`src/config/b2b-policies.ts`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/config/b2b-policies.ts)

*   **Tiers Mensuales (Cohorte):**
    *   Tier 1 (1–3 bares activados): Bounty base $450.000 COP.
    *   Tier 2 (4–6 bares activados): Acelerador +20% ($540.000 COP).
    *   Tier 3 (7+ bares activados): Acelerador +20% ($540.000 COP) + residual de $40.000 COP.
*   **Políticas de Hoster Desactivadas:**
    *   Bono por calidad ($30.000 COP): `bonus_enabled: false`.
    *   Compensación por cancelación tardía ($100.000 COP): `cancellation_comp_enabled: false`.
    *   Alerta de frecuencia: 2 eventos/semana por hoster (alerta informativa, no sanción disciplinaria).

---

## 2. Archivos Modificados y Creados

| Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| [`src/config/b2b-policies.ts`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/config/b2b-policies.ts) | Modificado | Versión `5.1-confirmed` con ticket $75k, Hito C ratificado y flags de cumplimiento RUT/PILA. |
| [`src/b2b-engine.ts`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/b2b-engine.ts) | Modificado | Validación en `approvePayout` de RUT, PILA y rol `superadmin` obligatorio para transferencias manuales. |
| [`docs/playbook-scout-retencion-90d.md`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/playbook-scout-retencion-90d.md) | Creado | Playbook táctico de 90 días para que el Scout asegure los 8 eventos y alcance el Hito C. |
| [`src/db.ts`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/src/db.ts) | Modificado | Interfaces completas para Scout, Host, Lead (conservando `sales_uid`), Venue, LedgerEntry, Payout y AuditLog. |
| [`firestore.rules`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/firestore.rules) | Modificado | Reglas de seguridad reforzadas contra auto-liquidación de comisiones y protección de campos financieros. |
| [`test/test-b2b-scouts-hosters.cjs`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/test/test-b2b-scouts-hosters.cjs) | Modificado | 16 pruebas automatizadas (incluyendo bloqueo por falta de RUT/PILA y rol no superadmin). |
| [`scripts/migrate-b2b-leads.cjs`](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/scripts/migrate-b2b-leads.cjs) | Creado | Script de migración idempotente para vincular `sales_uid` con `scout_uid` sin romper queries existentes. |

---

## 3. Resultados de Pruebas Automatizadas (15/15 Pasadas)

Comando ejecutado: `node test/test-b2b-scouts-hosters.cjs`

```text
✓ Criterio 1: 15 asistentes pagados no causan Hito B; 16 asistentes sí activan.
✓ Criterio 2: Asistentes con derecho de entrada verificados correctamente (comprador sin check-in no cuenta).
✓ Criterio 3: Cortesías, devoluciones, fallos y duplicados excluidos.
✓ Criterio 4: IP/dispositivo compartido genera señal de revisión sin exclusión ciega.
✓ Criterio 5: Manejo determinista de días operativos en America/Bogota con offset UTC.
✓ Criterio 6: Idempotencia estricta por clave única determinista (evita pagos duplicados).
✓ Criterio 7: Reglas de residuales semanales (tope 12, ventana 6 meses, 1 por semana).
✓ Criterio 8: Hito C de retención validado en el corte de 90 días (bloqueado en día <90).
✓ Criterio 9: Tiers mensuales y cálculo diferencial de aceleradores (+20%).
✓ Criterio 10: Independencia de honorarios del Hoster frente a metas de aforo del Scout.
✓ Criterio 11: Costo analítico del fundador ($250k) registrado sin desembolso de caja ($0).
✓ Criterio 12: Autonomía del Hoster, sin sanciones por rechazo ni bloqueo injusto por incidencias.
✓ Criterio 13: Bloqueo de auto-asignación y manipulación de comisiones desde cliente.
✓ Criterio 14: Privacidad de datos sensibles y ledger garantizada por RBAC.
✓ Criterio 15: Asiento contrario enlazado y auditabilidad total sin eliminación de registros.
```

---

## 4. Instrucciones Operativas de Liquidación Manual (Modo Simulación)

1.  **Verificación del Bar:** Operaciones revisa RUT y firma autorizada antes de marcar `verifyVenue()`. Esto genera la provisión del Hito A en estado `accrued`.
2.  **Cierre de Noche:** Al finalizar el evento, el Hoster envía su reporte. El sistema ejecuta `verifyCompletedEvent()`:
    *   Si los asistentes pagados únicos presentes son $\ge 16$, se devenga el Hito B con 7 días de retención antifraude.
    *   Se genera la orden del honorario base del Hoster ($250.000 COP) independientemente del aforo.
3.  **Aprobación de Desembolso:**
    *   Finanzas consolida las entradas devengadas en una orden `Payout`.
    *   El desembolso se realiza mediante pago manual (transferencia bancaria/Nequi de RONDA).
    *   Una vez realizada la transferencia, el fundador o administrador ingresa la referencia bancaria y ejecuta `approvePayout()`, pasando la orden a `reconciled`.
4.  **Reversos por Inconsistencia:** Si se comprueba fraude, se ejecuta `processReversal()`, creando un asiento negativo enlazado al ID original con registro de auditoría.

---

## 5. Procedimiento de Rollback

En caso de requerir volver al estado previo:
1.  **Reglas de Firestore:** Restaurar `firestore.rules` al commit previo (`git checkout HEAD~1 firestore.rules`).
2.  **Base de Datos:** El script de migración no elimina colecciones ni campos previos (`sales_uid` sigue intacto en cada documento).
3.  **Configuración:** No hay dependencias externas activas; los pagos reales no fueron vinculados a dispersión automática en pasarela.
