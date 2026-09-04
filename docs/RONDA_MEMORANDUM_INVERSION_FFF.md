# RONDA — Memorando de Inversión (Micro-Ronda FFF)

> **Documento Oficial para Inversionistas · Ronda Friends, Family & Founders**  
> **Fecha:** Septiembre 2026 · **Sede Inicial:** Bogotá, Colombia (Zona G & Quinta Camacho)  
> **Estado de la Plataforma:** 100% Desplegada, Auditada y Operativa (`https://ronda.uno`)  
> **Coste de Servidores:** $0 USD/mes (Arquitectura Serverless-Free en Firebase Spark)

---

## 1. Resumen Ejecutivo (Executive Summary)

**RONDA** es la plataforma B2B2C de reactivación comercial para bares y gastrobares de Bogotá mediante experiencias de citas rápidas (*speed dating*) de 90 minutos para solteros profesionales de alto valor (25–45 años).

* **El Problema del Consumidor:** El colapso del modelo de apps de citas tradicionales (Tinder/Bumble *burnout*: perfiles falsos, semanas de chat inconducente, superficialidad y *ghosting*).
* **El Problema del Bar:** Capacidad ociosa masiva los días valle (miércoles y jueves), con mesas vacías y costos fijos de personal intactos.
* **La Solución RONDA:** 24 asistentes con perfil profesional y biometría verificada se sientan en un gastrobar aliado. En 90 minutos viven 9 citas presenciales de 6 minutos, orquestadas por el algoritmo patentable **MEM-RR v2** (cero colisiones, memoria de encuentros previos y balance de afinidad).
* **Oportunidad de Inversión:** Levantamiento de **$8.000.000 COP** en formato de deuda ágil a 90 días (o SAFE convertible) para financiar el despliegue de los primeros 12 eventos piloto en Bogotá.

---

## 2. Ficha Técnica de la Micro-Ronda FFF

| Parámetro | Detalle de la Oferta |
| :--- | :--- |
| **Monto Objetivo** | **$8.000.000 COP** (~$2.000 USD) |
| **Monto Mínimo por Ticket** | **$1.000.000 COP** (Opción 1 Ticket: $2.000.000 COP) |
| **Estructura Principal (Deuda)** | **Pagaré a 90 días con retorno del 9% de interés fijo** (36% E.A. equivalente). Cero dilución de capital. |
| **Estructura Alternativa (Equity)** | **SAFE Post-Money** con Valuation Cap de **$1.500.000 USD** y 20% de descuento para la ronda Seed institucional. |
| **Garantía y Respaldo** | Flujo de caja directo de la venta de boletería de los 12 eventos piloto garantizados en contrato con sedes aliadas. |
| **Cierre de la Ronda** | Inmediato (Primeros compromisos confirmados para desembolso). |

---

## 3. Ventajas Competitivas y Blindaje Tecnológico

A diferencia de un proyecto en fase de idea, RONDA llega a esta ronda con el **100% del desarrollo de software concluido y auditado**:

1. **Algoritmo Propietario MEM-RR v2 (Memoria y Optimización Combinatoria):**
   - Resuelve el problema matemático de rotación en grafo bipartito y general.
   - **0% colisiones:** Garantiza matemáticamente que nadie repita pareja en la misma noche ni con personas conocidas de eventos previos (`recency penalty` $\gamma \cdot R$).
   - Soporte exclusivo para mesas de 4 personas (M4) y re-planificación en caliente ante *no-shows*.
   - Evaluado y certificado con suite de benchmarking automatizada: `node src/mem-rr-v2/bench.ts` (100% test passed).

2. **Cero Costo Operativo de Software ($0 Burn Rate en Servidor):**
   - Arquitectura optimizada para operar sin Cloud Functions ni servidores costosos.
   - Acreditación de pagos vía Nequi/Daviplata QR y validación por escaneo en puerta (`view-admin`).
   - Matching autónomo en cliente anfitrión con batch writes atómicos en Firestore.
   - Chats temporales de 72 horas con autodestrucción y expiración lógica por reglas de seguridad.

3. **Verificación de Identidad Rigurosa (KYC y Anti-Catfish):**
   - Validación biométrica facial local con Face-API en el navegador del usuario.
   - Sincronización con perfil verificado de LinkedIn para garantizar solteros con solvencia profesional y seguridad para las asistentes femeninas.

---

## 4. Modelo Financiero y Unit Economics

