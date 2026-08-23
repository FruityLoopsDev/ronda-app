# RONDA — Lógica completa de negocio y producto

**Qué es:** eventos de citas rápidas de 90 minutos operados dentro de bares y gastrobares, exclusivamente de martes a jueves.
**Por qué existe:** un bar de barrio factura entre un 20 % y un 30 % de su semana en días valle con la misma estructura de costes fijos. RONDA compra ese hueco y lo revende lleno.
**Doble sentido del nombre:** una ronda es una vuelta de bebidas y una vuelta de citas.

---

## 1. Los tres actores

| Actor | Qué aporta | Qué recibe | Qué le duele hoy |
|---|---|---|---|
| **Usuario (C)** | Entrada de 12–18 € | Una noche con 9 personas reales, sin swipe | Las apps no acaban en citas reales |
| **Local (B)** | Sala vacía + barra | Consumo garantizado en su peor día, sin coste de captación | Martes muertos con el mismo alquiler |
| **RONDA** | Demanda, formato, riesgo | Margen sobre la entrada | — |

La clave B2B2C: **el local nunca paga una factura**. Cobra por consumición servida. Nosotros asumimos el riesgo de llenar a cambio de un precio de barra cerrado. Eso convierte la venta B2B de \"publicidad\" (difícil) en \"sala llena garantizada\" (fácil).

---

## 2. Modelo de ingresos

### Línea principal — entrada del usuario
- Entrada media ponderada **15 €** (martes 12 € → jueves 18 €), incluye 1ª consumición.
- Del ticket: **6 € al local** (consumición pactada en escandallo, coste real ≈ 2,10 €), **0,48 € pasarela**, **8,52 € contribución bruta**.

### Economía de un evento (24 asistentes)

| Concepto | € |
|---|---|
| 24 entradas × 15,00 | 360,00 |
| Consumiciones al local (24 × 6) | −144,00 |
| Pasarela | −11,50 |
| Anfitrión de sala (3 h) | −70,00 |
| Material y logística | −5,00 |
| **Margen de contribución** | **129,50** |

**Punto muerto: 16 asistentes.** Por debajo se cancela: perder 130 € de margen es más barato que quemar la reputación con una sala fría.

### Escala de una ciudad
12 locales × 3 noches = 36 eventos/semana ≈ **4.662 €/semana** de contribución. Con estructura de ciudad de 9.400 €/mes (city manager, marketing local, soporte), margen ≈ **9.250 €/mes**.

Unidad de expansión: **el barrio**. Un anfitrión cubre 3 eventos/semana; un city manager, 12 locales.

### Líneas secundarias
1. **RONDA para locales (SaaS)** — 149 €/mes + 2 €/asistente. El local monta sus propias noches con nuestro motor de rotación, check-in y matching.
2. **Datos de afluencia valle por barrio** — informe trimestral para grupos de restauración.
3. **Patrocinio de noche** (vermut, cerveza artesana) sobre inventario ya vendido.

---

## 3. La regla que sostiene todo: el equilibrio de lados

Un evento de citas rápidas descuadrado es un producto roto. Por eso:

- **Ratio máximo 1,2 : 1** entre lados. Al superarlo se cierra la venta del lado sobrante y se abre lista de espera.
- **Mínimo 9 + 9** para confirmar. Decisión a **T-48 h**.
- **Precio asimétrico por escasez**: el lado deficitario baja de precio (hasta 12 €), el excedente sube (hasta 18 €). El precio equilibra la sala; la publicidad no llega a tiempo.
- Si no cuadra: cancelación, devolución íntegra y **5 € de saldo** + recolocación automática en otra noche de la misma semana.

**Estados del evento:** Abierto → Casi lleno → Confirmado (T-48 h) → En curso → Cerrado · o bien → Cancelado.

---

## 4. Lógica de asignación: el usuario compra una noche, no un local

El usuario elige **día + tramo de edad + barrio**. El local se le asigna al confirmarse el evento.

Esto nos da la palanca operativa más valiosa: **podemos mover la demanda al bar que más nos conviene llenar** (el que va flojo, el que renueva contrato, el que tiene mejor margen), sin canibalizar el resto de la red.

**Segmentación por día**, para no saturar el mismo público:
- **Martes** — 25–34, afterwork, tarifa baja.
- **Miércoles** — 35–49, formato mesas de 4, ritmo más lento.
- **Jueves** — temáticas (vinos, cine, running, LGTBIQ+, monoparentales). Es el día más cercano al fin de semana: mayor demanda y tarifa alta.

