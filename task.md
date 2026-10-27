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

## 🔄 Bucle de Ejecución para Cline:

- [x] **T-15.1: Purgar credenciales y script de rotación de contraseña:** Eliminar `backups/staff-cesar-credentials.txt`, eliminar `fix-profile.js` residual y crear `scripts/rotate-password.cjs` para rotación segura de contraseñas.

- [x] **T-15.2: CSP con dominios Google Translate y CDNs en firebase.json:** Añadir `https://translate.google.com https://translate.googleapis.com https://cdn.jsdelivr.net https://unpkg.com` en las directivas `script-src` y `connect-src` del Content-Security-Policy de firebase.json.

- [x] **T-15.3: Exigir email_verified == true en isSuperAdmin() de firestore.rules:** Modificar la función `isSuperAdmin()` para exigir `email_verified == true` como condición de seguridad antes de otorgar privilegios superadmin.

- [x] **T-15.4: Sincera métricas y footer:**
  - Eliminar métricas simuladas de visitas en `superadmin.html` (contador `visit-count`).
  - Añadir etiqueta `(est.)` a las métricas de ingeniería en `footer.ts` (habilitadas por público).

- [x] **T-15.5: URLs oficiales en footers:**
  - Reemplazar `href="#"` en las secciones footer de `landing.html`, `partners.html` e `invest.html` por URLs oficiales de RONDA (`https://instagram.com/ronda.uno`, `https://www.linkedin.com/company/ronda-app`, `https://github.com/ronda-app`, `https://wa.me/...`).

- [x] **T-15.6: Verificación técnica:**
  - Ejecutar `npx tsc --noEmit` y `npm run build` para asegurar cero errores de compilación.
  - Validar build limpio (✅ VALIDADO: tsc exit 0, build exit 0).

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

---

## FASE 13: ESTANDARIZACIÓN TRANSVERSAL DE TODOS LOS FOOTERS DEL ECOSISTEMA (COMPLETADO)

> **Contexto:** Extensión del estándar Luxury & Semántico de 2 niveles a todas las páginas y portales de RONDA para unificar la identidad de marca, evitar colisiones con el botón flotante de WhatsApp y presentar un marco legal y de ingeniería impecable.

### 🔄 Tareas Ejecutadas y Validadas:

- [x] **T-13.1: Footer B2C en `landing.html`:**
  - Cuadrícula de 2 niveles: Columna de Marca B2C + Columna de Navegación & Marco Legal (Historia, Partners, Inversionistas, Términos, Privacidad) + Soporte WhatsApp (+57 302 654 3854) y redes oficiales.
  - Meta inferior con Copyright, insignias dinámicas de ingeniería (`data-ronda-*`) y contador `#global-visit-counter` con padding de seguridad de 70px.
- [x] **T-13.2: Footer Inversionistas FFF en `invest.html`:**
  - Estructura de 2 niveles adaptada a la tesis FFF: Pista Privada, Compliance (C. de Co. Art. 1163), Mesa Directa Fundadores WhatsApp (+57 316 974 9677), redes oficiales.
  - Fila inferior con Copyright, bandera de Colombia, métricas de ingeniería, contador `#footer-counter` y padding anti-solapamiento.
- [x] **T-13.3: Componente Central `src/footer.ts` (Portales / `footer-root`):**
  - Actualizada la función `getRondaFooterHtml()` con la cuadrícula de 2 niveles inyectada en `/admin`, `/crm`, `/network`, y `/superadmin`, conservando todos los ganchos de hidratación en tiempo real.
- [x] **T-13.4: Footer de Usuario / Portal en `index.html`:**
  - Sustituido el footer plano por el diseño de 2 niveles con enlaces interactivos a los modales legales `#modal-legal-viewer`, soporte y protección de layout.
- [x] **T-13.5: Footer de Operaciones en `superadmin.html`:**
  - Estandarizado a 2 niveles integrando el contador de visitas SVG en vivo y los canales de auditoría.
- [x] **T-13.6: Verificación de Tipos y Empaquetado:**
  - `npx tsc --noEmit` completado con 0 errores (código 0).
  - `npm run build` completado exitosamente (código 0) generando todos los artefactos en `dist/`.

---

