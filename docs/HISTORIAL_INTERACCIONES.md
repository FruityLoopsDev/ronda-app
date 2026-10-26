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

### [2026-10-26] — Especificación FASE 12: Rediseño y Elevación del Footer B2B en `/partners.html`
- **Solicitud del Usuario:** Mejorar el footer de la landing `/partners` para corregir desorden visual y solapamiento con el botón flotante de WhatsApp, y crear la tarea para delegar a Cline.
- **Acciones Realizadas:**
  - **Diagnóstico UI/UX:** Se identificó salto de línea antiestético en los enlaces legales ("Privacidad" en línea huérfana), falta de jerarquía B2B y colisión entre `#global-visit-counter` y el botón flotante de WhatsApp `.wa-float`.
  - **Plan de Arquitectura (FASE 12 en `task.md`):** Desglosadas 3 tareas atómicas (`T-12.1` a `T-12.3`) con arquitectura en 2 niveles (Nivel 1: Marca B2B + Enlaces clave + Contacto de Scout; Nivel 2: Copyright, métricas de ingeniería hidratables y contador con margen seguro anti-WhatsApp).

### [2026-10-26] — Banner Rotativo Dinámico en Hero de Landing Principal
- **Solicitud del Usuario:** Integrar los dos badges estáticos del hero (`✦ Solteros Profesionales de Alto Valor · Bogotá` y `🏆 Club Fundador 100 · Insignia Dorada + Prioridad + 1er Cóctel`) en un único banner rotativo de diseño premium.
- **Acciones Realizadas:**
  - **Componente `.hero-rotator-badge`:** Creada una píldora con micro-interacciones de lujo (borde ámbar luminoso, backdrop-filter de 10px, resplandor al hover y micro-puntos indicadores).
  - **Rotación Fluida y Segura:** Implementada rotación automática cada 3.8s con transiciones suaves verticales de entrada/salida (`transform: translateY` + `opacity`), pausa inteligente al pasar el cursor o tocar en móviles (`mouseenter`/`touchstart`), y apertura directa del modal de waitlist (`openWaitlist`) al hacer clic.
  - **Optimización de Espacio:** Reduce el peso visual y la altura del Hero en `landing.html`, permitiendo que el titular principal y los CTAs ganen prominencia inmediata sobre la línea de flotación.

### [2026-10-26] — Protocolo de Cierre de Waitlist & Onboarding Club Fundador 100
- **Solicitud del Usuario:** Definir con precisión qué sucede una vez que se cierra la lista de espera (flujo de producto, comunicación, experiencia física y conversión).
- **Acciones Realizadas:**
  - **Protocolo Operativo Maestro Creado:** [docs/PROTOCOLO_CIERRE_WAITLIST_Y_ONBOARDING_FUNDADORES.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/PROTOCOLO_CIERRE_WAITLIST_Y_ONBOARDING_FUNDADORES.md).
  - **Fase 1 (Trigger en Landing):** Al llegar a 100 inscritos o fecha de corte, `landing.html` conmuta a *«LISTA CERRADA (100/100)»* y activa la lista de reserva para la *Cohorte 2* (efecto psicológico de escasez y validación social).
  - **Fase 2 (Triage & Asignación):** Validación en 24h de perfiles de LinkedIn, balance de género 50/50, segmentación etaria y asignación del serial nominal (`Nº 001/100` a `Nº 100/100`).
  - **Fase 3 (Secuencia WhatsApp 1:1):** 3 mensajes estructurados (Admisión y asignación de serial → Lock-in de pago $45k en 48h → Verificación biométrica Face-ID de 40s y emisión de Pasaporte Digital QR).
  - **Fase 4 (Revelación Clandestina):** Anuncio del gastrobar aliado (Chapinero Alto/Zona G) en T-48 horas con dress code nocturno.
  - **Fase 5 (Experiencia en Sala):** Check-in en 2s por QR, entrega de sobre lino con lacre y Moneda de Barra física (45mm latón), canje del Cóctel Cero en barra, 9 rondas de 6 min con campana de bronce y votación secreta.
  - **Fase 6 (Bucle de Retención):** Matches a las 10:00 AM, cupón -25% para segunda cita en el bar aliado y 2 Golden Passes para invitar amigos a la Cohorte 2.
  - **Indexación:** Registrado en [docs/index.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/index.md).

