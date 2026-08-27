# MEM-RR v2 — Especificación del Motor de Rotación con Memoria Mejorado

> **Proyecto:** RONDA · **Documento:** Especificación técnica del motor v2
> **Estado:** Diseño validado · **Autor:** Equipo RONDA
> **Relación con IP:** Este motor es la materia objeto de la solicitud de patente (ver `docs/ip-patent-strategy.md`).

---

## 1. Objetivo

Sustituir el motor MEM-RR v1 (offsets greedy + matriz binaria de colisiones) por un motor de
**emparejamiento ponderado con restricciones** (Weighted Matching with Memory, **WMM**) que:

1. Maximice explícitamente un objetivo de valor por ronda y por noche completa.
2. Incorpore memoria con **decaimiento temporal** (curva de olvido) y **calidad del encuentro**
   (match / no-match), no solo un contador.
3. **Re-optimice en vivo** entre rondas ante eventos de sala (no-show, tardanza, salida, safeword).
4. Trate la **silla de barra como un recurso optimizado** (quién descansa, cuándo, alternando lados).
5. Respete **restricciones duras de negocio** (orientación, bloqueos, parejas, formato de mesa, edad).
6. Sea **consciente de la geometría del local** para minimizar el tiempo de transición entre rondas.
7. Garantice **fairness** (max-min) y produzca **métricas auditables** para la línea SaaS.
8. Generalice a **mesas de 2 y de 4** (formato 2+2 para el segmento 45+).

---

## 2. Modelo formal

### 2.1 Entidades

| Entidad | Definición |
|---|---|
| `Participante p` | `{ uid, nombre, genero, orientacion, edad, verificado, intereses[], senales[] }` |
| `Lado` | Grupo de participantes que permanece fijo (`A`) o rota (`B`) en la noche |
| `Mesa t` | Recurso físico con `capacidad` (2 ó 4), posición en el grafo del local |
| `Silla de barra` | Recurso fantasma (`ghost`) que representa el descanso; es un nodo dummy |
| `Historial H` | Matriz/colección persistente de encuentros: `{ i, j, timestamps[], matches[], rechazos[] }` |
| `Grafo del local G` | Distancias caminables entre mesas (o entre posiciones de rotación) |

### 2.2 Problema de una ronda

Dado el conjunto de participantes `P` (con `|P|` par; si es impar, se inserta el nodo fantasma de barra),
construir un **emparejamiento perfecto** `M` (cada participante asignado a exactamente una mesa junto a
un compañero, o al descanso) que maximice:

```
Max  Σ_{(i,j) ∈ M} w(i,j)
s.a. M es emparejamiento perfecto sobre P ∪ {ghost}
     H(i,j) = -∞  para todo par que viole una restricción dura
     fairness: no más de 1 descanso por persona por noche
```

### 2.3 Función de peso de pareja

```
w(i,j) = α·A(i,j) + β·F(i,j) − γ·R(i,j) − δ·D(i,j)   con α,β,γ,δ ≥ 0 (calibrables)
```

| Componente | Fórmula | Semántica |
|---|---|---|
| **Afinidad** `A(i,j)` | `A = base_compatible · (1 + ΔEdad) · (1 + ΔIntereses) · (1 + ΔSeñal)` | Compatibilidad dura (orientación/género) + blandas (edad, intereses declarados, micro-sondeos de Signals). `base_compatible = 1` si `orientacion(i)` acepta `genero(j)` y viceversa; si no, la restricción dura la hace `-∞`. |
| **Frescura** `F(i,j)` | Si se conocen: `F = 1 − exp(−λ · Δdías_último_encuentro)`; si nunca se vieron: `F = 1`. Con `λ ≈ 0.02–0.05 /día` | **Curva de olvido**: un cruce reciente reduce la novedad (`F → 0` si fue ayer); con el tiempo la novedad se recupera (`F → 1`). Pares que nunca se vieron tienen frescura máxima. |
| **Repetición** `R(i,j)` | `R = Σ_n exp(−λ·Δdías_n)` sobre todos los encuentros históricos; `R *= 0.3` si el par tuvo **match mutuo** (ya tienen canal) | Penaliza volver a sentar a personas ya conocidas, ponderando por recencia; reconoce que un match ya consumado no necesita refuerzo. |
| **Distancia** `D(i,j)` | `D = dist(mesa(i), mesa(j)) / dist_máx` (grafo del local) | Penaliza transiciones largas del Lado B en el giro de 2 minutos. `δ = 0` si no hay plano del local. |