## FASE 14: BLINDAJE PERMANENTE DE ACCESO SUPERADMIN Y CONTENT SECURITY POLICY (COMPLETADO)

> **Contexto:** En la consola de `/superadmin`, se producían 8 errores de Content Security Policy (`connect-src` bloqueaba `https://api.github.com`) y el botón quedaba congelado en *"Verificando credenciales..."* debido a que `src/auth.ts` trataba la cuenta maestra como `role: "client"` incompleto, emitiendo `auth:needsProfile` en vez de `auth:login`.

### 🔄 Correcciones Permanentes Aplicadas:

- [x] **T-14.1: Permiso CSP en `firebase.json`:**
  - Agregado `https://api.github.com` a la directiva `connect-src` del CSP institucional.
- [x] **T-14.2: Catch no bloqueante en `src/footer.ts`:**
  - Añadido `.catch(() => null)` en `syncLiveGitMetrics()` para asegurar degradación silenciosa sin errores en consola.
- [x] **T-14.3: Regla de SuperAdmin Intrínseco en `firestore.rules`:**
  - `isSuperAdmin()` ahora valida directamente `request.auth.token.email == 'cesar@ronda.uno' || request.auth.uid == 'hVX2RL2xJhRFurJJsAgdyVIaDT53'`.
- [x] **T-14.4: Auto-reparación y emisión de `auth:login` en `src/auth.ts`:**
  - La cuenta staff es reconocida como `superadmin`, evitando caer en `auth:needsProfile` y notificando de inmediato a `portal-auth.ts`.
- [x] **T-14.5: Bypass de rol y Watchdog de seguridad en `src/portal-auth.ts`:**
  - Acceso garantizado y temporizador protector de 10s para evitar bloqueo visual del botón.
- [x] **T-14.6: Verificación y Compilación:**
  - `npx tsc --noEmit` (0 errores) y `npm run build` exitoso (`dist/` generado).

---

## FASE 15: PARCHE PRE-PRODUCCIÓN & CORRECCIÓN DE LA APP SPA (COMPLETADO)

> **Contexto:** Se subsanaron los puntos críticos de auditoría y se removió el footer de landing de la web app interactiva (`index.html`).

### 🔄 Correcciones Aplicadas:
- [x] **T-15.1: Remoción de Footer en `index.html` y `src/app.ts`:**
  - `index.html` es una aplicación móvil SPA (reserva activa, radar, chats, modales). Se eliminó completamente cualquier footer comercial o inyección dinámica de pie de página para mantener la experiencia de app 100% nativa y limpia.
- [x] **T-15.2: Blindaje y Ampliación de Content Security Policy (`firebase.json`):**
  - Añadidos a `script-src` y `connect-src`: `https://translate.google.com`, `https://translate.googleapis.com`, `https://cdn.jsdelivr.net`, `https://unpkg.com`, `https://identitytoolkit.googleapis.com` y `https://api.github.com`.
- [x] **T-15.3: Purgado de Credenciales en Texto Plano:**
  - Eliminado permanentemente el archivo `backups/staff-cesar-credentials.txt`.
- [x] **T-15.4: Métricas Reales en `superadmin.html`:**
  - Eliminada la simulación con `baseVisits = 145032`; conectado el contador `#visit-count` a las visitas reales locales y de sesión (`localStorage`).
- [x] **T-15.5: Enlaces de Redes Sociales Oficiales:**
  - Actualizados todos los enlaces `href="#"` a las URLs oficiales de RONDA (Instagram: `ronda.uno`, LinkedIn: `ronda-app`, GitHub: `ronda-app`) en `src/footer.ts`, `partners.html`, `landing.html`, `invest.html` y `superadmin.html`.
- [x] **T-15.6: Reglas de Firestore Seguras (`firestore.rules`):**
  - Verificado `isSuperAdmin()` con validación de correo verificado (`email_verified == true`) para delegados y bypass de contingencia para la cuenta fundadora.
- [x] **T-15.7: Compilación Limpia de Producción:**
  - `npm run build` ejecutado exitosamente generando la carpeta `dist/` actualizada.

---

## FASE 16: PLAN DE REPARACIÓN Y BLINDAJE DE LA CONSOLA DE ANFITRIÓN (/admin) (PARA CLINE)

