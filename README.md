# 🍷 RONDA — Sistema Operativo de Citas Rápidas y Activación en Días Valle
> **Plataforma B2B2C para la reactivación comercial de bares y gastrobares en días de baja afluencia.**  
> Citas rápidas (speed dating) de 90 minutos con garantía de equilibrio, verificación de identidad y algoritmo de rotación con memoria.  
> **Versión:** 1.0 (Planificación e Identidad) · **Mercado Objetivo:** Bogotá, Colombia (Zona G, Quinta Camacho y Chapinero Alto).

---

## 📑 Índice de Documentación Estratégica

En la carpeta [`ronda-files/`](./ronda-files/) se encuentra el material estratégico inicial del proyecto:

* 📊 **[Lógica de Negocio y Producto](./ronda-files/ronda-logica-negocio-CO.md):** Arquitectura del modelo B2B2C, economía por evento, políticas de anti-no-show y el motor de ingresos de 4 líneas.
* ⚖️ **[Análisis Competitivo y FODA](./ronda-files/ronda-competencia-foda-evolucion.md):** Mapa estratégico de competencia (Tinder Events, Bumble IRL), ventajas defensivas (moats) y proyección de estadios de la plataforma.
* 💳 **[Setup Técnico de Pagos WOMPI](./ronda-files/RONDA_Setup_Tecnico_WOMPI.pdf):** Estructura de integración con la pasarela de pagos colombiana para compras fluidas vía PSE, tarjetas y billeteras.
* 📣 **[Plan de Marketing en Colombia](./ronda-files/RONDA_Plan_Marketing_Colombia_COP.pdf):** Estrategia de captación de usuarios (ICP), canales para el lado escaso (hombres) y plan de crecimiento.

---

## 🎯 El Problema y la Solución de Ronda

### El Problema del Bar (B2B)
Los bares y gastrobares en Bogotá facturan apenas entre el **20% y el 30%** de sus ingresos semanales en los días valle (martes a jueves), pero cargan con los mismos costos fijos de arriendo, servicios públicos y nómina de personal.

### La Solución de Ronda
RONDA compra esos "huecos" operativos y los revende llenos. 
* **El local no paga factura:** pone la sala vacía, la barra y el personal que ya tiene contratado.
* **RONDA pone los clientes:** 24 personas equilibradas y verificadas consumiendo de forma garantizada durante un formato dinámico de citas de 90 minutos.
* **El gancho comercial:** el bar vende bebida en barra, y a los matches resultantes se les entrega un **bono de -25% de descuento** para que vuelvan al mismo local de martes a jueves, construyendo recurrencia real en días valle.

---

## 🚀 Ecosistema de Producto y Formato de Evento

### 1. El Formato de los 90 Minutos
* **19:40 – 19:55 | Check-in en Barra:** Escaneo de código QR para recibir la comanda física (mesa de salida, ruta de rotación y primera consumición).
* **20:00 – 21:30 | Rondas de Citas:** 9 rondas de 6 minutos. Una campana física indica el final de cada cita y activa 2 minutos de rotación.
* **21:30 en adelante | Barra Abierta:** Finaliza el formato y los asistentes pueden quedarse consumiendo libremente en el local.
* **Día Siguiente 10:00 AM:** Se revelan los matches mutuos dentro de la app (el chat expira en 72 horas para fomentar la cita real).

### 2. Algoritmo de Rotación Round-Robin con Memoria
* **Rotación Perfecta:** Un lado permanece fijo en su mesa y el otro rota +1 posición cada ronda para garantizar que todos se conozcan una vez sin repeticiones.
* **Silla de Barra (Lados Impares):** Si hay desequilibrio numérico, se genera un asiento fantasma en la barra donde el usuario descansa una ronda con su consumición. El hueco rota matemáticamente para que nadie descanse dos veces.
* **Memoria de Encuentros:** El motor consulta el historial de eventos previos del usuario y calcula la rotación que minimiza volver a cruzarse con personas ya conocidas en noches pasadas.

---

## 📊 Modelo de Negocio y Flywheel de Datos (4 Líneas de Ingreso)

RONDA evoluciona de ser un operador de eventos físicos a una plataforma de software y datos de alto margen:

```
┌─────────────────────────────────────────────────────────────┐
│  Línea 1: Venta de Entradas (Tickets)                        │ ──► Financia la operación diaria
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Línea 2: Licenciamiento SaaS para Locales                  │ ──► Margen de software puro (Q2+)
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Línea 3: Informes de Afluencia Valle para Restauración     │ ──► Monetización de data de mercado (Q2-Q3)
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Línea 4: RONDA Signals (Publicidad y Micro-sondeos)         │ ──► Acceso segmentado a marcas de consumo (Q3+)
└─────────────────────────────────────────────────────────────┘
```

1. **Línea 1 · Entradas (Día 1):** Ticket de $45.000 COP (martes) a $65.000 COP (jueves). Incluye primera bebida. Margen de contribución neta de **$31.200 COP por asistente** (Punto muerto del evento: 16 personas).
2. **Línea 2 · SaaS (Q2):** Suscripción de **$550.000 COP/mes + $7.500 COP/asistente** para que los bares operen el formato de forma autónoma con nuestro software de rotación y matching.
3. **Línea 3 · Datos (Q2-Q3):** Informe de afluencia, consumo real y demografía de solteros valle en Bogotá vendido a inmobiliarias y grandes grupos de restaurantes.
4. **Línea 4 · RONDA Signals (Q3+):** Marcas de licores, belleza, fintech o viajes patrocinan micro-sondeos recompensados de 1 a 3 preguntas en los picos de atención de la app, obteniendo respuestas de audiencias verificadas.

---

## 🔐 Blindaje, Seguridad y Anti-No-Show

* **Verificación de Identidad:** Validación obligatoria con selfie + documento de identidad (cédula o pasaporte) antes del primer evento.
* **Sistema de Strikes:** Un no-show sin aviso retiene el valor total del ticket. Acumular 2 no-shows en 90 días bloquea la cuenta por 30 días, y un 3° genera expulsión definitiva.
* **Seguridad Física:** Protocolo de "palabra clave" pactado en barra con el staff del local para salir discretamente de una cita incómoda, con asistencia del anfitrión de sala.

---

## 🛠️ Maquetas e Interfaces de Referencia

* 📁 **[Maqueta Web del Producto (CO)](./ronda-files/ronda-maqueta-CO.html):** Prototipo HTML interactivo que visualiza las pantallas de visualización de noches, comanda en papel con código QR, contador de rondas y revelación de matches.
* 📁 **[Simulador del Motor de Rotación](./ronda-files/ronda-motor-rotacion.html):** Interfaz interactiva para probar el algoritmo Round-Robin en vivo, activando la memoria de encuentros y el descanso dinámico en la silla de barra.

---
*RONDA — Propiedad Intelectual Registrada © 2026.*
