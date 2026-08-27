# Invention Disclosure — Motor de Rotación con Memoria MEM-RR v2 (WMM)

> **CONFIDENCIAL — SOLO PARA USO INTERNO Y DEL AGENTE DE PATENTES**
> No publicar, no compartir fuera del equipo, no subir a repositorios públicos.

| Campo | Valor |
|---|---|
| **Título de la invención** | Sistema y método para la programación dinámica de encuentros en eventos en vivo con memoria ponderada por recencia, restricciones duras y asignación optimizada de recursos de descanso |
| **Inventor(es)** | [NOMBRES COMPLETOS — completar] |
| **Fecha de concepción** | 2026-08-25 (sesión de diseño del motor v2) |
| **Fecha de primera reducción a práctica** | 2026-08-25 (implementación `src/mem-rr-v2/` + suite de validación) |
| **Organización** | RONDA (plataforma B2B2C, Bogotá) |
| **Documentos de referencia** | `docs/algorithm-v2-spec.md`, `docs/ip-patent-strategy.md`, `src/mem-rr-v2/*.ts` |

---

## 1. Problema técnico

Las plataformas y operadores de citas rápidas presenciales (speed dating) programan la rotación de
participantes entre mesas con heurísticas fijas:

1. **Round-robin de torneo** (un lado fijo, el otro rota +1): garantiza cobertura sin repetición
   intra-noche, pero **ignora el historial entre noches** (vuelve a sentar a personas que ya se
   conocieron), ignora la compatibilidad y no puede evitar pares no deseados (bloqueos, denuncias,
   incompatibilidades de orientación).
2. **Sin re-optimización en vivo**: la planificación es estática; un no-show, una llegada tarde o una
   salida anticipada rompen el plan sin remedio.
3. **Asignación ciega del descanso**: en lados impares, el "asiento de barra" se asigna por rotación
   mecánica, sin criterio de justicia (fairness) ni de oportunidad comercial (consumo en barra).
4. **Sin criterio de calidad de pareja**: los cruces se deciden por conteo bruto de colisiones, sin
   ponderar recencia (curva de olvido), afinidad ni resultado previo del encuentro (match/no-match).

## 2. Descripción de la invención

### 2.1 Modelo (Weighted Matching with Memory, WMM)

Cada ronda se modela como un **emparejamiento ponderado** (Maximum Weight Matching) sobre el conjunto
de participantes más **al menos un nodo fantasma de descanso**, sujeto a restricciones duras:

```
Max Σ_{(i,j) ∈ M} w(i,j)     M = emparejamiento perfecto sobre P ∪ {ghost}
                             H(i,j) = -∞ para pares prohibidos
```

Peso de pareja con cuatro componentes calibrables:

```
w(i,j) = α·A(i,j) + β·F(i,j) − γ·R(i,j) − δ·D(i,j)
```

- **Afinidad** `A`: compatibilidad dura (orientación/género) + blandas (edad, intereses, señal de datos).
- **Frescura** `F` (curva de olvido): `F = 1 − exp(−λ·Δdías)` desde el último encuentro; `F = 1` si
  nunca se vieron. Un cruce reciente reduce la novedad; el tiempo la recupera.
- **Repetición** `R`: `Σ_n exp(−λ·Δdías_n)` sobre encuentros históricos, **reducida si el par tuvo
  match mutuo** (ya tienen canal abierto).
- **Distancia** `D`: costo de transición física sobre el grafo del local (giros de 2 minutos).

### 2.2 Solver

| Caso | Algoritmo | Estado |
|---|---|---|
| Formato estándar (lados A/B) | **Min-Cost Max-Flow** (bipartito + nodos fantasma) — exacto | Implementado y validado vs fuerza bruta (400 casos) |
| Formato general (todos contra todos) | **DP exacto por subconjuntos** (n ≤ 18) + **búsqueda local multi-arranque** (n > 18) | Implementado; Blossom V como upgrade planificado |

### 2.3 Características inventivas (points of novelty)

1. **Memoria ponderada por recencia y por calidad** (curva de olvido + penalización reducida tras
   match mutuo), a diferencia del contador binario del estado de la técnica.
2. **Re-optimización intra-noche**: ante cambios en la composición de la sala (check-in, no-show,
   salida), se recomputa el plan de las rondas restantes con restricción dura *"ya se conocieron
   esta noche"* (conjunto `alreadyMet`), garantizando novedad frente al plan anterior.
3. **Detección de infeasibilidad con cierre elegante**: si el máximo de rondas factibles se agota
   respetando restricciones duras, el sistema **detiene la noche en su máximo factible en lugar de
   violar una restricción** (nunca sienta un par bloqueado/denunciado).
