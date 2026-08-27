# Estrategia de Propiedad Intelectual — Motor MEM-RR v2

> **Proyecto:** RONDA · **Documento:** Estrategia de patente y protección de IP
> **Estado:** Plan de acción · **Confidencial** — no distribuir fuera del equipo legal/asesor.

---

## 0. Resumen ejecutivo

| Decisión | Recomendación |
|---|---|
| ¿Patentar el algoritmo v1 actual? | **No** — round-robin + bye + contador de colisiones es estado de la técnica (textbook), no novedoso. |
| ¿Patentar el motor v2? | **Sí** — enmarcado como *computer-implemented invention* con efecto técnico (re-optimización en vivo, reducción de transición física, asignación de recurso fantasma, fairness). |
| ¿Primera acción urgente? | **Auditoría de divulgaciones** (repo público, PDFs, docs) y cierre de la exposición pública. |
| ¿Primer filing? | **Provisional US** (bajo costo, fija prioridad 12 meses), seguido de PCT o filiación CO + US. |
| ¿Complemento? | **Secreto empresarial** sobre parámetros calibrados (α,β,γ,δ, λ), datos acumulados y flywheel. |
| ¿Acompañamiento? | **Agente de patentes** con experiencia en software/computer-implemented inventions (Bogotá). Este documento es insumo, no asesoría legal. |

---

## 1. Auditoría de divulgaciones (hacer HOY)

La novedad se destruye con la divulgación pública. Verificar y documentar:

| # | Activo | Riesgo | Acción |
|---|---|---|---|
| 1 | Repo GitHub `FruityLoopsDev/ronda-app` | **RESUELTO** — repo **privado** verificado | ✅ Repo privado (sin divulgación pública; no destruye novedad) |
| 2 | `ronda-files/` PDFs (marketing, Wompi, NFT) | Medio si circularon fuera del equipo | Inventariar destinatarios y fechas. |
| 3 | Docs del repo (`docs/*.md`, `CLAUDE_MIGRATION_GUIDE.md`) | Alto si el repo es público | Ídem #1. |
| 4 | Maquetas y simuladores HTML (`ronda-maqueta-CO.html`, `ronda-motor-rotacion.html`) | Alto si publicados | Ídem #1. |
| 5 | Afirmación "patente pendiente" en docs/web | **Sancionable** (marcado falso) si no hay solicitud presentada | Retirar la afirmación hasta tener un filing con número. |

**Períodos de gracia** (una divulgación del propio inventor NO destruye novedad si):

| Jurisdicción | Gracia | Condición |
|---|---|---|
| Colombia (Decisión 486 CAN, Art. 21) | 12 meses | Divulgación por el inventor o derivada de él, antes de la solicitud |
| EE. UU. (AIA, 35 USC 102(b)) | 12 meses | Ídem |
| Europa (EPO) | **0** | Novedad absoluta |

> **Conclusión:** si hubo divulgación pública del v1, la ventana de gracia en CO/US es de 12 meses desde
> la primera divulgación del inventor. No se puede recuperar el tiempo perdido; se fija prioridad lo antes posible.

---

## 2. Por qué el v2 es la materia patentable

### 2.1 Lo NO patentable del v1
- Round-robin de torneo (siglos de antigüedad), bye/fantasma de torneo, contador de colisiones,
  heurística de desplazamiento circular, método de negocio. Todo es estado de la técnica.
- Software "como tal" y métodos matemáticos están excluidos (Decisión 486, Art. 15; EPC Art. 52(2)).

### 2.2 Lo patentable del v2 (computer-implemented invention)
La elegibilidad depende de **efecto técnico** y de reivindicaciones redactadas como sistema/método
técnico, no como algoritmo abstracto. Elementos con efecto técnico defendible:

1. **Re-optimización en tiempo real** ante eventos de sensores (check-in QR, campana, detección de
   no-show): el sistema reconfigura el emparejamiento bajo restricciones cambiantes en < 500 ms.
2. **Reducción medible del tiempo de transición física** entre rondas mediante el grafo del local
   (el giro de 2 minutos es un límite físico del evento).
3. **Asignación optimizada del recurso fantasma** (silla de barra) como nodo del solver, con
   garantías de fairness (max-min) y alternancia de lado.
4. **Memoria con decaimiento temporal y calidad del encuentro** (curva de olvido), retroalimentada
   por los votos/matches post-evento (flywheel de datos).
5. **Restricciones duras de seguridad** (bloqueos, denuncias, no verificados) integradas en el solver.

---

## 3. Reivindicaciones sugeridas (bosquejo para el agente)

> Bosquejo preliminar para orientar al agente de patentes. No es texto legal final.

**Claim 1 (Sistema):**
> Un sistema informático para programar encuentros en un evento en vivo que comprende:
> - una memoria que almacena una matriz de encuentros con valores de colisión ponderados por recencia
>   y una calidad del encuentro previamente determinada;
> - un optimizador de asientos configurado para resolver, por cada ronda, un problema de
>   emparejamiento ponderado sobre un conjunto de participantes y al menos un recurso fantasma de
>   descanso, sujeto a un conjunto de restricciones duras;
> - un motor de restricciones en tiempo real configurado para recibir eventos de check-in de un
>   dispositivo sensor y para recomputar el emparejamiento de las rondas restantes en respuesta a
>   dichos eventos;
> - una interfaz de salida que emite asignaciones de mesa e instrucciones de transición física que
>   minimizan el tiempo de movimiento entre mesas.

