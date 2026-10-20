# 📜 HISTORIAL DE INTERACCIONES Y REGISTRO DE DECISIONES (RONDA)

> **Propósito:** Este documento mantiene la continuidad contextual entre distintas sesiones y chats con los Agentes de IA (Antigravity, Cline, etc.). Se actualiza con las interacciones claves, decisiones de arquitectura, hitos alcanzados y pendientes del proyecto.
> 
> **Protocolo de Lectura/Escritura para Agentes:**
> 1. **Al iniciar un chat:** Leer este archivo junto a `AGENTS.md` y `docs/index.md`.
> 2. **Al finalizar un hito o cambio clave:** Registrar la interacción en la sección "Registro Histórico de Interacciones".

---

## 📌 Estado Actual del Proyecto (Resumen Ejecutivo)
- **Versión Actual:** v2.3.1 (Fase de Remedición y Blindaje de Due Diligence).
- **Stack Tecnológico:** Vanilla TypeScript + Vite (SPA) · Firebase Auth/Firestore · Vercel Serverless (APIs/Webhooks) · Motor `mem-rr-v2` (DP + WMM + Grafos en Node pure) · Wompi Payment · Polygon Web3 Proofs.
- **Enfoque Actual:** Ejecución del Plan de Remedición y Blindaje de Due Diligence (`implementation_plan.md`) para cumplir con requisitos legales, financieros y narrativos antes de ronda de inversión FFF.

---

## 📅 Registro Histórico de Interacciones y Decisiones Clave

### [2026-10-20] — Despliegue Exitoso a Producción (Firebase Hosting)
- **Solicitud del Usuario:** Ejecutar despliegue a producción (Tarea 2 de la hoja de ruta).
- **Acciones Realizadas:**
  - Compilación de producción con Vite (`npm run build`): 151 módulos transformados, 0 errores, bundles minificados y hash-versionados.
  - Sincronización SSoT de versión con `src/version.ts` (v2.3.0-prod).
  - Despliegue de hosting ejecutado con éxito vía Firebase CLI (`npx firebase deploy --only hosting`): 69 archivos subidos a `ronda-uno`.
  - **URL de Producción Activa:** https://ronda-uno.web.app (con cabeceras de seguridad HSTS, CSP y noindex en `/invest`).

### [2026-10-20] — Pivot Estratégico: Lanzamiento Exprés FFF 100% WhatsApp (Descarte de LinkedIn)
- **Solicitud del Usuario:** Limitar el plan de lanzamiento exclusivamente a FFF (Friends, Family & Founders) descartando por ahora LinkedIn, y reformularlo para lanzarlo hoy mismo.
- **Acciones Realizadas:**
  - Redacción del [PLAN_LANZAMIENTO_FFF_WHATSAPP_EXPRESS.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/PLAN_LANZAMIENTO_FFF_WHATSAPP_EXPRESS.md):
    - **Enfoque:** Sprint de 7 días (20 - 27 octubre), 100% 1:1 privado vía WhatsApp y llamadas directas (cero riesgo legal de captación masiva).
    - **Meta:** $8.000.000 COP en 8 tickets de $1M (mutuo al 6.0% a 90 días respaldado con pagaré).
    - **Materiales de Acción Inmediata:** Plantillas de WhatsApp para Anillo 1 (Familia/íntimos) y Anillo 2 (Amigos/colegas), guión de llamada de 10 min, manejo de objeciones y checklist operativo para los primeros 45 minutos de hoy.

