# Auditoría del panel `/admin` y corrección definitiva del diálogo

**Fecha:** 2 de noviembre de 2026
**Alcance:** consola de anfitrión (`/admin`), sistema de diálogos compartido (`src/dialog.ts`) y su uso en el resto de portales.
**Versión auditada:** `2.3.1-prod` (build `dist/`, emulador de Firebase en `localhost:5002`).

---

## 1. Resumen ejecutivo

El texto que se veía en el modal —`<br><br>1. <b>Penicillin Ahumado</b>…`— no era un problema de estilos ni del contenido: era el **markup HTML de la aplicación mostrándose como texto literal** porque `RondaDialog` escapaba *todos* los mensajes, mientras 28 llamadas del producto le pasaban HTML deliberadamente.

El defecto no era cosmético. La misma causa dejaba **tres flujos funcionalmente muertos**:

1. `RondaDialog.prompt()` no mostraba input en la app principal (se abría sin campo y siempre devolvía `null`).
2. "Guardar Carta" de la Carta de la Noche leía un `<input>` que nunca llegaba al DOM: no guardaba nada.
3. El cierre de caja abortaba por un selector inválido (`##st-included-drinks`), así que **no calculaba ni permitía guardar la liquidación de barra**.

Se corrigieron 12 defectos (4 de ellos P0: dinero y seguridad) y quedan 13 hallazgos documentados con recomendación. La verificación se hizo contra el build real servido por el emulador, con login y navegación por las 10 secciones.

---

## 2. Descripción del problema

### 2.1 Síntoma observado

Al pulsar **🍸 Carta de la Noche** en *Resumen*, el diálogo mostraba:

```
Cócteles de cortesía confirmados para la sala:
<br><br>1. <b>Penicillin Ahumado</b> (Whisky escocés, jengibre, miel, limón)<br>2. <b>Caronte Sour</b> (…)
```

Es decir: etiquetas visibles, sin saltos de línea ni negritas, y una lectura incómoda en un modal de 360 px.

### 2.2 Causa raíz

En `src/dialog.ts`, la función que pintaba el mensaje hacía siempre:

```ts
if (msgEl) msgEl.innerHTML = escapeHtml(opts.message) + qrImg;
```

`escapeHtml()` convierte `<` en `&lt;`, por lo que **cualquier** HTML del mensaje se mostraba como texto. Pero el producto lo usaba como API de HTML en 28 puntos:

```ts
message: `La ficha técnica de <b>${lead.name}</b> fue guardada en Firestore.`
```

Había, por tanto, dos contratos incompatibles conviviendo: el componente prometía "texto plano" y los llamadores entregaban "HTML".

### 2.3 Por qué no era solo cosmético

| Flujo | Qué pasaba en realidad |
|---|---|
| `promptMenuCarta` (host) / `promptMenuNight` (bar) | La carta era una cadena fija con `<br>`; el `<input id="menu-night-price">` que se inyectaba en el mensaje **nunca se renderizaba**, y el código lo buscaba después con `getElementById`. El precio se leía de un nodo inexistente → la acción no persistía nada. |
| `RondaDialog.prompt()` en `/app` | `index.html` tenía su propia copia del modal **sin** `#dialog-prompt-input`. `prompt()` abría un diálogo sin campo y resolvía `null`. Afectaba a: transferir reserva, alta de local (nombre/zona/dirección) y recuperación de contraseña. |
| Cierre de caja | Un bug independiente, detectado por la prueba E2E: `const $ = id => stage.querySelector('#'+id)` se invocaba como `$('#st-…')`, generando el selector `##st-…` → `SyntaxError`. La excepción abortaba `renderSettlementsSection()` antes de cablear los botones: la sección mostraba `$0` y **no se podía guardar el cierre**. |

### 2.4 Alcance

- **28** llamadas a `RondaDialog` con markup en `message` (9 archivos).
- **1** copia estática del modal en `index.html`, desincronizada del componente.
- **4** portales donde el sistema de toasts estaba inerte (ver §4.1).

---

## 3. Método de auditoría