**Claim 2 (Método):** el método correspondiente ejecutado por el sistema del Claim 1.

**Claim 3 (Fairness):** el sistema del Claim 1 donde el optimizador aplica un objetivo lexicográfico
max-min que minimiza el número máximo de re-encuentros por participante antes de maximizar el número
total de nuevos encuentros.

**Claim 4 (Memoria con decaimiento):** el sistema del Claim 1 donde los valores de colisión decaen
exponencialmente con el tiempo transcurrido desde el último encuentro y se reducen cuando el par tiene
una conexión mutua previamente establecida.

**Claim 5 (Recurso fantasma):** el sistema del Claim 1 donde el recurso fantasma se asigna mediante el
mismo problema de optimización y garantiza que ningún participante descansa más de una vez por evento y
que el descanso alterna entre lados.

**Claim 6 (Dependiente):** mesas de capacidad 2 y 4; grafo de distancias del local; priorización de
descanso por propensión de consumo.

---

## 4. Plan por fases

### Fase 0 — Inmediata (semana 1)
- [ ] Verificar y **privatizar** el repo GitHub.
- [ ] Inventario de divulgaciones con fechas (spreadsheet interno).
- [ ] **Invention disclosure** del motor v2 con fechas y firmas (cuaderno digital con timestamps:
      `docs/algorithm-v2-spec.md` ya registra la versión).
- [ ] Retirar "patente pendiente" de web/docs hasta tener filing.
- [ ] NDA con equipo, anfitriones y locales piloto.

### Fase 1 — Meses 1–2
- [ ] Completar implementación del motor v2 (`src/mem-rr-v2/`).
- [ ] Ejecutar suite de benchmarks (§6 del spec) y **guardar los resultados con fecha** — son la
      evidencia del efecto técnico (comparación cuantitativa v1 vs v2).
- [ ] **Provisional US** (tasa oficial ~USD 60–300; redacción con agente USD 2–6k): fija prioridad
      12 meses; cubre sistema + método + fairness + memoria + fantasma + room-aware.
- [ ] Registro de **marca RONDA** (SIC Colombia) y solicitud US en paralelo si hay presupuesto.

### Fase 2 — Meses 3–12
- [ ] Contratar agente de patentes especializado (Bogotá).
- [ ] Decidir: PCT (1 solicitud, ~USD 12–25k con fases nacionales) vs filiación directa CO + US.
- [ ] Reivindicar prioridad del provisional dentro de los 12 meses.
- [ ] **Derecho de autor** sobre código y documentación (Colombia: Dirección Nacional de Derecho de Autor).

---

## 5. La combinación patente + secreto empresarial

| Activo | Protección | Costo | Nota |
|---|---|---|---|
| Método central v2 (estructura, fairness, fantasma, room-aware) | **Patente** (provisional → CO/US) | USD 300 + honorarios | Publica el método a los 18 meses |
| Parámetros calibrados `α,β,γ,δ,λ` | **Secreto empresarial** | 0 (medidas internas) | Nunca publicar; restringir acceso |
| Historial real de encuentros (matriz de memoria acumulada) | **Secreto empresarial** + base de datos protegida | 0 | El dato es el moat operativo |
| Marca RONDA | Marca registrada | Bajo | SIC + USPTO |
| Código, docs, maquetas | Derecho de autor | Bajo | Registro nacional + depósito |

**Racional:** la patente publica *qué* hace el motor; el secreto protege *cómo* está calibrado y el
*dato* acumulado. Un competidor que lea la patente necesita meses de operación para replicar la calidad
de la memoria real — exactamente el foso que describe `ronda-logica-negocio-CO.md`.

---

## 6. Riesgos y advertencias

1. **Software patentable, pero no garantizado**: en EE. UU. el test *Alice/Mayo* rechaza algoritmos
   abstractos; por eso la redacción gira en torno al efecto técnico y a la interacción con dispositivos.
   Un agente especializado es imprescindible.
2. **Europa sin período de gracia**: si planeas expansión europea, no publiques nada del v2 antes del
   filing (ni este documento).
3. **Costos**: patente internacional completa (PCT + fases) puede superar USD 25k. Para la etapa MVP,
   provisional US + secreto empresarial + marca es la relación costo/beneficio correcta.
4. **No confundir copyright con patente**: el derecho de autor protege la *expresión* (código), nunca
   la *idea* o el método.
5. **Este documento no es asesoría legal**: validar todo con un agente de patentes habilitado ante la
   SIC y/o USPTO.

---

## 7. Checklist de ejecución

- [x] Repo GitHub privado (sin divulgación pública)
- [ ] NDA (equipo + local piloto)
- [ ] Inventario de divulgaciones
- [ ] Invention disclosure con fechas (v2)
- [ ] Benchmarks v1 vs v2 guardados (evidencia técnica)
- [ ] Provisional US — **borrador listo** (`docs/provisional-us-mem-rr-v2.md`); falta presentarlo (agente) y obtener número
- [ ] Marca RONDA (SIC) presentada
- [ ] Decisión PCT vs CO+US (mes 9–11)
- [ ] Retirado "patente pendiente" hasta tener número real
