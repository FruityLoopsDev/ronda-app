# 🚀 TAREAS DE DESPLIEGUE FINAL Y LIQUIDACIONES B2B (PARA CLINE)

> **Contexto:** Antigravity ha validado la seguridad y el motor B2B. Ahora, Cline debe encargarse de implementar los detalles de UI finales, asegurar la limpieza del código para producción y aplicar las tareas del flujo B2B (Liquidaciones).
> **Reglas:** 
> 1. Marca con `[x]` las tareas completadas.
> 2. NO ejecutes `firebase deploy` hasta que el usuario te dé la orden explícita.
> 3. Utiliza código Vanilla (CSS y JS), nada de Tailwind.

## FASE 1: LIMPIEZA PARA PRODUCCIÓN (Vite)
- [x] Abre el archivo `vite.config.ts`.
- [x] En la configuración de `define` o en un nuevo bloque `esbuild`, asegúrate de eliminar los `console.log` para producción.
  *Ejemplo de adición:* `esbuild: { drop: ['console', 'debugger'] }`
  *Implementado:* `esbuild: { drop: ['console', 'debugger'] }` solo cuando `command === 'build'` (en dev se conservan los logs).
- [x] Ejecuta `npm run build` para comprobar que la compilación funciona correctamente sin errores.

## FASE 2: INYECCIÓN DE FOOTERS EN HTML
El usuario requiere que TODOS los paneles y páginas cuenten con un footer dinámico y/o con el Copyright y la Versión siempre actualizada.
- [x] Identifica los siguientes archivos: `index.html`, `admin.html`, `crm.html`, `superadmin.html`, `network.html`, `invest.html`, `landing.html`, `partners.html`.
- [x] Agrega en la parte inferior de cada body (o al final del contenedor principal) un footer con el siguiente formato base:
  ```html
  <footer class="ronda-footer">
    <p>&copy; 2026 RONDA. Todos los derechos reservados. | Versión <span class="app-version">1.0</span></p>
  </footer>
  ```
  *Implementado:* portales (index/admin/crm/network/superadmin) usan `<div id="footer-root">` + inyección desde `src/footer.ts`; páginas públicas (invest/landing/partners) llevan ganchos `data-ronda-version/copyright` hidratados; `superadmin.html` tiene `footer.ronda-footer` propio con hooks.
- [x] Asegúrate de que los estilos CSS correspondientes (`ronda-footer`) se encuentren en `/assets/ronda-tokens.css` o `/css/styles.css` con el estilo "Night Premium" (fondo oscuro, letra clara sutil, tipografía Space Grotesk).
  *Implementado:* bloque `.ronda-footer` + `.app-version` al final de `assets/ronda-tokens.css`.
- [x] (Opcional pero recomendado) Si la versión se lee dinámicamente de `package.json`, crea un script en el bundle (ej. en `src/app.ts` o un nuevo módulo) que inyecte el número de versión en `.app-version`, o simplemente déjalo estático si no es factible la inyección en tiempo real en estáticos.
  *Implementado:* `src/version.ts` (SSoT autogenerada por `scripts/sync-version.cjs` desde `package.json`) + `src/footer.ts` (`hydrateRondaFooter`/`renderRondaFooter`).

## FASE 3: IMPLEMENTACIÓN B2B (Scouts & Hosters)
Ejecuta los requerimientos detallados en `docs/cline-task-liquidaciones-b2b.md`:
- [x] **Botonería de CRM:** Arreglar el botón "Nuevo Lead" que actualmente no funciona, según reportó el usuario.
  *Causa raíz:* `crm.html` no tenía `#modal-ronda-dialog`; `RondaDialog.alert()` nunca resolvía y el form quedaba colgado en "Guardando…". *Fix:* `src/dialog.ts` ahora crea el modal dinámicamente en cualquier portal (+ catch con `RondaDialog` en vez de `alert()` nativo).
