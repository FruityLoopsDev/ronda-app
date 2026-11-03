# Plan de Mejoras — Panel CRM `/crm.html`

**Fecha:** 2 de noviembre de 2026
**Alcance:** `crm.html`, `src/entry-crm.ts`, `src/crm.ts`, `src/db.ts` (leads/ledger), `src/portal-auth.ts` (acceso), `firestore.rules` (colección `leads`), `src/config/b2b-policies.ts` (política económica).
**Versión auditada:** `2.3.1` — build multi-página Vite (`crm` es entrada en `vite.config.ts`).
**Método:** lectura estática del código de producción + contraste contra reglas Firestore y la política de comisiones vigente. Sin ejecución de build; los hallazgos de permisos se deducen del texto de `firestore.rules`.

---

## 0. Veredicto

El panel **funciona como tablero**, pero **no funciona como CRM**: no dice a quién llamar hoy, no registra historia y **muestra una comisión que el motor de pagos nunca va a pagar**. Además hay un XSS almacenado en el drawer y tres acciones visibles que el rol `sales` tiene prohibidas por reglas.

Se proponen **24 mejoras** en 4 fases (~10 jornadas): **5 P0** (dinero y seguridad), **9 P1** (correctitud y operabilidad), **10 P2/P3** (arquitectura, accesibilidad, escala).

---

## 1. Tabla maestra de hallazgos