1. Lectura completa de `src/host-admin.ts` (2.713 líneas), `src/dialog.ts`, `src/bar.ts`, `src/portal-auth.ts`, `src/notifications.ts` y del modelo en `src/db.ts`.
2. Barrido automatizado de las llamadas a `RondaDialog` para localizar markup no declarado (script de un solo uso, no queda en el repo).
3. Prueba de extremo a extremo sobre el **build de producción** servido por el emulador (`localhost:5002`), con Chrome por CDP: login real, recorrido de las 10 secciones, apertura de la Carta, edición de precio, guardado y cierre de caja. Se capturaron errores de consola y se verificó la persistencia en Firestore.
4. Pruebas aisladas del diálogo: render con HTML, saneado de XSS, `prompt` (confirmar / cancelar / Escape) y comportamiento en 360×640 (emulación de dispositivo).

---

## 4. Hallazgos

Severidad: **P0** rompe dinero o seguridad · **P1** funcionalidad que engaña al operador · **P2** calidad y mantenibilidad.

### 4.1 Corregidos en esta intervención

| # | Sev | Hallazgo | Evidencia | Corrección |
|---|---|---|---|---|
| 1 | P0 | Todo el HTML de los diálogos se mostraba como texto (síntoma reportado) | `dialog.ts` → `escapeHtml()` incondicional | HTML **opt-in** (`html: true`) + saneado por allowlist |
| 2 | P0 | XSS almacenado en `/admin`: nombres, correos, cóctel y local se interpolaban sin escapar en `innerHTML` | `renderBookingsSection`, `renderLiveSection`, `renderShell` | `escapeHtml()` en todos los puntos de dato y saneado del diálogo |
| 3 | P0 | Cierre de caja inutilizado por selector `##id` (no calculaba ni guardaba) | `renderSettlementsSection` | ids sin almohadilla |
| 4 | P0 | Participantes fantasma: con menos de 2 asistentes el motor inyectaba 8 UIDs falsos y **los persistía como matches** en Firestore | `buildV2Plan` | Sin plan si no hay ≥2 asistentes reales + aviso al operador |
| 5 | P1 | `prompt()` sin input en `/app` → 5 flujos devolvían `null` en silencio | `index.html` (modal duplicado) | Markup único en `dialog.ts`; se elimina la copia estática |
| 6 | P1 | Toasts invisibles en `/admin`, `/crm`, `/superadmin`, `/net`: `notifications.init()` solo se llamaba en la app | `notifications.showToast` salía si `container` era `null` | Contenedor autocurativo + escapado del texto |
| 7 | P1 | Contadores por defecto falsos (`… \|\| 24`): la caja se prellenaba con 24 asistentes inexistentes | `renderSummarySection`, `renderLiveSection`, `renderSettlementsSection`, `renderAnalyticsSection` | Conteos reales (`?? 0`) |
| 8 | P1 | "Guardar Carta" no guardaba nada | `promptMenuCarta` / `promptMenuNight` | Carta persistida en `events/{id}.menu` + precio en `events/{id}.price` |
| 9 | P1 | Avisos de conexión del anfitrión nunca visibles | `entry-admin.ts` buscaba `#toast-container` inexistente | Delegado al sistema de notificaciones |
| 10 | P2 | Doble escape en títulos (`escapeHtml` en `title`, que se asigna con `textContent`) | `renderVenueSection` | Títulos sin pre-escapar |
| 11 | P2 | Fallback muerto por `promise \|\| await …` en incidencias de mesa | `renderLiveSection` | Flujo único con `prompt()` |
| 12 | P2 | Tercera copia del diálogo en `public/assets/ronda-dialog.js` (sin `prompt`, sin HTML, sin a11y) cargada por 4 páginas; en `superadmin` quedaba pisada por el módulo | `superadmin.html` | Se retira de `superadmin`; la copia legacy sobrevive solo en las páginas de marketing |

### 4.2 Pendientes (documentados, no corregidos)

