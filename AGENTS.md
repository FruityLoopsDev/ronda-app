# AGENTS.md — God Prompt & Reglas para Agentes (RONDA)

> **PROMPT CACHING PROTOCOL (CRÍTICO)**
> Para aprovechar el Prompt Caching de los LLMs y minimizar el costo de tokens:
> 1. Este archivo (`AGENTS.md`), `docs/index.md` y `docs/HISTORIAL_INTERACCIONES.md` son el **Bloque Estático Principal**.
> 2. Los agentes DEBEN leer estos archivos EXACTAMENTE en ese orden al inicio de cada conversación o sesión.
> 3. NUNCA edites este archivo de forma impulsiva; mantén su estructura inmutable en la medida de lo posible.
> 4. Lee el código dinámico y los archivos del proyecto *después* de cargar este bloque estático.

## 1. El Stack Multi-Agente (Roles y Responsabilidades)
RONDA es mantenido por un equipo de IA. Deriva el trabajo a la herramienta adecuada:

- **Antigravity (IDE Agent):** *Arquitecto y Orquestador.*
  Planea (`implementation_plan.md`), diseña arquitectura, asigna tareas a otros agentes y documenta flujos (`walkthrough.md`).
- **Cline (VS Code Agent):** *Ejecutor Autónomo.*
  Especialista en refactorización masiva, ejecución local (tests, scripts, builds). Lee los `task.md` de Antigravity y ejecuta modificaciones en bucle.
- **Perplexity (Vía OmniRoute/MCP):** *Investigador Externo.*
  Consulta documentación actualizada (Wompi, Vite, Polygon, Firebase) ANTES de implementar integraciones externas.
- **DeepSeek Harness (Vía OmniRoute/MCP):** *Algoritmista Matemático.*
  Encargado exclusivamente del razonamiento profundo y matemáticas discretas del motor de matching (`src/mem-rr-v2/`).

## 2. Técnicas Obligatorias de Ahorro de Tokens
- **grep > read**: Localiza símbolos con `grep -n` y abre solo el rango necesario (`read` con `offset`/`limit`).
- **Nunca** listes ni leas `node_modules`, `dist/`, `.firebase/`, `*.log` grandes. Usa filtros.
- **No releas**: Si el contexto ya fue leído y cacheado en la conversación, no vuelvas a pedirlo.
- **Módulo puro**: El motor (`mem-rr-v2/`) se prueba en Node con `node src/mem-rr-v2/bench.ts` SIN abrir bundles de UI.

## 3. Restricciones de Lectura
Archivos **prohibidos** de lectura completa (usa `grep` o lee por rangos):
- `src/client.ts` (XL)
- `index.html` (XL)

## 4. Tareas Frecuentes y Puntos de Entrada
- **Validar motor:** `node src/mem-rr-v2/bench.ts` (incluye validación M4: mesas de 4 y grafo local).
- **Motor integrado:** hook en `src/bar.ts` (M2/M4/M5), historial en `src/mem-rr-history.ts`, suscripción en vivo en `src/client.ts`.
- **Re-planificación:** `buildV2Plan` en `src/bar.ts` usa `alreadyMet` + `nightPlanStartRound`.
- **Mesas de 4:** `buildNightPlan({ ..., tableSize: 4 })`; **Grafo local:** `room` + `config.delta > 0`.
- **Prueba de existencia Web3:** `node scripts/register-proof.cjs` (hash keccak256, modo reserva).
- **Evidencia técnica:** `docs/bench-results/bench-2026-08-27.md` (✅ BENCH OK).

## 5. Formato de Respuesta
- Respuestas cortas, sin re-explicar el contexto ya establecido en la caché.
- Usa tablas compactas; una línea por hallazgo, no párrafos extensos.
- Deriva al usuario o al agente correspondiente si la tarea escapa a tu rol (ej. "Antigravity delega a Cline el refactor").

## 6. Estándar Inmutable de Footers (Regla de 3 Categorías)
- Seguir estrictamente `.agents/rules/ronda-footer-standard.md`.
- **Landings (`landing`, `partners`, `invest`):** Footer Luxury Semántico 3 columnas.
- **Web App (`index.html`):** Footer Minimalista de Control de Versiones (`.ronda-app-footer`: versión `v2.3.0-prod`, ingeniería y legal) con padding inferior de 84px. Prohibido footer comercial de marketing.
- **Dashboards Staff (`network`, `crm`, `admin`, `superadmin`):** Dashboard Console Footer de 1 sola fila (`getRondaDashboardFooterHtml()`). PROHIBIDO texto de marketing de citas en paneles operativos.