### [2026-10-20] — Plan Maestro de Lanzamiento FFF (Growth Marketing) y Especificación de Blindaje
- **Solicitud del Usuario:** Diseñar la estrategia integral paso a paso de lanzamiento y captación para la Micro-Ronda FFF vía LinkedIn y WhatsApp, y preparar los pendientes técnicos para su ejecución.
- **Acciones Realizadas:**
  - **Plan Maestro de Lanzamiento Online & Cierre FFF:** Documentado en `docs/PLAN_LANZAMIENTO_FFF_LINKEDIN_WHATSAPP.md` con enfoque Growth Marketing (AARRR) y separación estricta de dos pistas:
    - *Pista A (Pública - LinkedIn):* Lanzamiento de producto, visión, tecnología y tracción waitlist (sin mención de retorno, tasa ni deuda).
    - *Pista B (Privada - WhatsApp):* Founders Circle nominal cerrado (tope 15 personas con relación previa documentada) para mutuo comercial al 6.0% simple / 90 días ($8.000.000 COP).
    - Cronograma de 6 fases (20 oct - 18 dic), guiones para 10 posts de LinkedIn, 15 secuencias de WhatsApp, minuto a minuto del evento y matriz de riesgos.
  - **Especificación y Ejecución Inmediata (Fase 7 - Completada):**
    1. Sincerada la barra de tickets de `invest.html` a 0/8 tickets y $0 COP recaudados iniciales (sin datos ficticios), gobernada reactivamente por `window.RONDA_INVEST_CONFIG` y `syncTicketProgressUI()`.
    2. Desindexación integral de `/invest`: creado `public/robots.txt`, inyectado `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">` en el `<head>`, anonimizados metadatos OG/Twitter de previews privadas, y configurada regla `X-Robots-Tag` en `firebase.json`.
    3. Gate de acceso nominal: integrado catálogo `AUTHORIZED_GUESTS` con soporte de parámetros de URL (`?token=...` / `?pin=...`), persistencia en `sessionStorage`, saludo personalizado (`#investor-welcome-badge`) y telemetría de auditoría (`leadId`) en `RondaTracker.track('investor_portal_unlocked')`.
    4. Limpieza de métrica fallback de visitas (`initVisitorCounter` fallback '1' en vez de '28').
    5. Verificación de producción: compilación `npm run build` exitosa (0 errores, 151 módulos transformados).

### [2026-10-20] — Blindaje Due Diligence: Tasa Mutuo 6.0% (26.2% E.A.), Disclaimer Legal /invest y Ley 1581
- **Solicitud del Usuario:** Continuar con la ruta pendiente del Plan de Remedición y Blindaje de Due Diligence.
- **Acciones y Correcciones Aplicadas:**
  - **Ajuste Tasa de Mutuo Comercial (P0):** Reducción de la tasa de remuneración de 9.0% a **6.0% simple a 90 días (equivalente a 26.2% E.A.)**, asegurando estricto cumplimiento del tope legal de usura en Colombia (29.45% E.A.). Aplicado y recalculado (repago de $8.480.000 COP para $8M COP de capital):
    - `invest.html`: Simulador interactivo (`updateSim()`), One-Pager institucional, proyecciones financieras, generador de pagaré notarial, exportador CSV y mensaje de formalización WhatsApp.
    - `ronda-files/CONTRATO_MUTUO_COMERCIAL_FFF.md`: Cláusula Quinta (tasa 6.0% simple / 26.2% E.A., ejemplo de ticket $2M con $120k de interés) y Cláusula Novena (ratio de cobertura 1.86x).
    - `ronda-files/PAGARE_Y_CARTA_INSTRUCCIONES_FFF.md`: Pagaré a la orden (Parte 1), Carta de instrucciones (Parte 2) y Acta de desembolso (Parte 3).
    - `ronda-files/GUIA_OPERATIVA_CIERRE_FFF.md`: Tabla de liquidación por ticket FFF y resumen de condiciones.
    - `ronda-files/RONDA - Documento Maestro Ronda FFF (Préstamo 90 Días).md`: Términos de la ronda FFF y tabla de repago.
    - `docs/RONDA_MEMORANDUM_INVERSION_FFF.md`: Resumen de deuda puente y retorno a 90 días.
  - **Blindaje Legal Landing `/invest` (P0):** Inserción de avisos legales explícitos aclarando que la presentación está dirigida exclusivamente a círculo privado (Friends, Family & Founders) bajo Código de Comercio Art. 1163 y Ley 527 de 1999, que no constituye captación masiva ni oferta pública de valores, y que las cifras y simuladores representan modelos ilustrativos de la fase piloto.
  - **Consentimiento Expreso Ley 1581 de 2012 (P1):**
    - Checkbox obligatorio en el formulario de registro (`index.html`) con validación activa en `src/views/auth-view.ts` para tratamiento de datos personales y política de privacidad.
    - Checkbox obligatorio de datos biométricos sensibles en el contenedor KYC (`index.html`) con validación activa en `src/verification.ts` antes de activar la cámara frontal y el motor facial.
  - **Saneamiento de Claims y CAC (P1):**
    - Actualización en `docs/RONDA_MEMORANDUM_INVERSION_FFF.md` para reflejar "Fase Piloto con MVP Funcional Verificado y Auditoría de Código en Desarrollo" y CAC SSoT en $35.000 COP ponderado.
  - **Verificación Técnica Completa:**
    - TypeScript strict: `npx tsc --noEmit` (0 errores).
    - Benchmark del Motor: `node src/mem-rr-v2/bench.ts` (100% OK, 0 colisiones, 1.0 ms).
    - Tests Biométricos y KYC: `npm run test:face` (15/15 OK).
    - Tests de Seguridad e Integridad $0: `node test/test-integrity-zero-functions.cjs` (4/4 OK).
    - Tests de Aceptación B2B: `npm run test:b2b` (56/56 OK).
    - Bundle de Producción: `npm run build` (Exitoso en 34s).