**Decaimiento recomendado:** `λ = ln(2)/30 ≈ 0.0231` (media-vida de 30 días): un encuentro de hace
2 semanas pesa la mitad que uno de ayer; uno de hace 3 meses, ~1/8.

### 2.4 Restricciones duras (`H(i,j) = -∞`)

1. **Incompatibilidad de orientación**: `A(i,j)` no compatible.
2. **Bloqueos y denuncias**: cualquiera de los dos bloqueó o denunció al otro.
3. **Pareja que asiste junta**: no se sientan juntos en la 1ª ronda (y, si se indica, nunca en la noche).
4. **No verificado**: solo se empareja con verificados si el evento lo exige.
5. **Rango de edad del evento** (p. ej. 25–34): fuera de rango → `-∞`.
6. **Ya se conocieron esta noche**: en la ronda actual y siguientes (se alimenta dinámicamente).
7. **Capacidad de mesa**: el par debe caber en una mesa (formato 2 ó 4).

---

## 3. Algoritmos

### 3.1 Solver de ronda

| Caso | Modelo | Algoritmo | Complejidad |
|---|---|---|---|
| Lados separados (formato estándar A/B) | Grafo **bipartito** `A × B` + nodo fantasma | **Min-Cost Max-Flow** (caminos de aumento con SPFA) — *implementado y validado* | `O(V · E · log V)` ≈ ms para V ≤ 40 |
| Lado único (todos contra todos, noches temáticas/LGTBIQ+) | Grafo **general** | **DP exacto por subconjuntos** para n ≤ 18 (*implementado y validado*) · **búsqueda local multi-arranque** (greedy + 2-opt) para n > 18 (*implementada*) · **Edmonds' Blossom ponderado** como upgrade exacto de producción (*planificado*) | DP `O(2ⁿ·n)` · LS casi-óptima |
| Mesas de 4 | Grafo bipartito por **bloques** (2+2) | Rotación por bloques (offsets sobre bloques) — *implementado y validado* (M4) | `O(B²·C²)` con B bloques, C personas/bloque |

**Nota de implementación:** ambos solvers se validan contra **fuerza bruta** (enumeración de todas las
permutaciones) para `n ≤ 8` en la suite de pruebas (ver §6).

### 3.2 Planificador de noche completa (secuencia de rondas)

En lugar de elegir `R` offsets sueltos, el planificador resuelve la secuencia:

```
Max  Σ_{r=1..R} Σ_{(i,j) ∈ M_r} w_r(i,j)
s.a. M_r perfecto en ronda r
     ningún par real se repite dentro de la noche (restricción dura dinámica)
     descansos: cada persona descansa como máximo una vez (si hay barra)
```

**Método:** construcción greedy sobre permutaciones de offsets (estructura latina) + **búsqueda local
2-opt / simulated annealing** sobre el orden de las rondas. Para `R, m ≤ 12` el espacio es pequeño y la
solución es prácticamente óptima; si se desea exactitud formal se usa ILP (documentado, no embebido).

### 3.3 Re-optimización en vivo

- **Disparadores:** check-in por QR (ingreso), no-show detectado en barra, salida anticipada, safeword,
  llegada tardía, confirmación de sala.
- **Comportamiento:** recalcular `M_r` y las rondas restantes con la restricción dura "ya se conocieron
  esta noche" y el nuevo conjunto de participantes.
- **Presupuesto:** `< 500 ms` por recomputación en hardware móvil (objetivo de la especificación).

### 3.4 Silla de barra como recurso optimizado

- El nodo fantasma entra **dentro del solver** (no es una corrección posterior).
- El optimizador decide quién descansa en cada ronda, sujeto a: nadie descansa dos veces (primero se
  agotan todos), y **alternancia de lado** (si el formato lo permite) para que el descanso no recaiga
  sistemáticamente sobre un mismo género.
- Opcional: el descanso favorece a participantes con mayor propensión de consumo (la barra vende
  mientras descansan).