| # | Sev | Hallazgo | Dónde | Recomendación |
|---|---|---|---|---|
| 13 | P0 | **KPIs del Resumen fabricados**: "78 %", "$1.190.000", "$78.000", "19 %", "2 Pagos Pendientes", "Noche #212" | `renderSummarySection` | Calcular desde `events`, `night_closings` y `reservations`; si falta dato, mostrar "—" |
| 14 | P1 | **Analytics fabricado**: `+41 pts`, ocupación semanal fija (82/68/94) y `barTotal = asistentes × 25.000 + 45.000`; el CSV exporta esos números | `renderAnalyticsSection`, `exportAnalyticsCsv` | Tomar `barTotalCop` del cierre aprobado y la serie histórica real |
| 15 | P1 | Acciones que reportan éxito sin persistir: **Duplicar Noche**, **Proponer Nueva Noche**, **Invitar Colaborador**, **Incidencia de mesa** | `renderNightsSection`, `promptNewDraftNight`, `renderTeamSection`, `renderLiveSection` | Implementar la escritura o deshabilitar con "Próximamente" |
| 16 | P1 | La consola siempre carga la noche `rnd-<venue>-mar-25`, sin importar la fecha | `loadActiveEvent` | Resolver la noche activa por fecha/estado |
| 17 | P1 | Sin granularidad de roles: `/admin` solo admite `admin`/`superadmin`; la matriz de permisos (door/bartender) es decorativa | `PORTALS.admin`, `renderTeamSection` | Roles reales + guardas por sección |
| 18 | P1 | Beneficios: `userId` es texto libre; el mismo asistente puede canjear dos veces si se teclea distinto | `renderPerksSection` | Resolver a `uid` real antes de canjear |
| 19 | P1 | Check-in manual/QR acepta cualquier cadena como `uid` → asistentes fantasma | `handleQrDecode`, `processCheckinFlow` | Validar contra `users` o resolver `RND-XXXX` en reservas |
| 20 | P2 | Colaboradores de ejemplo hardcodeados (`puerta@local.com`, `barra@local.com`) | `renderTeamSection` | Leer `venue.staff` |
| 21 | P2 | `admin.html` conserva un formulario de login y un `#footer-root` que `portal-auth`/`renderShell` reemplazan | `admin.html` | Eliminar markup muerto |
| 22 | P2 | Badge de cabecera en inglés (`GENERAL`, `FINANCE`) con UI en español | `switchSection` | Mapa de etiquetas |
| 23 | P2 | Accesibilidad: navegación sin `aria-current`; drawer móvil sin *focus trap* | `renderShell`, `setupNavigation` | Añadir semántica y trampa de foco |
| 24 | P2 | `#nn-price` se actualiza en `/admin`, donde no existe | `promptMenuCarta` | Eliminar el no-op |
| 25 | P2 | `landing.html` e `invest.html` siguen usando la copia legacy del diálogo (solo texto plano) | `public/assets/ronda-dialog.js` | Migrarlas a `dialog.ts` o retirar el shim |

---

## 5. Correcciones aplicadas

### 5.1 Un único diálogo, con contrato explícito

`src/dialog.ts` se reescribió como **fuente única** del modal para los cinco portales:

- `message` se **escapa por defecto** (comportamiento seguro para datos no confiables).
- `html: true` declara HTML propio y pasa por `sanitizeHtml()`.
- El título se asigna con `textContent` (los llamadores **no** deben escaparlo).
- Markup canónico con `max-width: 400px`, `max-height: calc(100dvh - 32px)` y zona de mensaje desplazable: el contenido largo ya no empuja ni se solapa con los botones.
- Accesibilidad: `role="dialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`, foco inicial en el botón (o en el input), `Escape` cancela, click en el fondo cancela y el foco vuelve al elemento de origen.
- Si quedaba un diálogo abierto, se resuelve antes de reutilizar el nodo (evita promesas colgadas).

**Sanitizador** (`sanitizeHtml`): allowlist de etiquetas y atributos, elimina `on*`, bloquea `javascript:`/`data:` en `href`/`src` y estilos con `url()`/`expression`. Se ejecuta sobre un documento inerte de `DOMParser` (no dispara cargas ni scripts).

### 5.2 Migración de las 28 llamadas

Se añadió `html: true` en cada llamada con markup y se escapó **todo** dato dinámico que entraba en el mensaje (nombres, correos, ids, nombres de local). Verificación automatizada: `0` llamadas con markup sin declarar.

### 5.3 Carta de la Noche real