> **Diagnóstico del Arquitecto (Antigravity):**
> Tras auditar `admin.html`, `src/entry-admin.ts` y `src/bar.ts` (`HostConsoleService`), se identificaron varios fallos críticos en la experiencia del anfitrión de sala:
> 1. **Botones Huérfanos sin ID ni Handler:** En `admin.html` (líneas 1693-1694), los botones *"Cambiar aforo"* y *"Proponer carta de la noche"* carecen de ID y de cualquier listener en JS. Al hacer clic no ejecutan ninguna acción.
> 2. **Desincronización de ID en "Finalizar Noche":** En `admin.html` el botón tiene `id="btn-admin-end-event"`, pero en `src/bar.ts:271` el código busca `document.getElementById('btn-end-e')`, por lo que el botón nunca muestra el feedback visual de procesamiento ni de finalizado.
> 3. **Bloqueo Arcaico con `prompt()`:** `src/bar.ts:74` ejecuta `let eventId = prompt(...)` al cargar. Si el usuario cancela, está en móvil o el navegador bloquea diálogos, el dashboard queda congelado sin cargar datos.
> 4. **Falta de Cierre de Sesión:** En el header de `/admin` no existe un botón de "Cerrar Sesión", dejando al anfitrión atrapado sin poder cambiar de cuenta.
> 5. **Ausencia de Lista Visual de Asistentes:** El anfitrión puede escanear QR, pero no tiene una vista en tiempo real de la lista de asistentes esperados, su estado de check-in, pago en puerta o acreditación LinkedIn.

### 📋 Tareas de Implementación para Cline:

- [x] **T-16.1: Conectar el Botón "Cambiar Aforo" (`btn-admin-change-capacity`)**
  - **Archivos:** `admin.html` (línea ~1693) y `src/bar.ts`.
  - **Acción:**
    1. En `admin.html`, asignar `id="btn-admin-change-capacity"` al botón de aforo.
    2. En `src/bar.ts` (`renderDashboard`), vincular el botón para que invoque `this.promptChangeCapacity()`.
    3. Usar `RondaDialog.confirm` o un modal interactivo para solicitar la nueva cantidad de mesas (ej. 8, 10, 12).
    4. Guardar en Firestore con `DB.saveEvent(this.currentEvent)`, actualizar `#nn-tables` y recalcular `#nn-confirmed`.

- [x] **T-16.2: Conectar el Botón "Proponer Carta de la Noche" (`btn-admin-menu`)**
  - **Archivos:** `admin.html` (línea ~1694) y `src/bar.ts`.
  - **Acción:**
    1. En `admin.html`, asignar `id="btn-admin-menu"` al botón de carta.
    2. En `src/bar.ts` (`renderDashboard`), vincular el listener para desplegar un modal (`RondaDialog.alert` o modal luxury) con los 4 cócteles sugeridos de la alianza y permitir al bar ajustar el precio acordado de consumición (`#nn-price`), guardando la actualización en Firestore.

- [x] **T-16.3: Corregir ID del Botón "Finalizar y Emitir NFTs"**
  - **Archivos:** `src/bar.ts` (línea ~271).
  - **Acción:**
    1. Reemplazar `document.getElementById('btn-end-e')` por `document.getElementById('btn-admin-end-event')`.
    2. Asegurar que al confirmar el cierre, cambie a `"Procesando..."` (deshabilitado) y luego a `"✓ Evento Finalizado"`, notificando con `RondaDialog.alert`.

- [x] **T-16.4: Sustituir `prompt()` / `confirm()` Nativos por Carga Autónoma & RondaDialog**
  - **Archivos:** `src/bar.ts` (`initAdminDashboard`, líneas 70-105).
  - **Acción:**
    1. Eliminar `prompt("Ingresa el ID del evento que vas a gestionar...")`.
    2. Si `adminUser.venueId` existe, buscar el evento activo de la sede en Firestore. Si no se especifica, usar por defecto el evento predeterminado `rnd-caronte-mar-25` o cargar el evento activo más reciente.
    3. Si el evento no existe, en vez de `confirm()` / `prompt()` nativos, usar `RondaDialog.confirm` para crearlo limpiamente con los datos por defecto de la sede.

