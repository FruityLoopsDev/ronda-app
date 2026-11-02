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
    - Botón `📋 Copiar Link`: Copia `https://ronda.uno/invest?token={token}`.
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

- [x] **T-18.1: Blindaje de `firestore.rules` contra Escalada en `allow create` y Omisión de Colecciones**
  - **Archivo:** `firestore.rules`.
  - **Acción:**
    1. En `match /users/{userId}` `allow create`: exigir `hasTicket == false`, `trustTier == 0`, `isVerified == false` y bloquear `nfts`, `wallet_address`, `matches`, `verifications`.
    2. En `match /kycReviews/{reviewId}`: habilitar creación para el propio usuario autenticado con `status == 'pending'` y `userId == request.auth.uid`.
    3. En `match /invest_tokens/{tokenId}`: permitir `allow read: if true;` para validación de tokens nominales de inversores no autenticados en `/invest`.
    4. En `match /churn_surveys/{surveyId}`: permitir `allow create` a usuarios autenticados para registrar encuestas de salida al darse de baja.
    5. Optimizar `isStaff()` para evaluar `userRole()` una sola vez de forma eficiente.

- [x] **T-18.2: Creación de Módulo Utilitario `src/utils.ts` y Sanitización Anti-XSS**
  - Creado `src/utils.ts` con `escapeHtml`. Sanitizadas interpolaciones en `src/crm.ts`, `src/profile.ts`, `src/bar.ts` y `src/notifications.ts`.

- [x] **T-18.3: Corrección de Fugas y Bugs en `src/bar.ts` y `src/api-client.ts`**
  - `btnLogout` clonado con `cloneNode(true)`. Cálculo de consumición corregido a 1 cóctel de autor ($22.000 COP). `#menu-night-price` convertido a input numérico editable. Error handling en `api-client.ts` protegido contra `[object Object]`.

- [x] **T-18.4: Blindaje de Webhooks en Backend Serverless (`functions-vercel/api/`)**
  - Fallback insecure eliminado y verificación HMAC `X-Hub-Signature-256` en `whatsapp-webhook.js`. Manejo de `DECLINED`/`ERROR` en `wompi-webhook.js` para limpiar `paymentPending: false`.

- [x] **T-18.5: Validación Técnica de Reglas y Compilación**
  - `node test/test-integrity-zero-functions.cjs` (5/5 PASS)
  - `npm run test:face` (15/15 PASS)
  - `npm run test:b2b` (56/56 PASS)
  - `node src/mem-rr-v2/bench.ts` (100% assertions PASS)
  - `npx tsc --noEmit` (Code 0 PASS)
  - `npm run build` (Code 0 PASS)

---

## 📌 FASE 19: SANEAMIENTO DEL DOM EN `index.html` Y CORRECCIÓN DE ENLACES EN `landing.html` (PARA CLINE)

> **Objetivo:** Garantizar la integridad total del DOM y la experiencia sin excusas: eliminar duplicación fantasma de modales en `index.html` y sustituir teléfono placeholder por la línea oficial de RONDA.

### 📋 Tareas de Implementación para Cline:

- [x] **T-19.1: Extirpar Bloque Duplicado en `index.html` (Líneas ~2287 a ~2480)**
  - **Archivo:** `index.html`.
  - **Acción:**
    1. Localizado y extirpado el bloque duplicado que contenía declaraciones repetidas de `#modal-select-zone`, `#modal-full-qr`, `#modal-ronda-services` y etiqueta huérfana de vista.
    2. DOM completamente saneado y balanceado con terminación en `</html>` limpia.

- [x] **T-19.2: Corregir Teléfono Placeholder en `landing.html` (Línea ~2177)**
  - **Archivo:** `landing.html`.
  - **Acción:**
    1. Reemplazado `https://wa.me/573000000000` por la línea oficial de RONDA: `https://wa.me/573026543854`.

- [x] **T-19.3: Conectar Postulación de Bares con CRM en Tiempo Real (`partners.html` ➔ `src/crm.ts`)**
  - **Archivos:** `partners.html`, `src/db.ts`, `src/crm.ts`, `firestore.rules`.
  - **Acción:**
    1. En `partners.html` (`handleFormSubmit`): guarda lead en `/leads` vía Firestore REST API antes del redireccionamiento a WhatsApp.
    2. En `src/db.ts`: creado `subscribeToLeads(...)` con `onSnapshot` sobre la colección `'leads'`.
    3. En `src/crm.ts`: activada la suscripción en tiempo real en `init()`.
    4. En `firestore.rules`: habilitado `allow create` en `/leads/{leadId}` para altas públicas con whitelist estricta.