### 3.5 Fairness (objetivo lexicográfico max-min)

El solver de noche completa maximiza, **en orden de prioridad**:

1. `máx_i (repeticiones_i)` → **minimizar** (nadie se cruza dos veces con un conocido si se puede evitar).
2. `Σ_i (caras nuevas_i)` → maximizar.
3. `máx_i (descansos_i)` → minimizar (≤ 1 por noche).
4. `Σ distancias_i` → minimizar (transiciones).

---

## 4. Métricas de instrumentación (panel SaaS)

| Métrica | Definición | Objetivo |
|---|---|---|
| `Freshness rate` | Caras nuevas / encuentros totales por persona | ≥ 95 % |
| `Max repeats` | Máximo de cruces repetidos con historial por persona | ≤ 0 con memoria calibrada |
| `Cobertura` | % del lado contrario conocido al final de la noche | 100 % |
| `Gini descansos` | Desigualdad en número de descansos | 0 |
| `Distancia media/giro` | Metros caminados por persona en transición | mínima (según plano) |
| `Tiempo re-optimización` | ms desde el evento de sala hasta nuevo plan | < 500 ms |
| `Matches por persona` | Post-evento, retroalimenta la matriz de memoria | ≥ 2,5 |

---

## 5. Persistencia de la memoria (requisito de producción)

El historial `H` debe persistirse para que la memoria sea real (hoy v1 la fabrica con PRNG):

```
users/{uid}/encounters/{otherUid}  →  { n: int, lastAt: timestamp, match: bool, block: bool }
```

- Escritura transaccional al final de cada ronda (o batch al final del evento).
- Lectura al iniciar el planificador de la noche.
- `block: true` se trata como restricción dura.
- Privacidad: el historial es del operador (RONDA), no expuesto entre usuarios; agregado/anonimizado
  para la Línea 3 (informes) y Signals.

---

## 6. Plan de validación (benchmark)

Suite reproducible (script `src/mem-rr-v2/bench.ts`):

1. **Correctitud de solvers** — fuerza bruta vs flow vs blossom para `n ∈ {2,4,6,8}` (500 seeds).
2. **v1 vs v2 en igualdad de condiciones** — mismo historial fabricado (PRNG con semilla), mismo `n`:
   - repeticiones totales, repeticiones máx/persona, caras nuevas, Gini de descansos.
3. **Robustez a perturbaciones** — simular 3 no-shows antes de la ronda 3: cobertura final y
   repeticiones del v2 re-optimizado vs v1 sin re-planificación.
4. **Rendimiento** — tiempo medio por ronda para `n = 10..20` mesas (target < 500 ms).

> **Resultados ejecutados (evidencia técnica):** `docs/bench-results/bench-2026-08-27.md` — ✅ BENCH OK, commit `98b5b68`.

---

## 7. Roadmap de implementación

| Hito | Contenido | Entregable | Estado |
|---|---|---|---|
| M1 | Módulo `src/mem-rr-v2/` + benchmark | `engine.ts` con API documentada | ✅ Hecho |
| M2 | Persistencia de `H` (adaptador `src/mem-rr-history.ts`) + hook en `bar.ts` (HostConsole) con fallback v1 y re-planificación intra-noche (`alreadyMet`) | Memoria real + consola del anfitrión | ✅ Hecho |
| M3 | Suscripción en vivo del cliente al evento Firestore (`client.ts`) + re-optimización al cambiar la composición (host) + check-in por QR (escáner `html5-qrcode` en host, QR real en cliente) | Flujo cliente↔host completo | ✅ Hecho |
| M4 | Grafo del local (`δ·D`, validado) + modo mesas de 4 (2+2) en el motor | Room-aware + formato 45+ | ✅ Hecho |
| M5 | Panel de métricas del motor en el dashboard del anfitrión (`bar.ts`) | Métricas auditables | ✅ Hecho (panel host). El SaaS de analítica de afluencia (Línea 3) es un producto de datos separado, fuera del motor. |

---

## 8. Referencias

- v1 canónico: `ronda-files/ronda-motor-rotacion.html`, `src/bar.ts`, `src/ronda-core.ts`.
- Modelo matemático v1: `docs/mem-rr-algorithm.md`.
- Estrategia de IP: `docs/ip-patent-strategy.md`.