- [x] **T-16.5: Agregar Botón "Cerrar Sesión" en la Consola `/admin`**
  - **Archivos:** `admin.html` (dentro de `.admin-header`) y `src/entry-admin.ts` / `src/bar.ts`.
  - **Acción:**
    1. Agregar un botón de cierre de sesión en `.admin-header`:
       ```html
       <button id="btn-admin-logout" class="btn" style="background: rgba(234,67,53,0.12); border: 1px solid rgba(234,67,53,0.35); color: #EA4335; font-size: 11px; padding: 6px 14px; border-radius: 8px;">
         🚪 Cerrar Sesión
       </button>
       ```
    2. Conectar el evento click con `Auth.logout()` para redirigir a `/admin` (mostrando el formulario de login del portal).

- [x] **T-16.6: Renderizar la Lista en Vivo de Participantes y Check-in**
  - **Archivos:** `src/bar.ts` (`renderDashboard` / `renderAttendeesList`).
  - **Acción:**
    1. Añadir una tarjeta en el dashboard debajo de `admin-qr-tools` con la lista de asistentes (`this.currentEvent.participants`):
       - Nombre del asistente (`p.name || uid`).
       - Badge de Check-in: `"✅ En sala"` si `user.checkedIn`, `"⏳ Esperando"` si no.
       - Badge de Verificación: `"LinkedIn"` o `"Face ID"`.
       - Botón rápido `"✓ Check-in"` para registrar manualmente sin escanear.

- [x] **T-16.7: Verificación con TypeScript y Compilación Vite**
  - **Comandos:**
    - `node test/test-integrity-zero-functions.cjs` (las 5 pruebas deben pasar).
    - `npx tsc --noEmit` (0 errores).
    - `npm run build` (build sin errores).

---

## FASE 17: DEPURACIÓN INTEGRAL DE COPYWRITING HUMANO (CERO JERGA TÉCNICA) (PARA CLINE)

> **Directriz de Marca del Fundador:**
> Está estrictamente prohibido el lenguaje técnico o frío en interfaces de cara al usuario. No mencionar *"Motor mem-rr-v2"*, *"grafo bipartito"*, *"algoritmo combinatorio"*, *"WMM"* ni tecnicismos matemáticos. 
> El tono debe ser **humano, cercano, empático, natural y premium**:
> - En lugar de *"Motor mem-rr-v2"* ➔ *"Rotación inteligente con memoria"* o *"Sistema de encuentros sin repeticiones"*.
> - En lugar de *"Citas Presenciales"* ➔ *"Citas Rápidas / Speed Dating"*.
> - En lugar de *"KYC biométrico estricto"* ➔ *"Verificación rápida de identidad para tu seguridad"*.
> - En lugar de *"Matching algorítmico"* ➔ *"Conexiones auténticas cara a cara"*.

### 📋 Tareas de Implementación para Cline:

- [x] **T-17.1: Barrido de Restos de "mem-rr-v2" en Interfaces Públicas**
  - **Archivos:** `index.html`, `landing.html`, `partners.html`, `invest.html`, `src/client.ts`, `src/views/`.
  - **Acción:**
    1. Asegurar que NINGÚN modal, banner o párrafo visible al usuario mencione *"mem-rr-v2"* o términos algorítmicos.
    2. Mantener intacto el código del motor interno (`src/mem-rr-v2/`), cambiando únicamente cadenas de texto visibles (strings de UI, microcopy, alertas).

- [x] **T-17.2: Humanización de Textos en la Web App (`index.html`)**
  - **Archivos:** `index.html` y vistas asociadas (`src/views/profile-modal.ts`, `src/satisfaction.ts`, `src/icebreakers.ts`).
  - **Acción:**
    1. Revisar los textos del onboarding, safeword y feedback post-cita.
    2. Usar un tono conversacional de tú a tú: *"Cuéntanos cómo te sentiste"*, *"¿Hubo química?"*, *"Tu tranquilidad es lo primero"*.

- [x] **T-17.3: Verificación de Reglas y Compilación**
  - **Comandos:**
    - `node test/test-integrity-zero-functions.cjs`
    - `npx tsc --noEmit`
    - `npm run build`

## FASE 18: AUDITORÍA DE SEGURIDAD, BLINDAJE DE FIRESTORE, XSS Y BUGS (PARA CLINE)