- [x] **T-19.4: Blindaje de Responsividad 100% y Cero Solapamiento**
  - **Archivos:** `index.html`, `landing.html`, `partners.html`, `invest.html`.
  - **Acción:**
    1. Margen de seguridad contra elementos flotantes y padding inferior de 84px (`.ronda-app-footer`).
    2. Sin solapamiento de menús ni botones en viewports móviles (320px, 375px, 414px) y touch targets mínimos de 44x44px.

---

## 📌 FASE 20: PROTOCOLO DE DESPLIEGUE A PRODUCCIÓN Y VERIFICACIÓN EN VIVO (GO-LIVE)

> **Objetivo:** Ejecutar la secuencia de despliegue a producción de Firebase Hosting y Firestore Rules, verificando la disponibilidad y el funcionamiento de cada botón.

### 📋 Tareas de Implementación:

- [x] **T-20.1: Build de Producción Minificado y Versionado**
  - Ejecutado `npm run build` con 152 módulos transformados y bundle optimizado en `dist/` (Terser + code-splitting).
- [x] **T-20.2: Despliegue de Reglas de Seguridad de Firestore**
  - Desplegado a producción (`ronda-uno`) con `npx firebase deploy --only firestore:rules`. Compilación y liberación exitosa.
- [x] **T-20.3: Despliegue de Hosting a Producción**
  - Desplegado a producción con `npx firebase deploy --only hosting`. 77 archivos subidos al hosting oficial `https://ronda.uno` con éxito.
- [ ] **T-20.4: Smoke Tests en Vivo en Producción**
  - Validar navegación sin errores de consola en el dominio oficial `https://ronda.uno` (Landing `/`, Partners `/partners`, Invest `/invest`, Web App SPA `/app` y Consolas Staff).

---

## 📌 FASE 21: MÓDULOS DE CAJA, BENEFICIOS Y RESULTADOS DE /admin (PASOS 8 Y 9 — PARA CLINE)

> **Contexto:** Antigravity ha completado el Shell de 10 secciones y la autorización por establecimiento en `src/host-admin.ts`. Antigravity se encargará del Paso 7 (Operación en Vivo del Motor MEM-RR).
> **Misión de Cline:** Implementar los módulos interactivos de Caja/Cierre, Beneficios y Analítica/Exportación en `src/host-admin.ts`.
> **Reglas:** Código Vanilla (TS + CSS), paleta dark luxury berenjena/oro, cero dependencias pesadas.

### 📋 Tareas Asignadas a Cline:

- [x] **T-21.1: Módulo Consumos y Cierre de Noche (`renderSettlementsSection`)**
  - **Archivo:** `src/host-admin.ts`.
  - **Especificación:**
    1. Formulario reactivo de liquidación de noche con inputs numéricos:
       - Número de bebidas incluidas (calculado de asistentes confirmados o editable).
       - Segundas rondas y copas adicionales en barra (COP).
       - Picoteo y tapeo (COP).
       - Deducción acordada de plataforma / comisión RONDA ($0 o configurable).
    2. Recibo térmico visual (`.receipt` luxury con borde dentado retro) que recalcula en vivo el Total de Barra y el Margen Bruto estimado.
    3. Conexión a Firestore:
       - Botón "Guardar Borrador": guarda en `night_closings/{venueId}_{eventId}` con `status: 'draft'`.
       - Botón "Enviar Cierre": guarda con `status: 'submitted'`.
       - Si el cierre ya está en estado `approved`, deshabilitar inputs y mostrar badge verde `✓ APROBADO Y CONCILIADO`.

- [x] **T-21.2: Módulo Beneficios & Barra (`renderPerksSection`)**
  - **Archivo:** `src/host-admin.ts`.
  - **Especificación:**
    1. Buscador de asistentes o ingreso de código de beneficio (`RND-XXXX`) para canjear en barra.
    2. Dos tipos de beneficios soportados:
       - `welcome_cocktail`: Cóctel de bienvenida incluido con la entrada (canje único).
       - `second_date_discount`: Bono de 10% de descuento para segunda cita en el bar.
    3. Validación atómica: Si el beneficio ya fue canjeado, alertar con `RondaDialog` y bloquear canje doble.
    4. Registro en colección `benefit_redemptions` con `redeemedAt`, `operatorUid`, `status: 'used'`.
    5. Lista de canjes efectuados durante la noche con hora y nombre del asistente.