### [2026-10-26] — Arquitectura de Privacidad, Términos & Condiciones y Flujo de Baja (Ley 1581)
- **Solicitud del Usuario:** Trabajar en un plan para garantizar privacidad y términos y condiciones, política clara para darse de baja de la app con botón ágil y cuestionario opcional de motivos de salida, listo para delegar a Cline.
- **Acciones Realizadas:**
  - **Documentos Jurídico-Técnicos:** Creados [docs/TERMINOS_Y_CONDICIONES.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/TERMINOS_Y_CONDICIONES.md) y [docs/POLITICA_TRATAMIENTO_DATOS_LEY_1581.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/POLITICA_TRATAMIENTO_DATOS_LEY_1581.md) adaptados a la Ley 1581 de 2012 (Habeas Data), Decreto 1377 de 2013 y Estatuto del Consumidor.
  - **Especificación de Plan para Cline (`task.md` - FASE 11):** Desglosadas 6 tareas atómicas (`T-11.1` a `T-11.6`) cubriendo: visor modal legal `#modal-legal-viewer`, tarjeta en perfil con botón de baja, modal de confirmación con cuestionario opcional de salida (7 opciones rápidas + feedback libre + disociación estadística), método `DB.deleteUserAccount()` y supresión irreversible en Firebase Auth/Firestore/Storage.
  - **Reglas de Seguridad Firestore (`firestore.rules`):** Actualizado permiso de eliminación en `/users/{userId}` para permitir autoservicio del titular (`request.auth.uid == userId`) y agregada regla para registrar encuestas de salida anonimizadas en `/churn_surveys/{surveyId}`.
  - **Pruebas:** Validadas 4/4 pruebas de seguridad automatizadas (`node test/test-integrity-zero-functions.cjs` exitoso).

### [2026-10-26] — Eventos Especiales de Ticket Alto & Dossier «Subasta de Citas» para Perplexity
- **Solicitud del Usuario:** Explorar la viabilidad de eventos especiales de ticket alto ($120.000 – $180.000 COP) para calentar el segmento frío (hombres solteros), evaluar el impacto real y engagement en redes de una dinámica disruptiva tipo "Subasta de Solteros", y preparar un documento estructurado para elevar la discusión a Perplexity.
- **Acciones Realizadas:**
  - **Dossier Maestro Creado:** [docs/DEBATE_EVENTOS_ESPECIALES_SUBASTA_SOLTEROS.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/DEBATE_EVENTOS_ESPECIALES_SUBASTA_SOLTEROS.md).
  - **Giro de Producto Anti-Cosificación:** Transformación de la "subasta de personas" en la **«Subasta de la Cita Soñada»** (experiencias gastronómicas/culturales de autor diseñadas por 8 solteros de honor) con 50% a causa social y 50% consumo bar, blindando la marca de críticas.
  - **Modelado de Engagement:** CTR estimado de 4.5%–7.2% (~3.5x regular), Engagement Rate de 8.4%–12.6% y share rate en WhatsApp de 3.8% (~9.5x regular), proyectando reducción de CAC a $4.500–$7.800 COP.
  - **Unit Economics de Gala:** $7.2M COP en taquilla (60 pax @ $120k) + $2M COP en pujas benéficas, con 56% de margen bruto ($4.03M COP/noche).
  - **Prompt Maestro para Perplexity:** Bloque de research avanzado con 5 ejes analíticos (benchmarks globales, psicología masculina de alto valor, virabilidad de reels, brand safety y viabilidad de precios en Bogotá).
  - **Indexación:** Registrado en [docs/index.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/index.md).