### [2026-10-06] — Auditoría, Verificación Completa y Reparación de Bugs en App Cliente
- **Solicitud del Usuario:** Probar todo el flujo de la aplicación del cliente y reparar bugs detectados.
- **Acciones y Correcciones Aplicadas:**
  - **Reparación UI del QR del Pasaporte (`#qr-client`):** Se corrigió la regla CSS del contenedor del código QR en `src/client.ts` que aplicaba `display: grid` heredado del sistema de celdas legacy, haciendo que el elemento `<canvas>` se colapsara verticalmente. Ahora usa `display: flex` centrado.
  - **Reparación del Botón Rompehielos (`#btn-start-icebreakers`):** Se implementó delegación global de eventos en `src/icebreakers.ts` para que el botón "Preparar tu trago (Rompehielos)" responda siempre sin importar en qué momento del ciclo de vida se renderice la vista del cliente.
  - **Verificación Técnica Completa:** Se corrieron las suites de prueba:
    - Compilación TypeScript: `npx tsc --noEmit` (0 errores).
    - Bundle de Producción: `npm run build` (Exitoso).
    - Benchmark del Motor: `node src/mem-rr-v2/bench.ts` (100% OK, 0 ms / 17 ms).
    - Tests de Aceptación B2B: `npm run test:b2b` (56/56 OK).
    - Tests Biométricos y KYC: `npm run test:face` (15/15 OK).
    - Tests de Seguridad e Integridad $0: `node test/test-integrity-zero-functions.cjs` (4/4 OK).

### [2026-10-06] — Creación del Historial Persistente & Inicio de Remedición Due Diligence
- **Solicitud del Usuario:** Crear un historial de interacciones persistente para evitar la pérdida de contexto entre chats.
- **Decisión / Acción:**
  - Se crea `docs/HISTORIAL_INTERACCIONES.md` como Fuente Única de Verdad (SSoT) del historial del proyecto.
  - Se integra en `AGENTS.md` y `docs/index.md` dentro del **Bloque Estático Principal** para asegurar lectura automática en el turno 1 de cualquier sesión.
  - Contexto activo cargado: `implementation_plan.md` (Matriz de remedición A: Legal, B: Financiero, C: Narrativa/Tech).

### [2026-10-07] — Optimización y Aceleración WebGL del Motor KYC Biométrico
- **Hito:** Integración del motor facial optimizado en `src/face-verify.ts` y desacoplamiento en `src/verification.ts`.
- **Mejoras Implementadas:**
  - Inicialización acelerada WebGL (`WEBGL_VERSION: 2`, `WEBGL_PACK: true`) con warm-up de shaders mediante tensores dummy.
  - Downscale acelerado por hardware a resolución de entrada (320x320) reutilizando canvas sin asignación de memoria innecesaria.
  - Métricas de alineación biométrica: IOD (distancia interocular), centrado (tolerancia 0.35-0.65), EAR (Eye Aspect Ratio para parpadeo) y MAR (Mouth Aspect Ratio para sonrisa).
  - Eliminación de serialización innecesaria base64/toDataURL en `selfieDescriptor` de `src/verification.ts`.
  - Fallback a emuladores locales corregido en `src/firebase-config.ts` (solo activo si `VITE_USE_FIREBASE_EMULATOR=true` o `?emulator=true`).
  - **Enmarcado Preciso del Óvalo Biométrico:** Creación de `#kyc-camera-wrapper` con relación de aspecto 4:3 (`overflow: hidden; border-radius: 8px`). El óvalo guía y el viñeteado oscuro (`box-shadow: 0 0 0 9999px rgba(0,0,0,.5)`) ahora quedan anclados 100% sobre la pantalla del video sin desbordarse sobre los botones ni el título del modal.
  - **Experiencia Premium Facial (FaceID):**
    1. *Modo espejo*: Inversión horizontal natural `transform: scaleX(-1)` para alineación intuitiva de cámara frontal.
    2. *Anillo SVG perimetral animado*: Trazo continuo en tiempo real que se completa (0% → 100%) conforme el usuario mantiene la posición.
    3. *Haz de escaneo láser*: Barrido vertical biométrico continuo con gradiente luminoso (`kycScanSweep`).
    4. *Feedback háptico móvil*: Micro-pulsos de vibración sensorial (`navigator.vibrate`) al enganchar el rostro y al capturar exitosamente la selfie.
    5. *Detector automático de iluminación*: Análisis perceptual ultra-rápido (< 0.1ms) con advertencias tempranas de *"Poca luz"* o *"Demasiado brillo"*.