- [x] **Esquema de Comisiones:** Implementar visualmente (en `crm.html` / `superadmin.html` según corresponda) los campos para visualización de hitos de los Scouts.
  *Implementado:* "Mi Estado de Cuenta" en `src/crm.ts` (embudo A→B→C, progreso Hito C valid/8, alertas día 60/75, devengado vs pagado, aviso RUT/PILA) + sección Liquidaciones B2B en `src/superadmin.ts`.
- [x] **Desembolso Manual:** En el panel del Superadmin, asegurar que exista el UI para aprobar "Desembolsos Manuales" tras verificar RUT y PILA.
  *Implementado:* modal "Aprobar desembolso" con checklist RUT + PILA vigente (mes America/Bogota) + cuenta titular + referencia requerida; botón deshabilitado hasta cumplir; `approvePayout` + `savePayout` + `logAudit`.

## FASE 4: REPORTE FINAL AL USUARIO
- [x] Una vez finalizado todo, informa al usuario que has completado el archivo `task.md`.

## FASE 5: BLINDAJE DE FACE-ID & KYC (PARA CLINE - EJECUTOR AUTÓNOMO)
> **Diagnóstico del Arquitecto (Antigravity):**
> 1. El cálculo matemático y matriz de decisión han sido blindados y probados en `test/test-face-verification-suite.cjs` (`npm run test:face`).
> 2. Puntos de falla en runtime identificados en `src/verification.ts`:
>    - **Captura prematura de video:** En `startVerification`, `ctx.drawImage` a veces lee cuando `videoEl.videoWidth === 0` o el stream aún no envía fotogramas activos, resultando en un canvas vacío (`no_face`).
>    - **Sobrecarga de Tesseract OCR:** Si la descarga del CDN de Tesseract se demora o falla, el usuario queda atascado. Si el OCR no detecta palabras clave pero sí hay rostro en el documento, debe degradar limpiamente enviando a `kycReviews` (`queueManualReview`) con estado `pending`, nunca lanzar pantalla rota.
>    - **Rutas de modelos:** Confirmar que `src/face-verify.ts` intente `/models` y el CDN de respaldo sin lanzar excepciones no controladas.

### Tareas para Cline:
- [x] **T-1: Loop de Validación de Video Activo:**
  En `src/verification.ts` (`startVerification`), reemplazar el `setTimeout(600)` por un wait activo que verifique `videoEl.readyState >= 2 && videoEl.videoWidth > 0`.
- [x] **T-2: Timeout & Fallback en Tesseract OCR:**
  En `src/verification.ts` (`scanDocumentOCR`), agregar un timeout de 8 segundos. Si expira o falla la red, retornar `{ success: false, rawText: '', hits: [], error: 'ocr_timeout' }` sin interrumpir la extracción del rostro del documento.
- [x] **T-3: Degradación Limpia a Revisión Manual:**
  Asegurar que ante cualquier duda de coincidencia o falla leve de OCR, el usuario reciba el feedback de "Enviado a revisión manual" (`kycReviews`) y no un bloqueo con error rojo.
- [x] **T-4: Ejecución y Validación de Suite:**
  Ejecutar `npm run test:face` y verificar que pase 15/15.
- [x] **T-5: Comprobación de Build:**
  Ejecutar `npm run build` para asegurar cero regresiones en TypeScript y en el bundle final.

## FASE 6: INCENTIVO Y BADGE "CLUB FUNDADOR 100" (PARA CLINE - EJECUTOR AUTÓNOMO)
> **Especificación del Arquitecto (Antigravity):**
> Implementar el programa de captación de los primeros 100 usuarios ("Club Fundador 100") para incentivar el registro temprano, el balance 50/50 y la viralidad por referidos.

### Tareas para Cline:
- [x] **T-6.1: Asignación de Badge en Registro:**
  En `src/auth.ts` (al crear perfil de usuario), contar los usuarios existentes o verificar `usersCount < 100`. Si cumple, asignar en el perfil del usuario: `isFoundingMember: true` y `founderNumber: count + 1`.