### A. Economía por Evento (24 Asistentes)
| Concepto | Ingreso / Costo (COP) | % del Total |
| :--- | :--- | :--- |
| **Venta de Boletería** (24 personas × $55.000 COP prom.) | **+$1.320.000** | 100% |
| **Bebidas e Incentivo al Bar** (2 cócteles/asistente negociado) | -$528.000 | 40.0% |
| **Anfitrión / Host Presencial** (Turno de 3 horas) | -$250.000 | 18.9% |
| **Costos Transaccionales & Operativos** (Nequi/Logística) | -$62.000 | 4.7% |
| **MARGEN NETO RONDA POR EVENTO** | **+$480.000** | **36.4%** |

> **Punto Muerto (*Break-even*):** 16 asistentes confirmados. Por debajo de 16, el evento se re-agenda automáticamente con 48h de anticipación.

### B. Proyección de los 12 Eventos Piloto (60 Días)
* **Total Asistentes:** 288 profesionales verificados en Bogotá.
* **Ingresos Brutos:** $15.840.000 COP.
* **Margen Neto Generado:** **$5.760.000 COP**.
* **Retorno del Préstamo FFF:** Los $8.000.000 COP + 9% de interés ($720.000 COP) se pagan con los ingresos netos acumulados de las semanas 6 a 12 de operación comercial continua.

---

## 5. Destino de los Fondos (Uso de Capital de $8.000.000 COP)

```
┌─────────────────────────────────────────────────────────────┐
│ DISTRIBUCIÓN DEL CAPITAL FFF                                │
├─────────────────────────────────────────────────────────────┤
│ [████████████████████] Adquisición & Ads: $3.500.000 (43.8%)│
│ [███████████         ] Kits Branding Bar: $1.800.000 (22.5%)│
│ [████████████        ] Fondo Reserva Bar: $2.000.000 (25.0%)│
│ [████                ] Legal & Contratos:   $700.000  (8.7%)│
└─────────────────────────────────────────────────────────────┘
```

1. **Adquisición Segmentada de Usuarios ($3.500.000 COP):** Campañas hiper-localizadas en Instagram y LinkedIn enfocadas en mujeres y hombres profesionales de 25 a 42 años en Chapinero Alto, Zona G y Parque de la 93. Costo de Adquisición de Cliente (CAC) estimado: ~$12.000 COP por usuario verificado.
2. **Kits de Identidad y Merchandising Físico ($1.800.000 COP):** Acrílicos con números de mesa para los 4 bares piloto, sellos de cera, tarjetas de comanda física con diseño editorial de RONDA y stands QR de check-in.
3. **Fondo de Garantía de Sala ($2.000.000 COP):** Depósito rotativo de anticipo para garantizar la exclusividad del salón reservado en los gastrobares aliados.
4. **Formalización Legal ($700.000 COP):** Registro de contratos de mutuo con pagaré autenticado ante notaría digital para total tranquilidad del inversionista.

---

## 6. Hoja de Ruta de Ejecución (Milestones 90 Días)

* **Día 1 – 15 (Setup Inmediato):**
  - Firma de acuerdos comerciales con 4 gastrobares ancla en Zona G (ej. CARONTE Cocktail Bar, Patio Poca Prisa).
  - Apertura de la lista de espera y activación de primeros 100 perfiles KYC aprobados.
* **Día 16 – 60 (Los 12 Eventos Piloto):**
  - 2 eventos por semana (Miércoles y Jueves, 20:00 hrs).
  - 288 asistentes únicos. Generación de base de datos propia de solteros de alta renta.
* **Día 61 – 90 (Liquidación y Expansión):**
  - Repago total del capital FFF ($8M COP + 9% de interés) a los inversionistas.
  - Apertura de la ronda Pre-Seed formal (USD $75.000 a USD $150.000) con métricas reales de retención (>35% recompra de boletas para segundas citas) y expansión a Medellín y Cali.

---

## 7. Instrucciones para Formalizar la Participación

Para ingresar en la Micro-Ronda FFF de RONDA:

1. **Confirmar Ticket de Participación:** Indicar el monto deseado ($1.000.000 COP, $2.000.000 COP o superior) vía mensaje directo al fundador o completando el formulario en [`https://ronda.uno/invest`](https://ronda.uno/invest).
2. **Emisión de Documento Legal:** Se enviará el **Pagaré y Contrato de Mutuo Comercial con Interés Fijo (90 días)** firmado digitalmente por el representante legal de RONDA.
3. **Transferencia de Fondos:** Desembolso a la cuenta bancaria empresarial / Nequi oficial de la compañía.
4. **Acceso al Dashboard de Inversionista:** Cada inversionista recibe credenciales de acceso al portal [`/invest`](https://ronda.uno/invest) para monitorear en tiempo real la venta de entradas, el aforo de las noches y el calendario de liquidación.

---

*Documento confidencial emitido por RONDA Tech Inc. Bogotá, Colombia.*