- Nuevo modelo `NightMenu` en `src/db.ts` (`cocktails[]`, `priceCop`, `updatedAt`, `updatedBy`).
- Nuevo módulo `src/night-menu.ts`: carta por defecto de la alianza, normalización tolerante a datos corruptos y render en lista numerada.
- La carta se guarda en `events/{id}.menu` y el precio en `events/{id}.price`; el botón pasa a `✏️ Ajustar Precio` → `RondaDialog.prompt` (tipo `number`, valor precargado).
- La lista de "Mis Noches" y el resumen ahora reflejan la carta real (`✓ Definida y Aprobada` solo si existe).

### 5.4 Blindaje de datos y avisos

- Escapado sistemático en las vistas del panel (tabla de reservas, mesas en vivo, barra, cabecera, sidebar).
- Toasts autocurativos y escapados en `notifications.ts` (los avisos ya se ven en los cuatro portales).
- Check-in idempotente en el estado local (`Set`), evitando duplicados por `arrayUnion`.

---

## 6. Verificación

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run build` | ✅ build de producción correcto |
| Login real + 10 secciones en `/admin` | ✅ todas renderizan; `0` errores de consola (antes: `SyntaxError` en Caja) |
| Diálogo con HTML | ✅ `hasListItems: true`, `hasRawTagText: false` |
| Saneado XSS (`<img onerror>`, `<script>`, `href="javascript:"`) | ✅ atributo, etiqueta y URL eliminados; `<b>` conservado |
| `RondaDialog.prompt` | ✅ devuelve `"52000"` al confirmar; `null` al cancelar y con `Escape` |
| Persistencia de la Carta | ✅ `price: 52000`, `menu.priceCop: 52000`, `menu.cocktails: [Penicillin Ahumado, Caronte Sour]` en Firestore |
| Cierre de caja | ✅ 10 bebidas → `$250.000`, guardado `status: draft` |
| Layout 360×640 | ✅ tarjeta 328 px, sin desbordamiento horizontal |
| Contenido largo (9 cócteles) | ✅ scroll interno; botones siempre visibles |

Los artefactos de prueba (usuario QA, cierre y evento del emulador) se eliminaron o restauraron al finalizar.

---

## 7. Recomendaciones priorizadas

1. **P0 — Dejar de mostrar cifras inventadas.** El Resumen y Resultados son la cara del producto ante un aliado; hoy muestran datos fijos. Mientras no exista el cálculo, es preferible `—` con "sin datos suficientes" a un `$1.190.000` ficticio.
2. **P1 — Cerrar las acciones que mienten.** Duplicar noche, proponer noche, invitar colaborador e incidencias reportan éxito sin escribir nada. Es la vía más rápida a perder la confianza del operador.
3. **P1 — Resolver la noche activa por fecha**, no por id fijo.
4. **P1 — Identidad en beneficios y check-in**: resolver siempre a `uid`; hoy un nombre suelto crea un "asistente" que el motor tratará como real.
5. **P2 — Roles reales** (door, bartender, host) con guardas por sección y `aria-current` en la navegación.

---

## Anexo A — Contrato de `RondaDialog`

```ts
// Texto plano (seguro por defecto): se escapa.
RondaDialog.alert({ title: 'Aviso', message: 'Texto con <b>etiquetas</b>' });
// → muestra literalmente "Texto con <b>etiquetas</b>"

// HTML propio: se declara y se sanea.
RondaDialog.confirm({
  title: 'Carta de la Noche',
  message: buildNightMenuHtml(menu, 52000),
  html: true,
  confirmText: '✏️ Ajustar Precio'
});

// Prompt con input (funciona en los cinco portales).
const raw = await RondaDialog.prompt({
  title: 'Precio', message: 'COP por consumición',
  inputType: 'number', defaultValue: '45000'
}); // string | null
```

**Regla:** con `html: true`, cualquier valor dinámico debe ir envuelto en `escapeHtml()`. Sin `html`, no se necesita.

## Anexo B — Reproducir la verificación

```bash
npx tsc --noEmit            # tipos
npm run build               # build de producción (dist/)
npm run emulator:start      # o el emulador ya en marcha en :5002
```

La prueba E2E se ejecutó con Chrome por CDP contra `http://localhost:5002/admin`; no forma parte del repositorio (script temporal).