---

## 5. La noche: formato y algoritmo de rotación

**Estructura (90 min):**
1. `19:40–19:55` Check-in con QR en barra. Se entrega **la comanda**: mesa de salida, ruta y consumición.
2. `20:00` Arranque. **9 rondas × 6 min**, campana + 2 min de rotación.
3. `21:30` Fin del formato. La barra sigue abierta (aquí está el consumo extra del local).

**Algoritmo:**
- Con n + n asistentes se genera un **round-robin tipo torneo**: un lado permanece fijo en mesa, el otro rota +1 posición cada ronda. Garantiza que cada persona vea a todo el lado contrario sin repetir.
- **Lados impares** → asiento fantasma: el sobrante hace **ronda de barra** (descanso de 6 min con consumición). El hueco rota; nadie descansa dos veces.
- **Memoria de encuentros**: antes de fijar la rotación se resuelven choques contra el historial. Si dos personas ya coincidieron en otra noche, se intercambian mesas de salida.
- **Mesas de 4** → formato 2 + 2 con rotación por parejas. Menos presión; funciona mejor en 45+.

**Voto:** sí / no / quizá dentro de la app durante la ronda, editable hasta las 10:00 del día siguiente. Nunca visible para la otra persona.

---

## 6. Matching y el bucle de retorno al local

- Los matches se abren **al día siguiente a las 10:00** (crea un pico de apertura de app y evita el juicio en caliente).
- El chat **caduca a las 72 h** sin mensaje. La escasez fuerza la cita real.
- Cada match recibe un **-25 % para volver a ese mismo local, de martes a jueves**.

Esto es el argumento de venta que ningún competidor tiene: **el local no llena una noche, adquiere clientes recurrentes en días valle.** Métrica dedicada: *citas de vuelta por evento* (objetivo ≥ 18 %).

---

## 7. Anti no-show (el mayor riesgo operativo)

- Pago íntegro por adelantado; la entrada **es** la consumición.
- Check-in con QR en barra.
- **Sistema de strikes:** 1 no-show = pierdes la entrada; 2 en 90 días = 30 días de bloqueo; 3 = baja definitiva.
- Cancelación gratuita hasta T-48 h (antes de confirmar la sala); después, saldo del 50 %.
- **Sobreventa controlada del 8 %** con lista de espera activada por SMS a T-4 h.
- Al local se le garantiza un mínimo de consumiciones aunque falte gente: **el riesgo de llenado lo asumimos nosotros**, y eso es justo lo que nos permite negociar el precio de barra.

---

## 8. Confianza y seguridad

- Verificación con **selfie + documento** antes de la primera noche.
- Cero datos de contacto hasta que hay match mutuo.
- Anfitrión formado presente toda la noche.
- **Palabra clave en barra** pactada con el personal del local para salir de una situación incómoda sin dar explicaciones.
- Botón de reporte en un toque. Expulsión inmediata, sin reembolso, y bloqueo cruzado en toda la red.
- Código de conducta aceptado en cada compra.

---

## 9. El contrato con el local

| Cláusula | Condición |
|---|---|
| Compromiso | 3 meses renovables |
| Exclusividad en días valle | 500 m a la redonda |
| Precio de la consumición | Cerrado en escandallo, revisable cada trimestre |
| Cancelación con < 72 h | Penalización de 150 € |
| Aforo reservado | Mínimo 12 mesas de 2 o 6 de 4 |
| Formación | 1 sesión con el personal de sala |
| Datos | El local recibe informe mensual de su ocupación valle |

Siempre hay **un local suplente por barrio** activado como plan B.

---

## 10. Métricas que gobiernan

| Métrica | Objetivo |
|---|---|
| Llenado del evento | ≥ 85 % |
| Ratio de balance de lados | 1,00 – 1,15 |
| No-shows | < 8 % |
| Consumo medio por asistente | > 18 € |
| Matches por persona | ≥ 2,5 |
| Citas de vuelta al local | ≥ 18 % |
| Repetición de usuario a 90 días | ≥ 35 % |
| Contribución por evento | ≥ 130 € |
| CAC usuario / LTV | < 12 € / > 45 € |
| Retención de locales a 6 meses | ≥ 80 % |

---

## 11. Riesgos y mitigación