- [x] **T-6.2: Insignia Dorada en Modal de Perfil:**
  En `src/views/profile-modal.ts` y `src/profile.ts`, si `user.isFoundingMember` es `true`, renderizar en la parte superior del perfil el badge visual:
  `<span class="badge-founder">⭐ Miembro Fundador #${user.founderNumber || 1}</span>` con estilo dorado (`var(--luz)` / `#F0A830`).
- [x] **T-6.3: Banner / Contador en Landing:**
  En `landing.html`, añadir un chip/banner informativo en la cabecera del héroe o formulario:
  `🏆 Beneficios del Club Fundador 100: Insignia Dorada + Prioridad de Cupo + 1er Cóctel de Cortesía`.
- [x] **T-6.4: Validación de Build:**
  Ejecutar `npm run build` para garantizar cero errores de TypeScript o empaquetado.

## FASE 7: BLINDAJE LEGAL, DESINDEXACIÓN Y PRIVATIZACIÓN DE /invest (P0-2, P0-3, P0-4)
> **Especificación detallada completa en:** `task-invest-hardening.md`  
> **Objetivo:** Cumplir guardarraíles legales (prevención de captación masiva) y proteger la Pista B (Founders Circle).

### Tareas para Cline:
- [x] **T-7.1: Sincerar Barra de Tickets en `invest.html` (P0-2):**
  Ajustar estado inicial a 0/8 tickets ($0 recaudados) y agregar inicializador reactivo `RONDA_INVEST_CONFIG` + `syncTicketProgressUI()`.
- [x] **T-7.2: Desindexación SEO de `/invest` (P0-3):**
  Crear `public/robots.txt` bloqueando `/invest` y paneles. Inyectar `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">` en `invest.html`. Anonimizar Open Graph / Twitter previews.
- [x] **T-7.3: Cabeceras de Seguridad en `firebase.json` (P0-3):**
  Agregar regla en `hosting.headers` para `"/invest*"` con `X-Robots-Tag: noindex, nofollow, noarchive`.
- [x] **T-7.4: Gate de Acceso Nominal y Token por URL (P0-4):**
  Implementar soporte de tokens nominativos (`?token=...`), catálogo `AUTHORIZED_GUESTS` y telemetría de auditoría (`leadId`) en `RondaTracker.track('investor_portal_unlocked')`.
- [x] **T-7.5: Build Check:**
  Ejecutar `npm run build` para verificar cero regresiones. (Completado con éxito, build en 2m 2s).

## FASE 8: GENERADOR Y GESTOR DE TOKENS FFF EN PANEL MASTER / SUPERADMIN (PARA CLINE - EJECUTOR AUTÓNOMO)
> **Especificación del Arquitecto (Antigravity):**
> Centralizar la creación y administración de enlaces/tokens personalizados de la Pista FFF (`/invest.html`) desde el Panel Superadmin (`superadmin.html` + `src/superadmin.ts`), almacenándolos en Firestore (`invest_tokens`) con validación en tiempo real en la landing `/invest`.

### 🔄 Bucle de Ejecución para Cline:

- [x] **T-8.1: Reglas de Seguridad en `firestore.rules`:**
  - Agregar regla para la colección `invest_tokens`:
    ```
    match /invest_tokens/{tokenId} {
      allow read: if true;
      allow write: if isSuperAdmin();
    }
    ```
  - Esto permite a la landing `/invest` validar tokens sin autenticación, mientras restringe la emisión y revocación exclusivamente a usuarios con rol `superadmin`.

