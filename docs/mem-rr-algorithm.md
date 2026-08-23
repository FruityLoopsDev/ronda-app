# Algoritmo MEM-RR (Memory-Driven Round-Robin)

## Introducción y Propósito
El motor lógico **MEM-RR** (Memory-Driven Round-Robin) es el núcleo algorítmico y el principal foso defendible (moat) tecnológico de RONDA. 
Su objetivo es optimizar la rotación de citas rápidas (Speed Dating) en entornos B2B2C, mitigando los problemas tradicionales del modelo Round-Robin estándar (cruces repetidos, incompatibilidad de orientación).

> **Estatus de Propiedad Intelectual**: Este documento fundamenta la lógica estructural para reclamar patentabilidad a nivel de software e inteligencia de negocios.

## Formulación Matemática

El problema de emparejamiento por rondas en RONDA se modela como un problema de *Maximum Weight Matching* en grafos bipartitos (o grafos generales, dependiendo del mix de orientación sexual), resuelto heurísticamente ronda por ronda.

La función objetivo a maximizar en cada ronda es:

**`Max Σ ( Afinity(i, j) - C * Collision(i, j) )`**

### Variables del Modelo:

1. **`Afinity(i, j)` (Puntaje de Afinidad)**:
   - Se calcula en base a la compatibilidad dura (orientación sexual y género coincidente).
   - Variables blandas: Cercanía de edad, intereses comunes pre-registrados.
   - Retorna un valor escalar (ej. `0.5` a `1.0`). Si no son compatibles devuelve una penalidad extrema (`-999`).

2. **`Collision(i, j)` (Matriz Histórica de Colisiones)**:
   - Es una variable de estado que reside en memoria/base de datos.
   - Representa el número de veces que el participante `i` y el participante `j` ya se han sentado en la misma mesa durante el mismo evento (o eventos históricos).

3. **`C` (Coeficiente de Penalización)**:
   - Un peso ajustable (ej. `C = 2.0`). Garantiza que el costo de sentar a dos personas que ya se conocen supere cualquier afinidad potencial, forzando la novedad en la rotación.

## Implementación Heurística (Fase MVP)
Debido a la latencia requerida en eventos en vivo y recursos computacionales en el cliente:
- Los participantes se dividen en subgrupos.
- Se evalúan combinaciones circulares `d` (desplazamientos de índice) entre los grupos `A` y `B`.
- Por cada iteración de desplazamiento, se calcula el `Weight = Afinity - (C * Collision)`.
- Se selecciona el estado de combinaciones que posea el `Weight` acumulado más alto para todo el grupo.

## Registro y Retroalimentación
Al finalizar una ronda, el orquestador (`bar.js`) invoca la función `recordRound(matches)`, la cual incrementa el índice `Collision(i, j)` en +1 para todos los emparejamientos activos, influyendo matemáticamente en las siguientes rondas.