1. **Lado escaso crónico.** Es el riesgo número uno de cualquier producto de citas de pago. Mitigación: precio asimétrico automático, captación segmentada por canal y embajadoras con entradas gratis los primeros meses. Nunca descuentos generales: hunden el precio de los dos lados.
2. **Dependencia del anfitrión.** Guion cerrado, formación de camareros del local como sustitutos.
3. **Local que cancela o cierra.** Penalización contractual + suplente por barrio.
4. **Estacionalidad.** Agosto y Navidad se reconvierten en formatos de amigos, afterworks de empresa y cenas temáticas.
5. **Copia por parte del local.** Se mitiga con exclusividad, con la red de demanda (que no es replicable con un solo bar) y con la línea SaaS: si quieren hacerlo solos, se lo vendemos.
6. **Reputación por un incidente.** Protocolo de seguridad, seguro de responsabilidad civil y respuesta en menos de 24 h.

---

## 12. Gestión de riesgos del modelo de garantía

**El riesgo verdadero:** la garantía de llenado que ofrecemos al local es el eje central de nuestra propuesta de venta, pero tiene un coste operativo que debe ser gestionado activamente. Cancelar un evento es mucho más caro que sobre-garantizarlo.

### Análisis de costes

**Caso 1: Garantía operada (20 consumiciones al bar, mín. 16 asistentes)**
- Evento con 24 asistentes: beneficio esperado de 129,50 € por contribución.
- Evento con 16 asistentes (punto muerto): 16 × 15 € = 240 €; 16 × 6 € al bar = 96 €; costes fijos = 75 €. Margen = 69 €.
- Evento con 14 asistentes: pérdida de 15 €. No llega al mínimo garantizado al local.
- Sobreventa del 8 % (1–2 personas esperables en lista de espera): costo adicional del 1–2 % en consumiciones.
- **Costo promedio de operar la garantía: 44 € – 88 € por evento (3–4 % de margen).**

**Caso 2: Cancelación**
- Devolución íntegra de entradas: 16 × 15 € = 240 €.
- Crédito de saldo al cliente (5 € × 16): 80 €.
- Lucro cesante (margen perdido que se habría generado): 130 €.
- Impacto en reputación y retención local (contacto, explicación, rescate).
- **Costo total de cancelación: 450 € – 480 € directos + margen perdido (130 €+) = 580 € – 952 €.**

**Conclusión:** Asumir el costo de la garantía es **10 veces más barato** que cancelar. La garantía **no es un riesgo**, es el diferenciador competitivo que vende la sala.

### 5 palancas operacionales

#### 1. **Confirmación a T-48 h (costo: 0 €)**
Decisión de confirmar o cancelar el evento a las 48 horas antes del inicio. Si hay ≥ 9 + 9 inscritos, se confirma. Si hay < 9 en uno de los lados, se cancela inmediatamente con devolución íntegra.

- **Beneficio:** cierra la venta de la sala, permite al local hacer camarero. Reduce incertidumbre.
- **Impacto:** evita que se acumule demanda sin certeza. Zero costo operativo.
- **Regla:** aplicar siempre, es no negociable.

#### 2. **Recolocación antes que reembolso (costo: 0 € cash, −5 € reputación)**
Si un evento cae por debajo del mínimo a T-48 h, **primero intentamos reasignar a los inscritos a otra noche de la misma semana** del mismo barrio.

- **Lógica:** esos usuarios ya compraron experiencia de RONDA. La recolocación automática (avisada por SMS + app) preserva el valor: evita 240 € de devolución + 80 € de crédito de saldo.
- **Ejecución:** trigger automático a T-48 h. Si hay otra noche el mismo barrio con cupo disponible, recolocar antes de comunicar cancelación.
- **Impacto:** reduce cancelaciones en cascada. Mantiene el consumo en la red local. Los usuarios que no aceptan la recolocación reciben el reembolso íntegro.
- **Regla:** aplicar siempre como primer paso. Reembolso solo como último recurso.

#### 3. **Garantía en banda (18–24 asistentes, +2 % margen)**
El local reclama un mínimo de 20 consumiciones, pero nosotros podemos ofrecer una banda de garantía: le compramos entre 18 y 24 asistentes.

- **Mecánica:** si el evento lleva 14–17 inscritos a T-48 h, ofrecemos al local **rellenar con consumo de barra** (sin personas vivas, pero con copas consumidas y facturadas).
- **Costo:** 6 € × (diferencia hasta 20) = máximo 36 €. Margen del evento cae a 93 €.
- **Beneficio:** el local nunca ve un salón vacío. Nosotros asumimos la volatilidad en place of the buyer.
- **Regla:** solo si el evento está estructuralmente débil (lado deficitario crónico, local nuevo, fin de mes). Máximo 1–2 veces por local y trimestre, para evitar acostumbramiento.