### [2026-10-26] — Integración Narrativa: +220h de Ingeniería & Badges de Confianza
- **Solicitud del Usuario:** Integrar las métricas de desarrollo (+220 horas, 88 versiones, motor matemático propietario y ~$45M COP en sweat equity) en toda la narrativa y los pies de página (footers). Añadir iconos de redes sociales (Instagram, LinkedIn, GitHub) en las landings principales.
- **Acciones Realizadas:**
  - **Footer Unificado (`src/footer.ts` y portales):** Inyectada la cápsula discreta `⚡ +220h de ingeniería · Motor mem-rr-v2 propietario` y los iconos SVG de redes sociales (Instagram, LinkedIn, GitHub).
  - **Landings Principales (`invest.html`, `landing.html`, `partners.html`):** Integrados los iconos SVG interactivos de Instagram, LinkedIn y GitHub en los pies de página listos para recibir enlaces finales.
  - **Portal de Inversores (`invest.html`):**
    - Footer enriquecido con el badge de confianza: `⚡ +220h de ingeniería · 88 deploys · Motor mem-rr-v2`.
    - Executive One-Pager (`#modal-doc-onepager`): Incorporada la viñeta de *Sweat Equity & Ejecución Previa* bajo la sección de blindaje de software.
  - **Guion de WhatsApp & Manejo de Objeciones (`docs/PLAN_LANZAMIENTO_FFF_WHATSAPP_EXPRESS.md`):** Actualizados los minutos 4–6 y tabla de respuestas a objeciones para utilizar el respaldo de las 220h como disipador total del riesgo tecnológico.
  - **Verificación Técnica:** `npx tsc --noEmit` completado con 0 errores y compilación `npm run build` exitosa en 2m 44s.

### [2026-10-26] — Diseño & Viabilidad Financiera: Kit de Bienvenida «Club Fundador 100»
- **Solicitud del Usuario:** Diseñar un kit de bienvenida fuera de serie para los miembros fundadores (combinando La Moneda de Barra + La Comanda Negra con Lacre) y evaluar su inclusión en el presupuesto de la micro-ronda FFF ($8M COP).
- **Acciones Realizadas:**
  - Creación del documento maestro [docs/KIT_BIENVENIDA_CLUB_FUNDADOR_100.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/KIT_BIENVENIDA_CLUB_FUNDADOR_100.md):
    - *Componente A:* Moneda de latón macizo envejecido (45mm · 35g) con monograma y número serial troquelado (`Nº 001/100`), usada como llave de barra para reclamar el «Cóctel Cero».
    - *Componente B:* Comanda de iniciación en papel algodón 300g con tipografía letterpress bajo relieve y caligrafía personalizada.
    - *Componente C:* Sobre negro mate (180g lino) sellado con cera de lacre flexible rojo vino (`#9B2748`).
  - **Evaluación Financiera & Calce de Presupuesto:**
    - Costo unitario estimado: ~$18.000 COP por kit completo (talleres en Ricaurte / San Victorino, Bogotá).
    - **Calce 100% dentro del presupuesto existente:** Se absorbe directamente dentro de la partida presupuestal ya aprobada de *"Kits de Branding, Props Físicos y Merch"* de **$1.800.000 COP (22.5% de la ronda de $8M COP)**.
    - Estrategia en 2 fases: Lote inicial de 50 kits para los 2 primeros pilotos ($900.000 COP) dejando $900.000 COP para campanas de bronce y acrílicos de mesa; los 50 kits restantes se financian con el flujo positivo de boletería.
    - No requiere alterar el monto de la ronda ($8M COP) ni la tasa de retorno a inversores (6.0% a 90 días).

### [2026-10-26] — Modal de Bienvenida en `/invest` & Despliegue a Producción
- **Solicitud del Usuario:** Agregar modal de bienvenida a la landing `/invest` y desplegar a producción.
- **Acciones Realizadas (`invest.html`):**
  - Modal `#modal-welcome` (reutiliza `.pitch-modal-*`): saludo personalizado por `?token=` (`AUTHORIZED_GUESTS` / `sessionStorage`), 3 puntos clave (8 × $1M COP · 6,0% a 90 días / 26,2% E.A. · círculo privado FFF) y aviso legal corto (Art. 1163 C.Co. · Ley 527/1999).
  - Solo primera visita (`localStorage: ronda_invest_welcome_seen`); al cerrar, se encadena el modal de pantalla completa (`window.openPitchSuggestion`).
  - Telemetría: `investor_welcome_view`, `investor_welcome_dismiss` (`via`).
  - **Bug corregido:** el modal de pantalla completa nunca se abría (su script corría antes de existir el nodo en el DOM). Ambos inicializadores ahora corren en `DOMContentLoaded`.
  - Verificado en navegador (Vite local) y compilado sin errores (`dist/invest.html` 167 kB).
- **Despliegue a Producción:**
  - Firebase Hosting actualizado exitosamente a `ronda-uno` (69 archivos, 0 errores).
  - **URL en Producción Activa:** https://ronda-uno.web.app/invest.html

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

