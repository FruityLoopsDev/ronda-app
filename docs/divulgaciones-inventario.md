# Inventario de divulgaciones — Motor MEM-RR v2

> **CONFIDENCIAL — uso interno (equipo + agente de patentes).** Catálogo de los documentos y
> materiales donde se describe o se reduce a práctica la invención, con sus **fechas**. Sirve para
> (a) fijar la fecha de primera divulgación, (b) detectar cualquier divulgación pública que pudiera
> restar novedad, y (c) respaldar el **periodo de gracia** en Colombia (SIC) y la estrategia de
> anterioridad.

## Alcance

La invención protegible es el **motor de programación de encuentros con memoria ponderada
(MEM-RR v2 / WMM)**: modelo `w = α·A + β·F − γ·R − δ·D`, solvers de emparejamiento, recurso
fantasma (silla de barra) optimizado, re-optimización intra-noche y fairness max-min.

## Tabla de divulgaciones

| # | Documento / material | Fecha | Naturaleza | ¿Público? | Notas |
|---|---|---|---|---|---|
| 1 | `docs/algorithm-v2-spec.md` | 2026-08-25 | Especificación técnica del motor v2 | **No** (interno) | Versión inicial 2026-08-25; se actualizó 2026-08-27 para referenciar la evidencia |
| 2 | `src/mem-rr-v2/` (código) | 2026-08-25 | Reducción a práctica (implementación) | **No** (repo privado) | `engine.ts`, `exact.ts`, `flow.ts`, `general.ts`, `weights.ts`, `types.ts` |
| 3 | `docs/invention-disclosure-mem-rr-v2.md` | 2026-08-25 | Invention disclosure | **No** (interno) | Fecha de concepción y reducción a práctica: 2026-08-25 |
| 4 | `docs/ip-patent-strategy.md` | 2026-08-25 | Estrategia de IP + Claims 1–6 | **No** (interno) | |
| 5 | `docs/provisional-us-mem-rr-v2.md` | 2026-08-25 | Borrador Provisional US | **No** (interno) | Aún **no presentado** |
| 6 | `docs/bench-results/bench-2026-08-27.md` | 2026-08-27 | Evidencia técnica (benchmark) | **No** (interno) | ✅ BENCH OK |
| 7 | `docs/mem-rr-algorithm.md` | 2026-08-23 | Modelo matemático **v1** | **No** (interno) | Motor anterior, relación de contextualización |
| 8 | `ronda-files/ronda-motor-rotacion.html` | 2026-08-23 | Simulador **v1** | **No** (interno) | **No** divulga el motor v2 |
| 9 | `ronda-files/ronda-maqueta-CO.html` | 2026-08-23 | Maqueta del producto | **No** (interno) | **No** divulga el algoritmo v2 |
| 10 | `ronda-files/ronda-logica-negocio-CO.md` | 2026-08-23 | Lógica de negocio B2B2C | **No** (interno) | **No** divulga el algoritmo v2 |
| 11 | `ronda-files/ronda-competencia-foda-evolucion.md` | 2026-08-23 | Análisis competitivo | **No** (interno) | **No** divulga el algoritmo v2 |
| 12 | Repo GitHub `FruityLoopsDev/ronda-app` | — | Código fuente | **Privado** (verificar) | Contiene `src/mem-rr-v2/`; **sin divulgación pública** del motor |

## Conclusiones clave

1. **Fecha de primera divulgación interna** de la invención: **2026-08-25** (spec + código + disclosure).
2. **Nada del motor v2 ha sido divulgado públicamente** (repo privado, material interno con marca CONFIDENCIAL).
3. Los únicos materiales anteriores (v1, 2026-08-23) **no describen la invención v2** (rotación por
   offsets vs emparejamiento ponderado con memoria).
4. **Riesgo residual:** el repo GitHub debe estar **confirmado como privado**. Si hubo `force-push`,
   clonación o copia a un repo público, la divulgación pública habría ocurrido y no hay periodo de
   gracia en Europa (ver `docs/ip-patent-strategy.md` §6).
5. Para el **provisional US**: intentar fijar la fecha más temprana posible de reducción a práctica;
   ya se cuenta con el material con fecha 2026-08-25.

> ⚠️ Este documento NO es asesoría legal. Antes de cualquier filing, validar con un agente habilitado
> ante la SIC y/o USPTO la elegibilidad y el tratamiento de las divulgaciones.