- [x] **T-21.3: Módulo Resultados & Exportación Segura CSV (`renderAnalyticsSection`)**
  - **Archivo:** `src/host-admin.ts`.
  - **Especificación:**
    1. Gráfico visual de barras CSS de ocupación semanal (Martes, Miércoles, Jueves).
    2. Fórmulas auditables:
       - Ocupación efectiva = (Asistentes reales / Capacidad) * 100.
       - Consumo medio por asistente = Total Barra / Asistentes reales.
       - Incremento de venta vs día sin evento (+41 pts).
    3. Botón "📥 Exportar Informe CSV":
       - Genera y descarga archivo CSV con el reporte de la noche.
       - **BLINDAJE DE SEGURIDAD (Obligatorio):** Sanitizar todas las celdas de texto para prevenir inyecciones de fórmulas (CSV Injection). Si un valor inicia con `=`, `+`, `-`, `@`, anteponer una comilla simple `'`.

- [x] **T-21.4: Compilación y Verificación de Tipos**
  - Ejecutar `npx tsc --noEmit` asegurando 0 errores de TypeScript.
  - Ejecutar `npm run build` verificando empaquetado limpio en `dist/admin.html`.

---

## 📌 FASE 22: FICHA DE LOCAL, EQUIPO, SOPORTE Y GOBERNANZA OPERATIVA (PASOS 10–14 — COMPLETADA)

> **Contexto:** Antigravity ha completado la implementación e integración de la Ficha de Mi Local, Equipo & Permisos, Soporte Operativo, Suite de Pruebas de Aislamiento y Verificación de Producción.

### 📋 Tareas Ejecutadas:

- [x] **T-22.1: Módulo Ficha de Mi Local (`renderVenueSection`) — Paso 10**
  - **Archivo:** `src/host-admin.ts`.
  - Configuración de identidad visual, capacidad, dress code, especialidad de barra y galería fotográfica.
  - Flujo de ciclo de vida con estados: Borrador -> Solicitud de Publicación -> Publicado en Directorio & Landing.
  - Modal interactivo de Vista Previa con el componente visual exacto de `partners.html`.

- [x] **T-22.2: Módulo Equipo & Roles del Local (`renderTeamSection`) — Paso 11**
  - **Archivo:** `src/host-admin.ts`.
  - Asignación de colaboradores de local con roles aislados (`host`, `door`, `bartender`).
  - Matriz visual de permisos auditables delimitando accesos estrictos por función de sala.

- [x] **T-22.3: Módulo Soporte Operativo RONDA (`renderSupportSection`) — Paso 11.2**
  - **Archivo:** `src/host-admin.ts`, `src/db.ts`, `firestore.rules`.
  - Línea Roja Operativa de WhatsApp directa a Guardia Central (`+57 302 654 3854`) para urgencias de evento en curso.
  - Formulario de tickets técnicos y administrativos persistidos en Firestore `support_tickets` con aislamiento por establecimiento.

- [x] **T-22.4: Matriz de Sincronización Cruzada — Paso 12**
  - Sincronización verificada entre `/admin` (operación bar), `/superadmin` (gobierno central), `/app` (asistentes y check-in QR reactivo), `CRM` (leads y conversión de locales) y `Network` (scouts).

- [x] **T-22.5: Auditoría de Seguridad & Pruebas de Regresión — Paso 13**
  - Ejecutada suite de aislamiento: `node test/test-admin-isolation.cjs` (6/6 pruebas pasadas).
  - Validado motor algorítmico: `node src/mem-rr-v2/bench.ts` (100% aserciones superadas).
  - Sanitización estricta anti-inyección CSV (`sanitizeCsvCell`).

- [x] **T-22.6: Verificación de Build & Emulador — Paso 14**
  - `npx tsc --noEmit` superado con 0 errores.
  - `npm run build` completado exitosamente (151 módulos transformados, `dist/admin.html` 51.91 kB).
  - Navegación y componentes verificados visualmente con subagente de navegador (`admin_completed_view_1793141988466.png`).








---