4. **Asignación optimizada del recurso fantasma (silla de barra)** como nodo dentro del solver:
   nadie descansa dos veces antes de que todos descansen una; alternancia de lado; opcionalmente
   prioriza el descanso de mayor propensión de consumo.
5. **Fairness lexicográfica max-min**: minimizar el máximo de re-encuentros por persona antes de
   maximizar el total de caras nuevas.
6. **Sistema métrico de instrumentación** (freshness, cobertura, Gini de descansos, distancia de
   transición) que permite auditar la calidad del plan (insumo para el SaaS).

## 3. Efecto técnico (elegibilidad)

- **Reducción del tiempo de transición física** entre rondas (giros de 2 min) mediante el grafo del
  local y la elección de rotación.
- **Reconfiguración en tiempo real** del emparejamiento ante eventos de sensores (check-in QR,
  campana, detección de no-show) con presupuesto de cómputo < 500 ms.
- **Garantía formal de cobertura y no-repetición** intra-noche incluso bajo restricciones (formato
  bipartito exacto).
- **Cierre elegante ante infeasibilidad** (comportamiento del sistema, no excepción del algoritmo).

## 4. Reducción a práctica (evidencia)

Suite reproducible: `node src/mem-rr-v2/bench.ts` — resultados registrados el **2026-08-25**:

```
✓ flujo bipartito == fuerza bruta        (400 casos, 0 discrepancias)
✓ DP exacto == fuerza bruta              (200 casos, 0 discrepancias)
✓ búsqueda local ≈ DP exacto             (92.6% óptimos, solo casos factibles)

Restricciones duras (3 pares bloqueados, noche completa):
  v1 (estado de la técnica): 3 violaciones estructurales
  v2 (invención):            0 violaciones · 11/12 rondas factibles · cobertura 99.2%

Re-optimización intra-noche (no-show): 0 pares repetidos · cobertura 93.3%
Rendimiento: plan bipartito 12+12×9 = 1 ms · plan general 20 personas = 17 ms
```

## 4.1 Prueba de existencia (RESERVA — no publicado)

Se puede generar un timestampeo on-chain del presente documento **sin publicar el contenido**
(el material permanece privado; el secreto comercial queda intacto):

- **Contrato:** `contracts/ProvenanceRegistry.sol` — solo guarda keccak256(hash) + timestamp, nunca el contenido.
- **Script:** `scripts/register-proof.cjs` — en modo reserva imprime el hash; para registrar on-chain
  requiere `RONDA_PRIVATE_KEY` + `POLYGON_RPC` + `REGISTRY_ADDRESS`.
- **Cómo se usa:** cuando este documento esté **congelado** (fechas/firmas finales), se ejecuta
  `node scripts/register-proof.cjs` para obtener el hash definitivo y, si se desea, registrarlo en
  Polygon. Al congelarse el contenido, el hash se estabiliza (no se incrusta aquí para evitar un
  auto-referencia circular).
- **Estado:** reserva. No se ha desplegado ni publicado nada.

## 5. Estado de la técnica conocido (prior art)

- Round-robin de torneo y método del círculo (siglos de antigüedad) — **no reivindicable**.
- "Bye"/fantasma de torneo — **no reivindicable**.
- Matching ponderado: Edmonds' Blossom (1965), min-cost flow — **no reivindicable como tales**.
- La combinación específica (memoria con decaimiento + calidad, re-optimización ante sensores,
  fantasma como recurso optimizado, cierre por infeasibilidad, fairness max-min) no se ha encontrado
  en la búsqueda preliminar; **búsqueda formal de anterioridad pendiente con el agente**.

## 6. Reivindicaciones preliminares (resumen)

Ver bosquejo en `docs/ip-patent-strategy.md` §3 (Claims 1–6): sistema de programación de encuentros
con matriz de colisiones ponderada por recencia, optimizador de emparejamiento con recurso fantasma,
motor de restricciones en tiempo real ante eventos de check-in, e interfaz de salida con
instrucciones de transición física.

## 7. Gestión de la divulgación (checklist)

- [x] Repo GitHub: verificado y **privado** (no hay divulgación pública del motor).
- [x] Retirar "patente pendiente" de la web/docs hasta tener número de solicitud.
- [ ] NDA firmado por todo el equipo y el local piloto.
- [ ] Confirmar este documento con firmas y fecha.

| Inventor | Firma | Fecha |
|---|---|---|
| | | |
| | | |

---
*Documento preparado como insumo para el agente de patentes. No constituye asesoría legal.*