| ID | Sev | Hallazgo | Evidencia | Impacto | Corrección | Esf. |
|---|---|---|---|---|---|---|
| **P0-1** | P0 | La UI promete **$500.000** plano; la política vigente paga **$450.000** en hitos 100k+250k+100k | `crm.html:168`, `crm.html:692`, `crm.ts:246`, `crm.ts:187`, `entry-crm.ts:45-52`, `b2b-policies.ts:89-95` | Promesa comercial falsa; disputa con el scout al liquidar. Riesgo legal/reputacional | Fuente única `DEFAULT_SCOUT_POLICY`; UI deriva de hitos reales | 0.5 j |
| **P0-2** | P0 | XSS almacenado: el drawer inyecta `lead.name`, `contactName`, `zone` y `notes` sin escapar | `crm.ts:436-437`, `crm.ts:462` (vs. `escapeHtml` usado en `crm.ts:253-274`) | Un lead con `<img onerror>` ejecuta script con la sesión del comercial; roba token/ledger | Escapar todo interpolado; `textContent` para nodos dinámicos | 0.5 j |
| **P0-3** | P0 | «Comisiones Ganadas» suma el **base completo** de cada firmado, ignorando hitos y retenciones | `crm.ts:186-191` | Sobrestima el ingreso 5× (si no hay evento válido, solo se devenga el Hito A) | Usar el motor de hitos; mostrar *devengado / proyectado / pagado* por separado | 1 j |
| **P0-4** | P0 | Borrar lead **siempre falla** para `sales` (regla: solo superadmin) y la UI borra en local antes del `await` | `crm.ts:414-418`, `firestore.rules:249` | El lead desaparece y «revive» en el siguiente snapshot; excepción no capturada | Soft-delete (`status:'archived'` vía update) + confirmación + rollback + toast | 0.5 j |
| **P0-5** | P0 | La rama *whitelist* de `leads.create` **no exige `request.auth != null`** | `firestore.rules:244-248` | Cualquiera sin sesión inyecta leads con PII falsa en el pipeline del equipo | Añadir `request.auth != null` y validar `phone`/`zone` por tipo | 0.25 j |
| **P1-6** | P1 | Superadmin (rol admitido en el portal) ve el **pipeline vacío**: filtra por su propio `uid` | `portal-auth.ts:48`, `crm.ts:19-21`, `crm.ts:59-62`, `db.ts:888` | El dueño del negocio no puede auditar el pipeline | Selector de alcance (mío / equipo / todos) según rol | 1 j |
| **P1-7** | P1 | El buscador no busca **zona** ni notas, pese al placeholder | `crm.html:183` vs. `crm.ts:212-216` | El comercial cree filtrar por zona y no filtra | Incluir `zone`/`notes` normalizados (sin tildes) | 0.25 j |
| **P1-8** | P1 | El alta ofrece **7 zonas**, el filtro solo **5**: `Zona T / El Retiro` y `Teusaquillo` quedan inalcanzables | `crm.html:184-191` vs. `crm.html:679-688` | Leads invisibles al filtrar; «0 resultados» inexplicable | Poblar el filtro desde los leads + catálogo único de zonas | 0.5 j |
| **P1-9** | P1 | WhatsApp con **doble prefijo**: `57` + teléfono que ya trae `+57` | `crm.ts:248`, `crm.ts:620-623` | El enlace abre un número inexistente; se pierde el contacto | Normalizador `toWaPhone()` único | 0.25 j |
| **P1-10** | P1 | «Mi Estado de Cuenta» se pinta **una sola vez** y no reacciona al snapshot en vivo | `crm.ts:50-53` (llamada única) vs. `crm.ts:59-62` (`render()` sin `renderMyAccount`) | El scout firma un bar y su cuenta sigue mostrando $0 | Llamar `renderMyAccount()` dentro del callback en vivo | 0.25 j |
| **P1-11** | P1 | «Dar de Alta en Red» es **imposible para `sales`** (regla: create venues solo superadmin/network) y pide 3 datos por `window.prompt` | `crm.ts:531-591`, `firestore.rules:209` | Botón que siempre falla; fricción de 3 diálogos nativos | Convertir en **solicitud** (`venue_requests`) o deshabilitar por rol + formulario en drawer | 1 j |
| **P1-12** | P1 | No existe **próxima acción** ni **antigüedad por etapa**: el tablero no prioriza | `crm.ts` (sin `nextActionAt`/`lastContactAt`), `db.ts:444-478` | El panel no sirve para operar el día; leads se enfrían sin aviso | Campos `next_action_at`, `last_contact_at` + vista «Hoy» y chip de vencido | 2 j |
| **P1-13** | P1 | Sin **historial de etapas** ni autoría de cambios | `crm.ts:396-412` (solo escribe `status`), `firestore.rules:304-307` | Comisión no auditable; disputas «yo lo firmé» sin evidencia | Subcolección `leads/{id}/history` o `stage_events` | 1.5 j |
| **P1-14** | P1 | Registro de `venue` duplica el lead: `venues` y `leads.venueId` sin transacción | `crm.ts:554-571` | Alta parcial si falla la segunda escritura | `writeBatch` atómico | 0.5 j |
| **P2-15** | P2 | `init()` **no es idempotente**: cada re-emisión de auth re-registra listeners en los inputs estáticos y otro `keydown` global | `crm.ts:24-48` (sin guard), `crm.ts:55-63` (solo limpia la suscripción) | Cada tecla renderiza 2×N veces; `Escape` ejecutado en duplicado | Guard `initialized` + `destroy()` real | 0.5 j |
| **P2-16** | P2 | `render()` reconstruye **todo** el kanban por tecla, sin debounce ni delegación de eventos | `crm.ts:180-394` | Jank con +100 leads; se pierde scroll y el drag en curso | `debounce(150)`, `DocumentFragment` y delegación en el wrapper | 1 j |
| **P2-17** | P2 | El formulario de login escrito a mano es **código muerto**: `portal-auth` sobrescribe `#view-auth` al arrancar | `crm.html:138-158` vs. `portal-auth.ts:108,169` | 20 líneas + CSS (`.auth-card`, `.admin-auth-wrap`) que nadie ve; `onsubmit` vacío si el portal falla | Eliminar markup y CSS propio del login | 0.25 j |
| **P2-18** | P2 | **Dos cabeceras** apiladas (`.top-header` propio + `#portal-top-bar` inyectada) y footer visible en el login (`#footer-root` fuera de las secciones) | `crm.html:121-135`, `crm.html:244`, `portal-auth.ts:393-413` | Ruido visual, dos logos RONDA, scroll sticky peleado | Un solo shell: dejar la cabecera al portal o absorberla | 0.5 j |
| **P2-19** | P2 | Cero accesibilidad: **0** atributos `aria-*`/`role`/`for` en todo el HTML; drawer sin focus trap ni retorno de foco; sin scroll-lock | `crm.html` (0 coincidencias), `crm.ts:421-472` | Inoperable con teclado/lector; `Escape` cierra el drawer aunque el modal de alta esté abierto | `role="dialog"`, `aria-modal`, trampa de foco, `inert`, scroll-lock | 1.5 j |
| **P2-20** | P2 | `window.confirm` / `window.prompt` en flujos de dinero y datos, cuando ya existe `RondaDialog.confirm/prompt` | `crm.ts:363`, `crm.ts:535-540`, `dialog.ts:210,233` | Bloquea el hilo, no accesible, sin validación ni estilo de marca | Migrar a `RondaDialog` | 0.5 j |
| **P2-21** | P2 | Sin estados de **carga / error / vacío**: 3 columnas en blanco sin leads y, si la suscripción falla (permiso), el tablero queda vacío **en silencio** | `crm.ts:228-233` (solo cubre «filtro sin resultados»), `crm.ts:59-62` (`onError` no se pasa) | El comercial cree que no tiene leads cuando en realidad perdió acceso | Skeleton, empty-state con CTA y toast de error de suscripción | 0.5 j |
| **P2-22** | P2 | Tipografía rota: `var(--font-serif)` y `var(--font-sans)` **no existen** en los tokens (solo `display`/`body`/`mono`) | `crm.html:129,162` vs. `public/assets/ronda-tokens.css:38-40` | Los títulos caen a Space Grotesk; se pierde el display Bodoni de marca | Usar `--font-display` / `--font-body`; añadir alias si se quiere compatibilidad | 0.25 j |
| **P2-23** | P2 | **Cero CSS** para `.kanban-*`: todo es estilo inline; doble margen (gap 12 + `marginBottom:12`); sin hover/focus/drop-target | `crm.ts:237-243`, `crm.html:74-83`; `public/css/styles.css` no contiene `.kanban` | Imposible mantener, sin estados visuales, sin `prefers-reduced-motion` | Extraer a `crm.css` con clases y estados | 1 j |
| **P2-24** | P2 | **Tres fuentes de verdad** de comisión y motor muerto: `COMMISSION_CONFIG` (50/30/20), literal `500000`, política 450k; `calculateLeadCommission`/`calculatePipelineSummary` **nunca se llaman** | `entry-crm.ts:45-143` (0 consumidores), `crm.ts:187,246` | Ya derivó en P0-1/P0-3; volverá a derivar | Módulo `src/commissions.ts` + pruebas + consumo desde `crm.ts` | 1.5 j |
| **P3-25** | P3 | IDs con `Date.now()` (colisión en alta simultánea) y sin detección de duplicados por teléfono | `crm.ts:764` | Leads pisados / duplicados en el pipeline | `crypto.randomUUID()` + chequeo de teléfono | 0.25 j |
| **P3-26** | P3 | Offline a medias: hay persistencia (`persistentLocalCache`) pero `subscribeToLeads` **descarta `snap.metadata`** | `firebase-config.ts:27-28`, `db.ts:900-902`, `entry-crm.ts:154` | El toast promete «se sincronizará» y la UI no distingue caché de servidor ni cambios pendientes | Exponer `fromCache`/`hasPendingWrites` y pintar badge de sincronización | 0.5 j |
| **P3-27** | P3 | Sin virtualización ni paginación: ~40 nodos + 5 listeners por tarjeta | `crm.ts:235-320` | 200 leads ≈ 8k nodos por tecla | Delegación + render incremental por columna | 1 j |
| **P3-28** | P3 | Sin orden, sin filtro por día preferido/comisión, sin exportación CSV del pipeline | `crm.ts:210-217` | Cierre de mes manual; no hay informe para liquidar | Selector de orden + `exportCsv()` | 1 j |