#### 4. **Auto-recolocación con incentivo (recolocación en bloque a otro local, −10 % entrada)**
Si dos eventos del mismo barrio caen simultáneamente, consolidar a ambos en un único local.

- **Mecánica:** mergear 12 + 12 de una noche con 8 + 10 de otra. El local de acogida recibe la sala llena; el local cancelado recibe 150 € de penalización contractual.
- **Usuarios:** aviso de cambio de local 24 horas antes. Aceptación voluntaria (opción de reembolso). Los que aceptan reciben −10 % en la entrada como compensación por el cambio.
- **Beneficio:** preserva ingresos. Mantiene satisfacción del local con contrato. Reduce reembolsos.
- **Regla:** solo como último recurso antes de cancelación. Máximo 1 merge por barrio por semana.

#### 5. **Patrocinio y sponsor como hedge (−2 € / entrada, + 8 € margen)**
En épocas de demanda débil (julio, agosto, fin de año), ofrecemos a marcas emblemáticas (vermut, cerveza artesana, destilados) **patrocinar la noche**: sponsorizan 20–30 € por evento y nosotros bajamos la entrada de usuario 2 € (12 → 10 €, 18 → 16 €).

- **Costo neto:** perdemos 2 € de entrada per cápita, ganamos 20–30 € de patrocinio. Beneficio: +18 € – +28 € por evento sin asumir sobreventa.
- **Beneficio:** reduce volatilidad en meses estacionales. Genera ingresos de terceros.
- **Ejecución:** necesita coordinación de city manager + equipo de partnerships. No es automática.
- **Regla:** activar en Q3 (agosto) y Q4 (Navidad) de forma preventiva.

### Árbol de decisión (T-48 h, confirmación del evento)

```
¿Inscritos ≥ 9+9?
├─ SÍ → confirmar (costo: garantía de 0–88 € si cae a 16)
└─ NO → 
   ├─ ¿hay otro evento en el barrio con cupo?
   │  ├─ SÍ → recolocación automática (costo: 0 € cash)
   │  └─ NO → 
   │     ├─ ¿evento estructuralmente débil (último mes, local nuevo)?
   │     │  ├─ SÍ → ofrecer garantía en banda 18–24 (costo: 36 € máx)
   │     │  └─ NO →
   │     │     ├─ ¿hay otro evento débil similar en el mismo barrio?
   │     │     │  ├─ SÍ → mergear + auto-recolocar (costo: −150 € del local cancelado)
   │     │     │  └─ NO → cancelar + reembolsar (costo: 450–950 €)
   │     └─ Si estamos en Q3/Q4:
   │        └─ ¿tenemos sponsor activo?
   │           ├─ SÍ → reducir entrada, activar sponsor (costo: −2 € entrada, +20 € sponsor)
   │           └─ NO → activar sponsor preventivamente para próximos eventos
```

### Impacto en margen y satisfacción del local

| Escenario | Costo | Margen neto | Satisfacción local |
|---|---|---|---|
| Evento lleno (24+) | 0 € | 129,50 € | ✓✓✓ Máxima (sala llena) |
| Garantía estándar (16–23) | 44–88 € | 41–85 € | ✓✓ Alta (mínimo garantizado) |
| Recolocación (usuario trasladado) | 0 € | 129,50 € | ✓✓ (se mantiene otro evento del local) |
| Garantía en banda (18–24 con relleno) | 36 € | 93–129 € | ✓✓ (nunca ve vacío) |
| Sponsor (reducción entrada) | −2 € entrada, +20 € sponsor | 137–147 € | ✓✓ (entrada de marca) |
| Cancelación (último recurso) | 450–950 € | Negativo | ✗ Nula (desconfianza) |

---

## 13. Primeros 90 días

- **Días 1–15** — 4 locales de **un solo barrio**, contrato de 3 meses. Escandallo cerrado.
- **Días 16–45** — 12 eventos operados a mano (formulario + pasarela + WhatsApp) para calibrar rotación, duración de ronda y elasticidad de precio. Cero desarrollo.
- **Días 46–90** — app mínima: compra, comanda con QR, rotación en vivo y matching. Escalar a 12 locales del mismo distrito.

**Regla de expansión: densidad antes que cobertura.** Un barrio lleno vale más que tres ciudades a medias, porque el equilibrio de lados solo se sostiene con masa local.