- [x] **T-8.2: Interfaz y CRUD de Tokens en `src/superadmin.ts`:**
  - Definir la interfaz TypeScript `InvestToken` (`token`, `name`, `leadId`, `role`, `ring`, `phone`, `notes`, `active`, `createdAt`).
  - En `render()` de `SuperAdminController`, agregar la tarjeta: **"🎟️ Pista Privada FFF: Tokens & Enlaces de Inversión (/invest)"**.
  - **Formulario de Emisión:**
    - Inputs: `Nombre Completo`, `Anillo FFF (A1: Núcleo, A2: Amigos, A3: Red Prof., A4: Mentores, GEN: General)`, `Slug/Token` (autogenerado con prefijo `rnd-{anillo}-{slug}` pero editable), `WhatsApp` (opcional).
    - Botón `➕ Emitir Token`: Guarda en Firestore colección `invest_tokens` usando el `token` como Document ID.
  - **Lista / Tabla de Tokens Emitidos:**
    - Mostrar tokens existentes ordenados por fecha descendente.
    - Badges para `Activo` (verde) y `Revocado` (rojo).
    - Botón `📋 Copiar Link`: Copia `https://ronda-uno.web.app/invest.html?token={token}`.
    - Botón `💬 Mensaje WhatsApp`: Genera y copia el guion de WhatsApp personalizado listo para enviar.
    - Botón `🚫 Toggle Estado`: Alterna `active: true/false`.
    - Botón `🗑️ Eliminar`: Borra el documento en Firestore tras confirmación.

- [x] **T-8.3: Validación Dinámica en `invest.html`:**
  - En `invest.html`, actualizar `checkUrlAuth()` y `verifyDataRoomPin()`:
    1. Comprobar primero en `AUTHORIZED_GUESTS` (fallback estático).
    2. Si no coincide, consultar Firestore vía REST API (0 dependencias externas):
       `https://firestore.googleapis.com/v1/projects/ronda-uno/databases/(default)/documents/invest_tokens/${encodeURIComponent(token)}`
    3. Si el documento existe y `active !== false`, desbloquear la suite con `unlockWithGuest(token, guestData)`.

- [x] **T-8.4: Verificación de TypeScript y Bundle:**
  - Ejecutar `npx tsc --noEmit` y comprobar 0 errores de tipado.
  - Ejecutar `npm run build` y asegurar que Vite compile limpiamente.
  - Marcar con `[x]` las tareas conforme se completen.

## FASE 9: INTEGRACIÓN VISUAL DEL KIT CLUB FUNDADOR 100 EN /invest.html (PARA CLINE - EJECUTOR AUTÓNOMO)
> **Especificación del Arquitecto (Antigravity):**
> Integrar el Kit de Bienvenida «Club Fundador 100» en la landing `/invest.html` para maximizar la conversión de la micro-ronda FFF ($8M COP). El objetivo es destruir la percepción de "software abstracto", justificar la partida presupuestal de $1.8M COP en el Uso de Fondos y ofrecer a los 8 inversores su beneficio de honor físico.
> **Referencia de Diseño y Costos:** Ver [docs/KIT_BIENVENIDA_CLUB_FUNDADOR_100.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/KIT_BIENVENIDA_CLUB_FUNDADOR_100.md).

### 🔄 Bucle de Ejecución para Cline:

- [x] **T-9.1: Tarjeta de Experiencia Física en la Pestaña "La Noche" o "Cliente" de `invest.html`:**
  - En `invest.html`, dentro de la sección de experiencia (`#noche` o `#cliente`), agregar un contenedor con diseño premium Night/Ámbar (`var(--barra)`, borde `rgba(240,168,48,0.3)`):
    - **Header:** Chip superior: `EXPERIENCIA FÍSICA & BRANDING TÁCTIL` + Título: `🪙 El Efecto Club Fundador: Lujo Analógico en la Noche de Bogotá`.
    - **Cuerpo con 3 artefactos visuales:**
      1. `La Moneda de Barra (45mm Latón Macizo · 35g)`: Troquel exclusivo `Nº 001/100`. Al deslizarla en la barra, se reclama el "Cóctel Cero" de cortesía sin usar el teléfono.
      2. `La Comanda de Iniciación (Papel Algodón 300g)`: Tipografía letterpress en bajo relieve con el decálogo de los 6 minutos y caligrafía personalizada.
      3. `Sobre Negro Lino & Lacre`: Cartulina 180g texturizada, sellada con cera flexible rojo vino (`#9B2748`).
    - **Insignia Perk para Inversionistas FFF:**
      Caja destacada con borde dorado:
      `✨ Beneficio de Honor para Inversionistas FFF: Cada aportante de 1 ticket ($1.000.000 COP) recibe su propia Moneda Conmemorativa troquelada con su serial exclusivo (ej. Nº 001 - Inversor FFF), acceso prioritario vitalicio a los eventos y una mesa reservada en la noche inaugural.`