**Total estimado:** ~19 jornadas de alcance completo; **F0+F1 (~5 j)** ya deja el panel correcto y seguro.

---

## 2. Detalle de los bloques P0

### P0-1 + P0-3 + P2-24 — Una sola verdad económica

Hoy conviven tres cifras para el mismo hecho:

```
crm.html:168   "Comisión: $500.000 COP por local firmado"      ← lo que se le promete al scout
crm.ts:187     suma de lead.commission || 500000                ← lo que muestra el panel
entry-crm.ts   base 500k repartida 50/30/20 → 250k/150k/100k    ← motor muerto
b2b-policies   base 450k → 100k(A) + 250k(B) + 100k(C)          ← lo que paga el ledger real
```

La política `DEFAULT_SCOUT_POLICY` v5.1 está marcada `CONFIRMADO POR EL FUNDADOR` (`b2b-policies.ts:89-95`) y es la que consume `b2b-engine.ts` al escribir `commission_ledger`. **La UI es la que está mal.**

**Corrección**

1. Crear `src/commissions.ts` como única fuente:

```ts
import { DEFAULT_SCOUT_POLICY } from './config/b2b-policies.js';

export interface HitBreakdown { A: number; B: number; C: number; total: number }

export function bounty(): HitBreakdown {
  const p = DEFAULT_SCOUT_POLICY;
  return { A: p.hit_a_cop, B: p.hit_b_cop, C: p.hit_c_cop, total: p.hit_a_cop + p.hit_b_cop + p.hit_c_cop };
}

/** Devengado = hitos en accrued/payable/paid. Pagado = hitos en paid. */
export function accrued(lead: Lead): { devengado: number; pagado: number; proyectado: number } { /* ... */ }

/** Normaliza un teléfono CO a E.164 sin prefijo duplicado. */
export function toWaPhone(raw?: string): string | null { /* ... */ }
```

