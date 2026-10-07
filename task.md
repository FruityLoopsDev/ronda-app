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
- [ ] **T-1: Loop de Validación de Video Activo:**
  En `src/verification.ts` (`startVerification`), reemplazar el `setTimeout(600)` por un wait activo que verifique `videoEl.readyState >= 2 && videoEl.videoWidth > 0`.
- [ ] **T-2: Timeout & Fallback en Tesseract OCR:**
  En `src/verification.ts` (`scanDocumentOCR`), agregar un timeout de 8 segundos. Si expira o falla la red, retornar `{ success: false, rawText: '', hits: [], error: 'ocr_timeout' }` sin interrumpir la extracción del rostro del documento.
- [ ] **T-3: Degradación Limpia a Revisión Manual:**
  Asegurar que ante cualquier duda de coincidencia o falla leve de OCR, el usuario reciba el feedback de "Enviado a revisión manual" (`kycReviews`) y no un bloqueo con error rojo.
- [ ] **T-4: Ejecución y Validación de Suite:**
  Ejecutar `npm run test:face` y verificar que pase 15/15.
- [ ] **T-5: Comprobación de Build:**
  Ejecutar `npm run build` para asegurar cero regresiones en TypeScript y en el bundle final.

## FASE 6: INCENTIVO Y BADGE "CLUB FUNDADOR 100" (PARA CLINE - EJECUTOR AUTÓNOMO)
> **Especificación del Arquitecto (Antigravity):**
> Implementar el programa de captación de los primeros 100 usuarios ("Club Fundador 100") para incentivar el registro temprano, el balance 50/50 y la viralidad por referidos.

### Tareas para Cline:
- [ ] **T-6.1: Asignación de Badge en Registro:**
  En `src/auth.ts` (al crear perfil de usuario), contar los usuarios existentes o verificar `usersCount < 100`. Si cumple, asignar en el perfil del usuario: `isFoundingMember: true` y `founderNumber: count + 1`.
- [ ] **T-6.2: Insignia Dorada en Modal de Perfil:**
  En `src/views/profile-modal.ts` y `src/profile.ts`, si `user.isFoundingMember` es `true`, renderizar en la parte superior del perfil el badge visual:
  `<span class="badge-founder">⭐ Miembro Fundador #${user.founderNumber || 1}</span>` con estilo dorado (`var(--luz)` / `#F0A830`).
- [ ] **T-6.3: Banner / Contador en Landing:**
  En `landing.html`, añadir un chip/banner informativo en la cabecera del héroe o formulario:
  `🏆 Beneficios del Club Fundador 100: Insignia Dorada + Prioridad de Cupo + 1er Cóctel de Cortesía`.
- [ ] **T-6.4: Validación de Build:**
  Ejecutar `npm run build` para garantizar cero errores de TypeScript o empaquetado.