- [x] **T-9.2: Bloque explicativo de unit economics ($18.000 COP/kit) bajo la barra de $1.8M COP en `#modal-doc-financial`:**
  - En `invest.html` (alrededor de la línea 1791, bajo la barra de `🏷️ Kits de Branding, Props Físicos y Merch: $1.800.000 COP (22.5%)`):
  - Añadir un bloque sutil con tipografía Mono/Grotesk:
    ```html
    <div style="background: rgba(240,168,48,0.06); border: 1px dashed rgba(240,168,48,0.3); border-radius: 8px; padding: 10px 14px; margin-top: 8px; font-size: 11.5px; line-height: 1.5; color: var(--humo);">
      💡 <b>Economía del Kit Fundador:</b> Costo unitario de <b>$18.000 COP</b> (Moneda latón $12.500 + Letterpress $2.800 + Sobre lino $1.200 + Lacre $1.500). El lote inicial de 50 kits para los primeros 2 pilotos absorbe solo $900.000 COP, dejando $900.000 COP para campanas de bronce y props de sala. Blinda la asistencia (&gt;95% no-show prevention) y genera ~24.000 impresiones orgánicas.
    </div>
    ```

- [x] **T-9.3: Verificación Técnica y Estilos:**
  - Usar CSS Vanilla con variables del sistema (`var(--barra)`, `var(--luz)`, `var(--papel)`, `var(--humo)`). Cero dependencias externas ni Tailwind.
  - Asegurar responsividad en móviles (`@media (max-width: 768px)`).
  - Ejecutar `npx tsc --noEmit` y `npm run build` para asegurar cero errores de compilación.
  - Marcar con `[x]` las tareas completadas en `task.md`.

---

## 📌 FASE 10: Sincronización Automática del Contador de Horas y Control de Versiones (Git) Día a Día
> **Objetivo:** Actualizar el contador de ingeniería de forma 100% desatendida y auditable día con día, cruzando el control de versiones (commits, días calendario, jornadas activas) tanto en tiempo de build como en tiempo de ejecución (cliente en vivo con fallback estocástico y sondeo a GitHub API).

### 🔄 Implementación:
- [x] **T-10.1: Extracción Git Auditable en Prebuild (`scripts/sync-version.cjs`):**
  - Cruza `git rev-list --count HEAD` (88 commits), fechas de commits para extraer días únicos activos (15 días) y días calendario totales transcurridos (64 días).
  - Genera `src/version.ts` con constantes numéricas (`APP_COMMIT_COUNT`, `APP_UNIQUE_DEV_DAYS`, `APP_CALENDAR_DAYS`, `APP_DEV_HOURS`).
- [x] **T-10.2: Hidratación Dinámica Día a Día en Cliente (`src/footer.ts`):**
  - Calcula en tiempo real la progresión diaria sumando horas continuas por día transcurrido desde el último commit verificado (`daysSinceLast * 2`).
  - Incluye ticker automático cada 30 minutos para avanzar automáticamente a medianoche sin recargar la página.
  - Consulta asíncrona no invasiva a la GitHub API (`FruityLoopsDev/ronda-app`) con cache en `localStorage` (4h) para revalidar commits en caliente.
- [x] **T-10.3: Blindaje de CI/CD en GitHub Actions (`.github/workflows/firebase-hosting-merge.yml`):**
  - Configurado `fetch-depth: 0` en `actions/checkout@v4` para que los runners de GitHub clonen el historial completo de Git y no trunquen el conteo a 1.