2. `crm.html:168` y el chip de tarjeta pasan a `$450.000 en 3 hitos (100k / 250k / 100k)`.
3. Eliminar `COMMISSION_CONFIG`, `calculateLeadCommission` y `calculatePipelineSummary` de `entry-crm.ts` (o moverlos a `commissions.ts` con pruebas).
4. La cabecera de métricas muestra **tres** cifras: *Proyectado · Devengado · Pagado*.

**Aceptación:** para cualquier lead, `devengado` mostrado = suma de `commission_ledger` con `payee_uid` = scout y `status ∈ {accrued, payable}`; desviación 0.

### P0-2 — XSS en el drawer

`render()` escapa con `escapeHtml` (bien), pero `openLeadDetailModal()` interpola crudo:

```ts
// crm.ts:436-437 — vulnerable
<h3 ...>📋 ${lead.name}</h3>
<p ...>${lead.contactName || 'Sin contacto'}${lead.zone ? ` · ${lead.zone}` : ''}</p>
```

**Corrección:** `escapeHtml(lead.name)` en los 4 puntos + `<textarea>` con `escapeHtml(lead.notes)` (hoy solo reemplaza `<`, dejando `"` y `&` sueltos). Regla de equipo: *ninguna interpolación en plantilla sin `escapeHtml`, salvo que el valor sea numérico y venga de `Math.*`*.

**Aceptación:** un lead llamado `"><img src=x onerror=alert(1)>` se muestra como texto en tarjeta, drawer y diálogos.

### P0-4 — Borrado que no borra

`deleteLead()` hace `this.leads = filter(...)` **antes** del `await DB.deleteLead()` (`crm.ts:414-418`). Con rol `sales` Firestore responde `permission-denied`, la promesa rechaza sin `catch` y el lead reaparece en el siguiente snapshot. La UI miente durante ~1 s y deja una excepción en consola.

**Corrección**

```ts
async deleteLead(leadId: string) {
  const lead = this.leads.find(l => l.id === leadId);
  if (!lead) return;
  const ok = await RondaDialog.confirm({
    title: 'Quitar del pipeline',
    message: `«${escapeHtml(lead.name)}» saldrá del tablero. El historial se conserva.`,
    confirmText: 'Quitar', cancelText: 'Cancelar'
  });
  if (!ok) return;
  const prev = lead.status;
  lead.status = 'archived';            // permitido por la regla update de sales
  this.render();
  try { await DB.updateLeadStatus(leadId, 'archived'); }
  catch (e) { lead.status = prev; this.render(); toastError('No se pudo quitar el lead.'); }
}
```

Requiere: `Lead.status` incluir `'archived'` (`db.ts:448`), exclusión en `render()`/`getLeads`, y `allow delete` intacto para superadmin. Alternativa si se quiere borrado real: habilitar `allow delete: if isSuperAdmin() || (isSales() && resource.data.sales_uid == request.auth.uid)`.

### P0-5 — Alta de leads sin autenticación