- **Verificación:**
  - `npx tsc --noEmit` completado con 0 errores (strict mode).
  - `npm run test:face` (15/15 pruebas unitarias pasando al 100%).

### [2026-08-27] — Consolidación de Evidencia Técnica del Motor `mem-rr-v2` (Patente/Bench)
- **Hito:** Ejecución exitosa de la suite determinista de benchmark (`node src/mem-rr-v2/bench.ts`).
- **Resultados:**
  - Evitación del 100% de violaciones de pares bloqueados (vs 3 en v1).
  - Optimización de afinidad media (2.064 vs 1.0 en v1).
  - Cobertura del 100% en mesas de 4 (M4) y tiempo de planificación < 10ms.
  - Documentado en `docs/bench-results/bench-2026-08-27.md`.

### [Previo] — Arquitectura de Módulos y Servidor Vercel
- **Decisión:** Migración de backend a Vercel Serverless (`functions-vercel/api/`) para webhooks de Wompi, mint de NFTs y procesamiento de rondas.
- **Decisión:** Mantener el motor `src/mem-rr-v2/` totalmente desacoplado del DOM/Firebase para permitir ejecución pura en Node y pruebas instantáneas.

---

### [2026-10-20] — Ejecución FASE 5 (KYC Biométrico) y FASE 6 (Club Fundador 100)
- **FASE 5 Blindaje Face-ID & KYC:** T-1 `waitForVideoReady` valida `readyState>=2 && videoWidth>0`; T-2 `scanDocumentOCR()` con `Promise.race` y timeout 8s (`error:'ocr_timeout'`); T-3 fallback limpio a `kycReviews` (`submitKycReview`, `pending`) sin error rojo; T-4 `npm run test:face` 15/15; T-5 `npm run build` 0 errores TS/Vite.
- **FASE 6 Club Fundador 100:** T-6.1 `DB.countUsers()` + `registerWithEmail` asigna `isFoundingMember`/`founderNumber` si `usersCount<100`; T-6.2 badge dorado `⭐ Miembro Fundador #N` en `profile.ts` y `profile-modal.ts`; T-6.3 banner beneficios en `landing.html`; T-6.4 `npm run build` sin errores.

## 🎯 Tareas Pendientes y Próximos Pasos (Hoja de Ruta Inmediata)

| Prioridad | Tarea / Hito | Archivos / Módulos Involucrados | Estado |
| :--- | :--- | :--- | :--- |
| **P0** | Ajuste Tasa Mutuo (6.0% a 90 días / 26.2% E.A.) y Remoción de Euros | `invest.html`, `ronda-files/*`, `docs/RONDA_MEMORANDUM_INVERSION_FFF.md` | ✅ Completado |
| **P0** | Blindaje de Disclaimer Ilustrativo en `/invest` | `invest.html` | ✅ Completado |
| **P1** | Checkbox Explícito Ley 1581 (Biometría/Datos) | `index.html`, `src/views/auth-view.ts`, `src/verification.ts` | ✅ Completado |
| **P1** | Corrección de Claims "Patentable" -> "Mecanismo Propietario" | `docs/MASTER_REFERENCE.md`, `landing.html`, `docs/RONDA_MEMORANDUM_INVERSION_FFF.md` | ✅ Completado |
| **P2** | Despliegue a Producción Firebase / Hosting | `firebase.json`, hosting | ✅ Completado (`https://ronda-uno.web.app`) |

---

## 💡 Reglas Contextuales Recordatorias para los Agentes
1. **SSoT Financiera:** Moneda en COP (Base 12.000 COP entrada), CAC en $35.000 COP.
2. **Archivos XL Prohibidos de Lectura Completa:** `src/client.ts` e `index.html`. Usar `grep`.
3. **Validación de Código:** Probar cambios del motor con `node src/mem-rr-v2/bench.ts` antes de declarar completada una tarea.