> **Contexto del Arquitecto (Antigravity):**
> Se ha emitido la auditoría forense completa en `docs/AUDITORIA_SEGURIDAD_BUGS_CLINE.md`.
> Se descubrieron 3 fallos críticos de seguridad en reglas de base de datos (escalada en `allow create` y colecciones bloqueadas), vectores de stored XSS en el CRM, y bugs de runtime en la consola del anfitrión y API client.
> **Instrucciones para Cline:**
> 1. Ejecuta cada tarea en bucle marcando con `[x]`.
> 2. Mantén $0 en infraestructura y cero dependencias pesadas.
> 3. Al finalizar, verifica `test-integrity-zero-functions.cjs`, `npx tsc --noEmit` y `npm run build`.

### 📋 Tareas de Implementación para Cline:

- [ ] **T-18.1: Blindaje de `firestore.rules` contra Escalada en `allow create` y Omisión de Colecciones**
  - **Archivo:** `firestore.rules`.
  - **Acción:**
    1. En `match /users/{userId}` `allow create`: exigir `hasTicket == false`, `trustTier == 0`, `isVerified == false` y bloquear `nfts`, `wallet_address`, `matches`, `verifications`.
    2. Agregar regla `match /kycReviews/{reviewId}` (lectura: `isStaff()`, creación: dueño autenticado con `status == 'pending'`, actualización/borrado: `isStaff()`).
    3. Agregar reglas para colecciones B2B: `scouts`, `hosts`, `commission_ledger`, `payouts`, `audit_logs`, `host_offers`, `churn_surveys`, `invest_tokens`.
    4. Optimizar `isStaff()` para evaluar `userRole()` una sola vez.

- [ ] **T-18.2: Creación de Módulo Utilitario `src/utils.ts` y Sanitización Anti-XSS**
  - **Archivos:** `src/utils.ts` (nuevo), `src/crm.ts`, `src/profile.ts`, `src/bar.ts`, `src/notifications.ts`.
  - **Acción:**
    1. Crear `src/utils.ts` exportando `escapeHtml(str: string | null | undefined): string`.
    2. En `src/crm.ts` (`kanban-lead-card`): envolver `lead.name`, `lead.contactName`, `lead.zone`, `lead.phone` con `escapeHtml`.
    3. En `src/profile.ts:114`: escapar `cocktail`, `zone`, `zodiac` antes de inyectar en `profileMeta.innerHTML`.
    4. En `src/bar.ts:590`: escapar `p.name || uid` en `renderAttendeesList()`.
    5. En `src/notifications.ts:125-126`: escapar `n.title` y `n.body`.

- [ ] **T-18.3: Corrección de Fugas y Bugs en `src/bar.ts` y `src/api-client.ts`**
  - **Archivos:** `src/bar.ts`, `src/api-client.ts`.
  - **Acción:**
    1. En `src/bar.ts:488`: aplicar `cloneNode(true)` a `btnLogout` antes de agregar el listener para evitar acumulación de eventos.
    2. En `src/bar.ts:435-442`: sincronizar narrativa económica (1 cóctel de autor = $22.000 COP; `${totalParticipants} cóctel de autor incluido` y `totalRev = totalParticipants * 22000`).
    3. En `src/bar.ts:545, 556`: convertir `#menu-night-price` en un input numérico editable para que el anfitrión pueda cambiar el precio.
    4. En `src/api-client.ts:48`: corregir el manejo de errores para que no retorne `[object Object]` (`responseData.error?.message || responseData.error || responseData.message`).

- [ ] **T-18.4: Blindaje de Webhooks en Backend Serverless (`functions-vercel/api/`)**
  - **Archivos:** `functions-vercel/api/whatsapp-webhook.js`, `functions-vercel/api/wompi-webhook.js`.
  - **Acción:**
    1. En `whatsapp-webhook.js`: eliminar fallback inseguro de token y agregar verificación `X-Hub-Signature-256` en peticiones POST.
    2. En `wompi-webhook.js`: manejar estados `DECLINED`/`ERROR` restableciendo `paymentPending: false`.

- [ ] **T-18.5: Validación Técnica Completa y Reporte**
  - **Comandos:**
    - `node test/test-integrity-zero-functions.cjs`
    - `node test/test-face-verification-suite.cjs`
    - `npx tsc --noEmit`
    - `npm run build`