- [x] **T-10.4: Despliegue Consistente en Landings y Portales:**
  - `landing.html`, `invest.html` y `partners.html` cuentan con badge `[data-ronda-engineering-badge]` e iconos de redes sociales (Instagram, LinkedIn, GitHub).
  - Verificado con `npx tsc --noEmit` (0 errores) y `npm run build` (151 módulos transformados).

---

## 📌 FASE 11: Términos y Condiciones, Política de Privacidad (Ley 1581) y Flujo de Baja / Supresión con Cuestionario de Salida
> **Objetivo:** Blindar el cumplimiento de la Ley 1581 de 2012 (Habeas Data) y el Estatuto del Consumidor en Colombia, proporcionando lectura clara de Términos y Privacidad, y garantizando el derecho inalienable a la baja de cuenta inmediata y supresión de datos sensibles (biometría, fotos y perfil) con un cuestionario opcional de salida para aprendizaje de producto.
> **Documentos de Referencia:** [docs/TERMINOS_Y_CONDICIONES.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/TERMINOS_Y_CONDICIONES.md) y [docs/POLITICA_TRATAMIENTO_DATOS_LEY_1581.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/POLITICA_TRATAMIENTO_DATOS_LEY_1581.md).

### 🔄 Bucle de Ejecución para Cline:

- [x] **T-11.1: Componente / Modal de Lectura Legal (`#modal-legal-viewer` en `index.html`):**
  - Implementar un modal accesible (`#modal-legal-viewer`) con selector de pestañas:
    1. *Términos y Condiciones de Uso*
    2. *Política de Privacidad y Tratamiento de Datos (Ley 1581 de 2012)*
  - Conectar los enlaces de texto en el formulario de registro (`src/views/auth-view.ts` e `index.html`) para que al hacer clic en *"términos"* o *"política de privacidad"* se abra este visor modal con scroll fluido en vez de redireccionar.

- [x] **T-11.2: Sección de Gestión de Privacidad y Botón de Baja en Perfil (`index.html` + `src/profile.ts`):**
  - En la vista de perfil (`#panel-profile`), agregar una tarjeta estilizada al final con el encabezado `🔒 Privacidad y Control de Cuenta (Ley 1581)`:
    - Enlace para consultar Términos y Política de Privacidad.
    - Botón de peligro sutil con estilo outline rojo/vino:
      `<button id="btn-open-delete-account" class="btn outline-danger sm">Darse de baja y suprimir mis datos</button>`
    - Vincular el evento en `src/profile.ts` para abrir el modal `#modal-delete-account`.

- [x] **T-11.3: Modal de Cancelación con Cuestionario Opcional (Exit Survey) en `index.html`:**
  - Crear el modal `#modal-delete-account`:
    - **Aviso Legal:** *«En cumplimiento de los Arts. 8 y 9 de la Ley 1581 de 2012, al confirmar la baja se revocarán tus autorizaciones y se suprimirán tus fotos, datos biométricos, historial de rondas y matches de forma permanente e irreversible.»*
    - **Cuestionario Opcional de Salida (Exit Survey):**
      - Título: *«Ayúdanos a mejorar (Opcional): ¿Cuál es el motivo de tu baja?»*
      - Opciones seleccionables (radio buttons):
        - `found_love_ronda`: *«Encontré pareja en RONDA 💖»*
        - `found_love_outside`: *«Encontré pareja por fuera 🍸»*
        - `few_events`: *«Pocos eventos o locaciones en mi zona 📍»*
        - `no_time`: *«Falta de tiempo para asistir a los eventos ⏳»*
        - `ticket_price`: *«Precio de las entradas a los gastrobares 💵»*
        - `privacy_concerns`: *«Preocupación por mi privacidad / datos 🔒»*
        - `other`: *«Otro motivo 💬»*
      - Textarea opcional: `placeholder="¿Qué podríamos haber hecho mejor? (Opcional)"`.
      - Checkbox obligatorio: `[x] Entiendo que esta acción es definitiva y eliminará permanentemente mis datos y matches.`
    - **Botones:**
      - Primario de peligro: `<button id="btn-confirm-delete-account" class="btn danger" disabled>Confirmar Baja y Borrado de Datos</button>` (se habilita al marcar el checkbox).
      - Cancelar: `<button id="btn-cancel-delete-account" class="btn outline">Mantener mi Cuenta Activa</button>`.