### [2026-10-26] — Automatización de Métricas Git, Kit Fundador y Blindaje FFF
- **Solicitud del Usuario:**
  - Diseñar Kit de Bienvenida para el «Club Fundador 100» fuera de serie, documentar 4 conceptos y evaluar unit economics ($18.000 COP/kit) dentro de la partida existente de $1.8M COP (22.5%) de la ronda FFF.
  - Implementar generador nominal de tokens FFF en SuperAdmin con persistencia Firestore y fallback local.
  - Diseñar modal de bienvenida personalizado en `/invest.html` con token nominal y encadenado a pantalla completa.
  - Contabilizar horas de ingeniería (+220h, 88 commits, 15 días activos) y automatizar el contador día a día de forma continua cruzando el control de versiones (Git).
- **Acciones y Resultados:**
  - **Kit de Bienvenida:** Documentado en `docs/KIT_BIENVENIDA_CLUB_FUNDADOR_100.md` (Moneda de barra en latón 45mm troquelada + Comanda letterpress en sobre negro lino sellado con lacre). Integrado visualmente en `#noche` y desglosado en `#modal-doc-financial` de `invest.html`.
  - **Sincronización Git en Build (`scripts/sync-version.cjs`):** Lee `git rev-list --count HEAD`, calcula días únicos de sprint y días calendario, exportando a `src/version.ts`.
  - **Hidratación Dinámica en Vivo (`src/footer.ts`):** En tiempo de ejecución calcula la progresión diaria (`daysSinceLast * 2h`), actualiza los selectores `[data-ronda-*]` e implementa consulta asíncrona no invasiva a la GitHub API (`FruityLoopsDev/ronda-app`) con cache de 4h en `localStorage` y ticker automático cada 30 min.
  - **Blindaje GitHub Actions:** Actualizado `.github/workflows/firebase-hosting-merge.yml` con `fetch-depth: 0` para asegurar que los runners de CI dispongan de todo el historial de Git para métricas exactas.
  - **Iconos de Redes Sociales:** Añadidos SVG limpios para Instagram, LinkedIn y GitHub en `landing.html`, `invest.html`, `partners.html` y el footer estándar inyectado.
  - **Verificación Técnica:** `npx tsc --noEmit` (0 errores) y `npm run build` (151 módulos transformados con éxito).

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

### [2026-10-26] — Banner Rotativo Hero y Estandarización Transversal de Footers (2 Niveles Luxury)
- **Solicitud del Usuario:**
  1. Integrar los dos textos clave de la landing principal en un banner rotativo elegante.
  2. Rediseñar el footer de `/partners.html` para evitar partición antiestética de enlaces legales y colisión con el botón de WhatsApp.
  3. Extender transversalmente este nuevo estándar a todos los footers del ecosistema RONDA.
- **Acciones y Resultados:**
  - **Banner Rotativo en `landing.html`:** Componente `.hero-rotator-wrapper` con 2 slides animados («✦ Solteros Profesionales de Alto Valor» / «🏆 Club Fundador 100»), micro-pips interactivos, pausa al hover y apertura directa del modal de waitlist.
  - **Estandarización de Footers en 2 Niveles (`.site-footer`):**
    - `partners.html`: Implementada cuadrícula de 2 niveles (Marca B2B, Navegación B2B/Legal, Scout WhatsApp y Redes + Copyright, métricas hidratadas y contador con padding de 70px anti-colisión).
    - `landing.html`: Aplicado mismo estándar con navegación B2C y soporte a asistentes.
    - `invest.html`: Adaptado para sala FFF con marco legal (C. de Co. Art. 1163), mesa fundadores WhatsApp (+57 316 974 9677) y contador `#footer-counter`.
    - `src/footer.ts`: Reescrito `getRondaFooterHtml()` para inyectar este estándar en todos los portales SPA (`/admin`, `/crm`, `/network`, `/superadmin`).
    - `index.html`: Actualizado footer estático a 2 niveles con enlaces directos a modales legales `#modal-legal-viewer`.
    - `superadmin.html`: Actualizado footer conservando contador dinámico SVG en vivo.
  - **Verificación Técnica:** `npx tsc --noEmit` completado con 0 errores (código 0) y `npm run build` completado exitosamente (código 0, empaquetado total en `dist/`).

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