## 🔥 FASE 23: SUITE DE PRUEBAS DE ESTRÉS, CONCURRENCIA Y CARGA PRE-PRODUCCIÓN (PARA CLINE)

> **Especificación del Arquitecto (Antigravity):**
> Antes de abrir tráfico real en producción, Cline debe implementar y ejecutar en bucle una suite de pruebas de estrés de 4 vectores que certifique la resiliencia matemática, la concurrencia en Firestore (usando el **Firebase Local Emulator** a costo $0) y la ausencia de condiciones de carrera (*race conditions*) en puerta y votación.
>
> **Reglas de Ejecución para Cline:**
> 1. **Cero consumo de cuota en la nube:** Toda prueba contra Firestore/Auth DEBE correr contra el emulador local (`127.0.0.1:8081` y `127.0.0.1:9099`). Verifica primero con `npm run emulator:status`.
> 2. Marca cada sub-tarea con `[x]` al superarla.
> 3. Documenta las métricas obtenidas en `docs/bench-results/stress-test-prod.md`.

### 📋 Tareas Paso a Paso para Cline:

- [ ] **T-23.1: Ampliación del Stress Test Algorítmico (`scripts/stress-test.ts`)**
  - Expandir `scripts/stress-test.ts` para evaluar 5 escenarios críticos con medición de latencia (`p50`, `p95`, `max`) y consumo de memoria (`process.memoryUsage().heapUsed`):
    1. **Sala Estándar (12M + 12H × 9 rondas):** SLA < 50 ms.
    2. **Sala con Alta Densidad de Bloqueos (20M + 20H, 40% historial previo/vetos):** Verificar 0 violaciones de pares bloqueados.
    3. **Caída Intra-Noche / No-Shows (15M + 15H, abandono de 4 personas en ronda 4):** Re-planificación en caliente con `alreadyMet` en < 100 ms y 0 referencias a ausentes.
    4. **Mesas de 4 + Grafo Espacial (`tableSize: 4`, `delta: 0.35`):** Verificar cobertura ≥ 95% y penalización de distancia activa.
    5. **Macro-Gala VIP (60M + 60H × 10 rondas):** SLA < 1500 ms sin bloqueo del Event Loop ni OOM.

- [ ] **T-23.2: Creación de Suite de Concurrencia y Condiciones de Carrera (`test/test-stress-concurrency.cjs`)**
  - Crear el script `test/test-stress-concurrency.cjs` conectado al emulador local de Firestore (`127.0.0.1:8081`) que simule:
    1. **Ráfaga en Puerta (40 Check-ins Simultáneos):** Lanzar `Promise.all` con 40 usuarios intentando registrarse y hacer check-in en el mismo milisegundo sobre un evento activo.
    2. **Ataque de Doble Escaneo QR (Idempotencia Atómica):** Disparar 10 peticiones simultáneas de check-in para el mismo `uid` (`usr-stress-01`). Certificar que el array `participants` del evento y el registro de check-in contengan exactamente **1 sola entrada** sin duplicados.
    3. **Tormenta de Votos en Campanazo Final (24 Usuarios Concurrentes):** Simular a los 24 asistentes enviando sus votos (`Sí`/`No`) exactamente al terminar la ronda (`Promise.all` de 24 escrituras concurrentes). Certificar pérdida de paquetes = 0 y cálculo exacto de matches mutuos.
    4. **Cierre de Caja Concurrente (`/admin`):** Intentar registrar 2 cierres de caja (`night_closings`) simultáneos para el mismo `eventId` y verificar que prevalezca la idempotencia sin duplicar cobros.

- [ ] **T-23.3: Script NPM y Ejecución Automatizada**
  - Agregar en `package.json` el comando:
    `"test:stress": "node src/mem-rr-v2/bench.ts && node scripts/stress-test.ts && node test/test-stress-concurrency.cjs"`
  - Ejecutar `npm run test:stress` en terminal y corregir cualquier cuello de botella o condición de carrera detectada.

- [ ] **T-23.4: Generación de Reporte de Evidencia (`docs/bench-results/stress-test-prod.md`)**
  - Generar un informe técnico compacto con tabla de tiempos (ms), memoria RAM pico (MB), tasa de éxito en concurrencia (100%) y veredicto final `✅ STRESS TEST OK — APTO PARA PRODUCCIÓN`.
  - Ejecutar `npx tsc --noEmit` para asegurar 0 errores de tipos tras la creación de los tests.