- [x] **T-11.4: Lógica de Supresión en Base de Datos y Autenticación (`src/db.ts` + `src/profile.ts`):**
  - En `src/db.ts`, implementar `DB.deleteUserAccount(userId: string, surveyData?: { reason?: string, feedback?: string })`:
    1. Si el usuario seleccionó un motivo o dejó feedback, guardar el registro anonimizado en la colección Firestore `churn_surveys` (campos: `reason`, `feedback`, `createdAt: serverTimestamp()`, sin ID de usuario ni correo, garantizando anonimato estadístico).
    2. Eliminar el documento del usuario en Firestore (`deleteDoc(doc(db, 'users', userId))`).
    3. Purgar credenciales y cachés locales (`localforage.clear()`, `localStorage.clear()` o remover claves de sesión).
    4. Eliminar el usuario en Firebase Authentication (`currentUser.delete()`). En caso de error por token expirado (`auth/requires-recent-login`), capturarlo, cerrar sesión (`Auth.logout()`) y advertir al usuario.
    5. Redirigir a la vista de login/landing y mostrar notificación toast: *«Tu cuenta y datos personales han sido suprimidos exitosamente conforme a la Ley 1581 de 2012.»*

- [x] **T-11.5: Enlaces Legales en Pie de Página de Landings (`landing.html`, `invest.html`, `partners.html`):**
  - Asegurar que los textos "Términos y Condiciones" y "Privacidad (Ley 1581)" en los footers enlacen a los documentos o abran el diálogo modal correspondiente.

- [x] **T-11.6: Verificación Técnica de Compilación:**
  - Ejecutar `npx tsc --noEmit` y `npm run build` para asegurar cero errores de compilación y empaquetado de producción limpio. (✅ VALIDADO: tsc exit 0, build exit 0).
  - Marcar con `[x]` las tareas en `task.md`.

---

## FASE 12: REDISEÑO Y ELEVACIÓN DEL FOOTER EN `/partners.html` (PARA CLINE - EJECUTOR AUTÓNOMO)

> **Contexto:** En la landing de aliados (`partners.html`), el pie de página actual sufre de compresión y desorden visual: los textos legales y métricas de ingeniería están agrupados en un solo `<p>` con flex-wrap que rompe líneas de forma antiestética ("Privacidad" en una línea sola), y en el extremo derecho el contador de visitas colisiona físicamente con el botón flotante de WhatsApp (`.wa-float`).

### 🔄 Bucle de Ejecución:

- [x] **T-12.1: Estructuración del Layout B2B en 2 Niveles (`partners.html`):**
  - Reemplazado el contenedor plano por la cuadrícula semántica de 2 niveles: Marca B2B, Navegación con links a portal e inversores, Contacto Scout B2B y Redes Sociales.
  - Borde separador tenue con Copyright, métricas de ingeniería hidratadas (`data-ronda-*`) y contador `#global-visit-counter` con margen anti-colisión de 70px.

- [x] **T-12.2: Estilos CSS Dedicados y Reglas Mobile-First (`partners.html`):**
  - Implementadas clases `.site-footer`, `.footer-top`, `.footer-brand`, `.footer-nav-links`, `.footer-scout-badge`, `.footer-bottom`, `.footer-meta-right` con media query para colapso vertical en pantallas pequeñas.

- [x] **T-12.3: Verificación Técnica de Compilación:**
  - Ejecutar `npm run build` para validar que `dist/partners.html` se empaquete sin fallos. (✅ VALIDADO: build exit 0).
  - Marcar con `[x]` las tareas completadas en `task.md`.