```javascript
// firestore.rules:244-248
allow create: if isSuperAdmin() || isSales() || (
  request.resource.data.keys().hasOnly([...]) ...
);
```

La rama *whitelist* no verifica sesión: cualquier cliente anónimo puede escribir documentos en `leads`. El CRM los renderizará y el equipo comercial los tratará como prospectos reales.

**Corrección**

```javascript
allow create: if isSuperAdmin() || isSales() || (
  request.auth != null
  && request.resource.data.sales_uid == request.auth.uid   // autoría real
  && request.resource.data.status == 'lead'
  && request.resource.data.keys().hasOnly([...'sales_uid','updatedAt'])
  && request.resource.data.name is string && request.resource.data.name.size() <= 100
  && request.resource.data.phone is string && request.resource.data.phone.matches('^\\+?[0-9 ]{7,20}$')
);
```

> Nota: `crm.ts:768` ya escribe `sales_uid`, campo que **no** está en la whitelist actual; al cerrar la regla hay que añadirlo o el alta de un `sales` por la rama pública fallará.

---

## 3. Detalle de los bloques P1

| ID | Corrección concreta | Archivo |
|---|---|---|
| P1-6 | `init(uid, scope)`: si rol ≠ `sales`, `getLeads()` sin filtro + `<select id="crm-scope">` (Mis leads / Todo el equipo) | `crm.ts:19-21`, `db.ts:885-907` |
| P1-7 | Normalizar a minúsculas sin tildes y buscar en `name · contactName · phoneDigits · zone · notes` | `crm.ts:212-216` |
| P1-8 | Catálogo único `src/config/zones.ts` + poblar el `<select>` desde `new Set(leads.map(l => l.zone))` | `crm.html:184-191`, `crm.ts:35-39` |
| P1-9 | `toWaPhone()`: quitar no-dígitos, quitar `57` inicial si quedan 10 dígitos, validar `^3\d{9}$` | `crm.ts:248`, `crm.ts:620` |
| P1-10 | `this.renderMyAccount()` dentro del callback de `subscribeToLeads` | `crm.ts:59-62` |
| P1-11 | Botón → `RondaDialog` con formulario (dirección + geolocalización `navigator.geolocation`) → si rol `sales`, guardar en `venue_requests` (pendiente de aprobación) en vez de `venues` | `crm.ts:531-591` |
| P1-12 | Añadir `next_action_at`, `last_contact_at`, `next_action_note`; chip rojo si `next_action_at < today`; sección **«Hoy»** sobre el kanban; acción rápida «Registrar contacto» (mueve `last_contact_at` y reprograma) | `db.ts:444-478`, `crm.html` |
| P1-13 | `DB.appendLeadEvent(leadId, {from, to, by, at})` en cada `moveLead` y en cada guardado de ficha; timeline en el drawer | `crm.ts:396-412` |
| P1-14 | `writeBatch` con `venue` + `lead.venueId` juntos | `crm.ts:554-571` |

**P1-12 es la mejora de mayor retorno comercial:** sin próxima acción, el tablero es un archivo, no una herramienta. Coste 2 j, efecto directo en la tasa de cierre.

---

## 4. Arquitectura y calidad (P2/P3)

1. **Un solo sistema de modales.** Hoy hay tres: drawer (`crm.ts:421`), modal de alta creado por JS (`crm.ts:636`) y `RondaDialog`. Extraer `openSheet({title, body, onSave})` en `src/ui/sheet.ts` con foco atrapado, `Escape`, scroll-lock y retorno de foco. Beneficio: P2-19 y P2-20 se resuelven juntos.
2. **CSS real.** `public/css/styles.css` **no contiene ni una regla `.kanban*`**; todo el tablero vive en `style="..."` inline (~120 atributos). Mover a `public/css/crm.css` con clases, estados `:hover/:focus-visible/:drag-over` y `@media (prefers-reduced-motion)`.
3. **Render por columna.** `render()` limpia las 3 columnas y re-crea todas las tarjetas. Cambiar a: diff por `id` (mapa `id → nodo`), `DocumentFragment`, delegación de eventos en `#crm-kanban-wrapper` (un solo listener en vez de 5×N).
4. **Idempotencia.** `init()` debe registrar listeners una vez; `destroy()` debe desmontarlos (hoy existe pero nadie lo llama; `portalCleanup` se asigna y nunca se invoca en `entry-crm.ts:242`).
5. **Tokens.** `--font-serif`/`--font-sans` → `--font-display`/`--font-body`; revisar que `--humo` no diverja entre `ronda-tokens.css` (`.62`) y `styles.css` (`.82`), que hoy se pisan por orden de carga.
6. **Sincronización visible.** `subscribeToLeads(cb, uid, onError)` debe pasar también `{fromCache, hasPendingWrites}` leyendo `snap.metadata` (`db.ts:900`). El toast de `entry-crm.ts:154` solo es honesto si la UI muestra el estado real.

