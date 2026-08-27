# AGENTS.md — Instrucciones para agentes que trabajan en RONDA

> **Fuente de verdad:** este repo (`Desktop\ronda-app`). Las carpetas `Documents\ronda-app-v3` y
> `Documents\ronda-app` quedaron como copias/trabajo previo y **no se deben usar** para editar.

Objetivo: **gastar el mínimo de tokens por tarea**. Léelo junto a `docs/index.md`.

## Antes de actuar
1. Lee `docs/index.md` (mapa de archivos y coste de lectura). Ya te dice qué leer.
2. Identifica el archivo objetivo por rol, no por tanteo.

## Técnicas obligatorias de ahorro
- **grep > read**: localiza símbolos con `grep -n` y abre solo el rango necesario (`read` con `offset`/`limit`).
- **Nunca** listes ni leas `node_modules`, `dist/`, `.firebase/`, `*.log` grandes. Usa `include`/patrón.
- **Batch**: agrupa lecturas y consultas independientes en una sola tanda paralela.
- **No releas**: si ya leíste un archivo en la conversación, no lo releas.
- **Módulo puro**: el motor (`mem-rr-v2/`) se prueba en Node con `node src/mem-rr-v2/bench.ts`, sin abrir el bundle.

## Archivos prohibidos de lectura completa
`src/client.ts` (XL) e `index.html` (XL). Si los necesitas, `grep` la sección o lee por rangos.

## Formato de respuesta
- Respuestas cortas, sin re-explicar el contexto ya establecido.
- Tablas compactas; una línea por hallazgo, no párrafos extensos.

## Tareas frecuentes
- **Validar motor**: `node src/mem-rr-v2/bench.ts` (incluye validación M4: mesas de 4 y grafo local).
- **Motor integrado**: hook en `bar.ts` (M2/M4/M5, fallback v1), historial (`mem-rr-history.ts`),
  suscripción en vivo del cliente (`client.ts`, M3), panel de métricas (M5) y check-in QR (M3).
- **Evidencia técnica**: `docs/bench-results/bench-2026-08-27.md` (✅ BENCH OK).
- **Re-planificación**: `buildV2Plan` en `src/bar.ts` usa `alreadyMet` + `nightPlanStartRound`.
- **Mesas de 4**: `buildNightPlan({ ..., tableSize: 4 })`; **grafo local**: `room` + `config.delta > 0`.
- **Prueba de existencia**: `node scripts/register-proof.cjs` (modo **reserva**: hash keccak256, no publica).
