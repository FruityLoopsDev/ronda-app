# Resumen Ejecutivo — Motor MEM-RR v2 (WMM) para agente de patentes

> **Confidencial.** Documento de 1 página para orientar al agente de patentes. No es asesoría legal.
> Material completo: `docs/provisional-us-mem-rr-v2.md` (borrador US en inglés, listo a revisar),
> `docs/invention-disclosure-mem-rr-v2.md`, `docs/ip-patent-strategy.md`, `docs/bench-results/bench-2026-08-27.md`.

---

## 1. La invención (una frase)
Sistema y método para programar y **reconfigurar en tiempo real** los encuentros de un evento
presencial, modelando cada ronda como un **emparejamiento ponderado con memoria** sobre los
participantes más **al menos un recurso fantasma de descanso**, sujeto a restricciones duras.

## 2. Problema técnico que resuelve
La rotación round-robin fija (un lado quieto, el otro rota +1) no tiene memoria entre noches, no
respeta restricciones (bloqueos/denuncias, orientación, no verificados), no se adapta a no-shows /
check-ins / salidas en vivo, asigna el descanso de forma mecánica e ignora la distancia física del
local. No ofrece métricas auditables de calidad.

## 3. Reivindicaciones (bosquejo, Claims 1–6)
- **C1 (Sistema):** memoria con matriz de colisiones ponderada por recencia y calidad del encuentro;
  optimizador de asientos (emparejamiento ponderado sobre participantes + ≥1 fantasma de descanso,
  restricciones duras); motor de restricciones en tiempo real (eventos de check-in de un sensor →
  recomputa las rondas restantes); interfaz de salida que emite asignaciones de mesa + instrucciones
  de transición física que minimizan el movimiento.
- **C2 (Método):** método correspondiente.
- **C3 (Fairness):** objetivo lexicográfico max-min (minimiza el máx. de re-encuentros por persona
  antes de maximizar caras nuevas).
- **C4 (Memoria con decaimiento):** los valores de colisión decaen exponencialmente con el tiempo y se
  reducen cuando el par ya tiene una conexión mutua (match) previa.
- **C5 (Recurso fantasma):** el descanso se asigna por la misma optimización; nadie descansa >1 vez;
  alterna de lado.
- **C6 (Dependiente):** mesas de capacidad 2 y 4; grafo de distancias del local; priorizar descanso
  por propensión de consumo.

## 4. Evidencia técnica (benchmark, 2026-08-27)
| Criterio | v1 (estado de la técnica) | v2 (invención) |
|---|---|---|
| Violaciones de pares bloqueados | 3 | **0** |
| Cruces recientes (≤14 días) | 4 | **3** |
| Calidad de pareja (afinidad media) | 1 | **2.064** |
| Fairness (máx. repet./persona) | 7 | 7 (no empeora) |
| Cobertura | — | 100% |
| Re-planificación tras no-show | no re-planifica | **0 refs a ausentes**, cobertura 90% |
| Re-plan intra-noche | — | **0 repeticiones**, cobertura 93.3% |
| Tiempo plan 12+12×9 rondas | — | **≈0 ms** (< 500 ms) |
| Tiempo plan general (20 personas) | — | **≈10 ms** (< 500 ms) |

*Correctitud de solvers:* flujo bipartito == fuerza bruta (400 casos, 0 discrepancias); DP exacto ==
fuerza bruta (200 casos, 0 discrepancias); búsqueda local ≈ exacto (92.6% de óptimos). Suite completa:
✅ **BENCH OK.**

## 5. Fechas clave (para prioridad y divulgación)
- **Concepción:** 2026-08-25.
- **Primera reducción a práctica:** 2026-08-25 (`src/mem-rr-v2/`).
- **Primera divulgación interna:** 2026-08-25 (`docs/algorithm-v2-spec.md` + disclosure).
- **Evidencia (benchmark):** 2026-08-27.
- **Repo GitHub verificado PRIVADO** (2026-08-27) — **sin divulgación pública** del motor.
- **No hay afirmaciones de "patente pendiente"** en web/docs (safe-harbor ok).

## 6. Recomendaciones al agente
1. Revisar y ampliar el borrador US (**Provisional, 35 U.S.C. §111(b)**) — prioridad 12 meses.
2. Evaluar la crítica de **elegibilidad (Alice/Mayo)**: argumentar el **efecto técnico** (reducción del
   tiempo de transición física, recomputo < 500 ms ante eventos de sensores, garantía formal de
   cobertura/no-repetición, cierre elegante ante infeasibilidad).
3. **Búsqueda formal de anterioridad** (round-robin, torneos, Blossom/matching conocido) — distinguir
   la combinación reivindicada (memoria con decaimiento + calidad, re-optimización ante sensores,
   recurso fantasma optimizado, fairness max-min).
4. Después del filing: registrar **marca RONDA**; mantener los **parámetros calibrados α/β/γ/δ/λ** y el
   **historial de encuentros** como **secreto empresarial** (no publicar).