---

## 5. Roadmap

| Fase | Contenido | Jornadas | Salida verificable |
|---|---|---|---|
| **F0 — Dinero y seguridad** | P0-1, P0-2, P0-3, P0-4, P0-5 | 2.75 | Comisión mostrada = ledger; drawer a prueba de payload; borrado con rollback; `leads.create` cerrado |
| **F1 — Correctitud** | P1-6…P1-11, P1-14, P2-15, P2-22 | 3.5 | Superadmin ve el pipeline; filtros y WhatsApp correctos; cuenta viva; alta de red sin callejones sin salida |
| **F2 — Operabilidad** | P1-12, P1-13, P2-19, P2-20, P2-21 | 4.5 | Vista «Hoy», timeline auditable, drawer accesible, estados de carga/error/vacío |
| **F3 — Escala y mantenimiento** | P2-16, P2-17, P2-18, P2-23, P3-25…P3-28 | 6 | CSS extraído, un solo shell, render incremental, export CSV, badge de sincronización |

**Orden recomendado:** F0 → F1 → F2, y F3 en paralelo solo si hay segundo revisor (toca CSS global compartido con `admin`/`network`/`superadmin`).

---

## 6. Criterios de aceptación globales

- [ ] Ninguna cifra de comisión en la UI se calcula con literales; todas salen de `DEFAULT_SCOUT_POLICY`.
- [ ] `grep -n "500000\|500_000" src/ crm.html` → 0 resultados fuera de pruebas.
- [ ] `grep -n "window.confirm\|window.prompt" src/crm.ts` → 0 resultados.
- [ ] `crm.html` contiene al menos `role="dialog"`, `aria-modal="true"` y `aria-live="polite"` para el contador.
- [ ] Todos los flujos del rol `sales` probados contra el emulador: sin `permission-denied` en consola.
- [ ] `npm run check:html` en verde.
- [ ] Nueva suite `node test/test-crm-commission.cjs` (patrón de `test/test-b2b-scouts-hosters.cjs`): hitos A/B/C, devengado vs pagado, retención 90 d, teléfono con/sin `+57`, XSS en nombre.
- [ ] Render < 50 ms con 200 leads (medido en DevTools Performance).

---

## 7. Decisiones que requieren al fundador

1. **¿Bounty 450.000 (política v5.1) o 500.000 (marca actual)?** Bloquea P0-1. Recomendación: 450.000, porque es lo que `b2b-engine.ts` escribe en `commission_ledger`; cambiar la política implica recomputar pagos ya devengados.
2. **¿El rol `sales` ve todo el pipeline o solo lo suyo?** Hoy: solo lo suyo. Si hay equipo, hace falta alcance por rol (P1-6) y una regla de lectura más fina que la actual `isAdmin()` — que deja a un **anfitrión de bar** leer los leads de todos sus competidores (`firestore.rules:243`).
3. **¿Borrado duro o soft-delete?** Recomendación: soft-delete con historial; el borrado duro solo para superadmin.

---

## 8. Anexo — Brechas de producto (no son bugs, son alcance)

Un CRM de expansión B2B en Bogotá vive de cinco cosas que hoy no están: **próxima acción** (P1-12), **historial/auditoría** (P1-13), **motivo de pérdida** (falta: `lost_reason` al archivar), **seguimiento de hitos B/C en el tablero** (hoy solo visibles tras 2 clics en «Mi Estado de Cuenta») y **reporte mensual de pipeline**. Las cinco juntas son ~4 jornadas y convierten el panel de «visor de tarjetas» en la herramienta que sostiene la comisión.
