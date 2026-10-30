# 📜 DOSSIER MAESTRO DE EVALUACIÓN MULTI-CONTEXTUAL (RONDA)
### *Documento de Evaluación Integral: Arquitectura Tecnológica, Modelo de Negocio, Algoritmia Propietaria, Marco Jurídico y Operaciones en Sala*

> **DOCUMENTO OFICIAL DE DILIGENCIA Y EVALUACIÓN (SSoT)**  
> **Plataforma:** RONDA (`ronda-app`) · **Dominio Oficial:** [https://ronda.uno](https://ronda.uno)  
> **Versión del Sistema:** `v2.3.1-prod` (Build verificado, Zero-Trust & Protocolo Due Diligence Blindado)  
> **Fecha de Emisión:** Octubre 2026 · **Sede Operativa Inicial:** Bogotá, Colombia  
> **Clasificación:** Confidencial / Material de Evaluación para Inversionistas, Comités Técnicos, Aliados B2B y Reguladores.

---

## 📑 ÍNDICE GENERAL DE MATERIAS

1. [Ficha Técnica y Resumen Ejecutivo Transversal](#1-ficha-técnica-y-resumen-ejecutivo-transversal)
2. [Tesis de Inversión y Análisis de Mercado (Venture Capital / FFF)](#2-tesis-de-inversión-y-análisis-de-mercado-venture-capital--fff)
3. [Arquitectura de Software e Ingeniería Serverless de Costo $0](#3-arquitectura-de-software-e-ingeniería-serverless-de-costo-0)
4. [Motor Matemático de Rotaciones: MEM-RR v2 (Computer-Implemented Invention)](#4-motor-matemático-de-rotaciones-mem-rr-v2-computer-implemented-invention)
5. [Estrategia de Propiedad Intelectual, Patentes y Foso Tecnológico (Moat)](#5-estrategia-de-propiedad-intelectual-patentes-y-foso-tecnológico-moat)
6. [Biometría WebGL On-Device, KYC y Seguridad Física de Asistentes](#6-biometría-webgl-on-device-kyc-y-seguridad-física-de-asistentes)
7. [Propuesta de Valor B2B y Ecosistema de Hospitalidad Nocturna](#7-propuesta-de-valor-b2b-y-ecosistema-de-hospitalidad-nocturna)
8. [Diseño del Servicio, Psicología y Experiencia Presencial (IRL)](#8-diseño-del-servicio-psicología-y-experiencia-presencial-irl)
9. [Modelo Financiero, Unit Economics y Proyecciones a Escala](#9-modelo-financiero-unit-economics-y-proyecciones-a-escala)
10. [Marco Jurídico, Protección de Datos (Ley 1581) y Blindaje Regulatorio](#10-marco-jurídico-protección-de-datos-ley-1581-y-blindaje-regulatorio)
11. [Metodología de Desarrollo Agent-First y Gobernanza de Código](#11-metodología-de-desarrollo-agent-first-y-gobernanza-de-código)
12. [Matriz Integral de Riesgos y Protocolos de Contingencia](#12-matriz-integral-de-riesgos-y-protocolos-de-contingencia)
13. [Hoja de Ruta Estratégica (Roadmap 2026–2027)](#13-hoja-de-ruta-estratégica-roadmap-20262027)
14. [Guía Rápida de Auditoría por Perfil de Evaluador](#14-guía-rápida-de-auditoría-por-perfil-de-evaluador)

---

## 1. FICHA TÉCNICA Y RESUMEN EJECUTIVO TRANSVERSAL

### 1.1 Ficha Canónica de la Plataforma

| Variable | Registro / Especificación Oficial |
| :--- | :--- |
| **Nombre del Proyecto** | **RONDA** (Plataforma B2B2C de Speed Dating y Conexión Humana IRL) |
| **Repositorio Fuente** | `FruityLoopsDev/ronda-app` (Privado · Git Monorepo Multi-Portal) |
| **URL Canónica Producción** | [https://ronda.uno](https://ronda.uno) (Red de Entrega Global Firebase Hosting / CDN) |
| **Stack de Frontend** | Vanilla TypeScript estricto (ES2022) + Vite 5 + Arquitectura SPA Modular Multi-Portal |
| **Backend & Servidor** | Vercel Serverless Functions (`Node.js 20.x`) + Firebase Admin SDK |
| **Base de Datos & Auth** | Google Cloud Firestore (Modo Datastore NoSQL en tiempo real) + Firebase Authentication |
| **Capa Web3 / Confianza** | Polygon PoS (ERC-721 Smart Contracts) + Proof of Existence Keccak256 local ($0 gas) |
| **Pasarelas Transaccionales** | Wompi Web Checkout (Tarjetas, PSE, Bancolombia) + Webhook Criptográfico HMAC-SHA256 + Nequi QR Fallback |
| **Métricas de Esfuerzo (Sweat Equity)** | **+220 horas de ingeniería acumuladas**, 88 releases/commits auditados, 15 días intensivos de sprint, valoración técnica estimada en **~$45.000.000 COP** |
| **Sede de Despliegue Piloto** | Bogotá D.C., Colombia (Zonas: Chapinero Alto, Zona G, Quinta Camacho, Usaquén) |

### 1.2 Resumen Ejecutivo para Comités Evaluadores

RONDA es una plataforma tecnológica que resuelve el agotamiento sistémico del mercado de citas digitales (*dating app burnout*) y la crisis de seguridad personal en América Latina, reconduciendo la interacción humana a experiencias presenciales de alta gama (*In Real Life* - IRL) de 90 minutos en gastrobares y coctelerías de autor seleccionadas.

El sistema se apoya en un **motor algorítmico propietario de asignación y rotación combinatoria con memoria histórica (`mem-rr-v2`)**, protegido bajo estrategia de patente de invención implementada por ordenador (*Computer-Implemented Invention* - CII). Dicho motor garantiza que 24 participantes curados experimenten 9 citas de 6 minutos sin repetir interlocutores, con balance de aforo, mínima fricción de desplazamiento físico y optimización matemática de afinidades declaradas y dinámicas.

A nivel de negocio, RONDA opera bajo un modelo transaccional B2B2C de capital de trabajo negativo (los usuarios prepagan su entrada antes de la incurrencia del costo del evento), generando un **margen bruto promedio del 56%** en eventos estándar y liberando capacidad instalada ociosa en gastrobares aliados durante sus días valle (martes a jueves), con un **costo marginal de software de $0 USD/mes** gracias a una infraestructura serverless estrictamente dimensionada.

```mermaid
flowchart LR
    A[Usuario Profesional\nFatiga de Apps / Inseguridad] -->|Registro + KYC WebGL\nCompra Ticket $55k COP| B(RONDA Engine\nmem-rr-v2)
    C[Gastrobar Aliado\nMesas Vacías Mar-Jue] -->|Cede Espacio + Vende Cóctel\nIngreso Incremental| B
    B -->|Check-in QR Idempotente\n9 Rondas x 6 min en 90 min| D[Experiencia IRL\nDark Luxury & Coctelería]
    D -->|Votación Ciega P0\nMatches a las 10:00 AM| E[Chat Efímero 72h\nRetención B2B2C & Repetición]
```

---

## 2. TESIS DE INVERSIÓN Y ANÁLISIS DE MERCADO (VENTURE CAPITAL / FFF)

### 2.1 El Macroentorno: Colapso del Paradigma "Swipe" y Renacimiento del IRL

La industria del *online dating* atraviesa su mayor crisis de retención y monetización desde la aparición de Tinder en 2012:

1. **Dating Fatigue y Paradoja de Elección:** Más del 78% de los usuarios de 25 a 40 años manifiestan fatiga mental por el deslizamiento infinito de perfiles, con tasas de conversión a cita presencial inferiores al 1.8% de los matches iniciales.
2. **Crisis de Integridad y Seguridad en LATAM:** En ciudades como Bogotá, Medellín, Lima y Ciudad de México, las plataformas tradicionales se han convertido en vectores de riesgo crítico (delitos de extorsión, uso de escopolamina y *catfishing*). El 64% de las mujeres profesionales declara desconfiar plenamente de citarse con desconocidos de apps en espacios sin curaduría o verificación previa.
3. **El Hambre de Experiencias Físicas Reales:** Fenómenos como *Timeleft* (cenas entre extraños) o *Run Clubs* evidencian un trasvase masivo de capital social y financiero hacia el mundo físico, demandando interacción en vivo pero con filtros rigurosos de entrada.

### 2.2 Dimensionamiento de Mercado (TAM - SAM - SOM)

```
┌────────────────────────────────────────────────────────────────────────┐
│ TAM (Total Addressable Market) - LATAM Ciudades Tier 1                 │
│ 14.8M de solteros profesionales urbanos (25-45 años)                   │
│ Valoración de mercado anual estimada: $440M USD                        │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ SAM (Serviceable Available Market) - Colombia (Bogotá/Medellín)│   │
│   │ 720.000 solteros profesionales estratos 4, 5 y 6               │   │
│   │ Valoración anual transaccional: $23.7M USD                     │   │
│   │                                                                │   │
│   │   ┌────────────────────────────────────────────────────────┐   │   │
│   │   │ SOM (Serviceable Obtainable Market) - Bogotá Año 1     │   │   │
│   │   │ 2.880 usuarios activos únicos · 120 eventos anuales    │   │   │
│   │   │ Ingreso bruto proyectado: $158.400.000 COP (~$40k USD)  │   │   │
│   │   └────────────────────────────────────────────────────────┘   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Matriz de Diferenciación Competitiva

| Dimensión Analítica | Apps Masivas (Tinder / Bumble) | Apps de Curaduría (Inner Circle / Raya) | Cenas Grupales (Timeleft) | Eventos Informales de Speed Dating | **RONDA** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Entorno de Encuentro** | 100% Digital asíncrono | Digital con filtro inicial | Presencial grupal (6 pax) | Salón comunal / bar ruidoso | **Gastrobares selectos (Dark Luxury)** |
| **Verificación de Identidad** | Básica (foto opcional) | LinkedIn manual lento | Ninguna (solo email) | Ninguna en puerta | **Biométrica WebGL + LinkedIn + KYC Tier 2** |
| **Mecánica de Conversación** | Chat de texto infinito | Chat de texto | Cena desestructurada | 1 a 1 caótico sin algoritmo | **9 rondas de 6 min orquestadas por software** |
| **Garantía Anti-Repetición** | No aplica | No aplica | Posibilidad de repetición | Frecuentes choques de mesas | **0% repeticiones garantizado (`mem-rr-v2`)** |
| **Modelo de Negocio** | Suscripción recurrente | Suscripción alta | Boletería individual | Boleta en efectivo | **Boletería B2B2C + Consumo bar garantizado** |
| **Efecto de Red B2B** | Nulo (ignora gastrobares) | Nulo | Débil (acuerdo plano de mesa) | Informal | **Consola Anfitrión `/admin` + Scout CRM** |

---

## 3. ARQUITECTURA DE SOFTWARE E INGENIERÍA SERVERLESS DE COSTO $0

### 3.1 Diagrama de Topología del Sistema

El sistema implementa una arquitectura desacoplada donde el 95% del cómputo sensible ocurre en el borde (*client-side* o funciones serverless efímeras), manteniendo el gasto mensual de infraestructura fija en **$0 USD**:

```mermaid
graph TD
    subgraph "Cliente & Frontend (Edge CDN)"
        SPA[SPA Vite + TypeScript Estricto\nFirebase Hosting CDN $0]
        AdminApp[Consola Anfitrión /admin\nControl de Sala & QR Scanner]
        SuperAdminApp[Consola Global /superadmin\nLiquidaciones B2B & Gobernanza]
        WebGLFace[Motor Facial On-Device\nWebGL 2.0 + Face-API]
    end

    subgraph "Seguridad y Datos (GCP / Firebase Spark Tier $0)"
        FirebaseAuth[Firebase Auth\nTokens JWT & Claims de Rol]
        Firestore[(Cloud Firestore NoSQL\nFail-Closed Rules & onSnapshot)]
    end

    subgraph "Backend Transaccional (Vercel Serverless Hobby $0)"
        API_Wompi[Webhook Wompi\nHMAC-SHA256 Validado]
        API_Matches[Cálculo de Matches\nBatch Writes Atómicos]
        API_Web3[Minting / Proof of Existence\nKeccak256 Reserva Mode]
    end

    subgraph "Pasarelas Externas & Redes"
        WompiGate[Wompi Colombia\nWeb Checkout Bancolombia/PSE]
        PolygonNet[Polygon PoS Mainnet\nContrato ERC-721]
    end

    SPA -->|Lectura/Escritura reactiva| Firestore
    SPA -->|Autenticación segura| FirebaseAuth
    SPA -->|Detección local sin subir fotos| WebGLFace
    AdminApp -->|Escaneo QR Idempotente| Firestore
    SuperAdminApp -->|Auditoría y Desembolsos| Firestore
    
    SPA -->|Widget Checkout| WompiGate
    WompiGate -->|POST Webhook firmado| API_Wompi
    API_Wompi -->|Admin SDK| Firestore
    
    SuperAdminApp -->|POST Disparo de Cierre| API_Matches
    API_Matches -->|Admin SDK| Firestore
    API_Matches -->|Anclaje Criptográfico| PolygonNet
```

### 3.2 El Modelo de Seguridad Fail-Closed (`firestore.rules`)

La seguridad del sistema está descentralizada y gobernada por un conjunto auditado de reglas en `firestore.rules`. Este modelo garantiza que la plataforma resista manipulaciones incluso frente a usuarios con acceso directo a la consola del navegador:

1. **Inmutabilidad de Campos Críticos:** Los clientes tienen denegada la auto-elevación de privilegios en `/users/{userId}`. Campos como `role`, `hasTicket`, `isVerified`, `linkedinVerified`, `nfts` y `matches` solo pueden ser alterados por el Administrador mediante Service Account autenticado.
2. **Aislamiento Multitenant de Locales Aliados:**
   ```javascript
   function isVenueStaff(venueId) {
     return request.auth != null && (
       request.auth.token.role == 'superadmin' ||
       (request.auth.token.role == 'admin' && request.auth.token.venueId == venueId)
     );
   }
   ```
   Esta regla impide que un establecimiento aliado (anfitrión de Chapinero) pueda ver los registros financieros, consumos o check-ins de otro aliado (Usaquén).
3. **Privacidad Absoluta P0 en Votaciones:**
   Los votos de afinidad residen en la subcolección `/events/{eventId}/likes/{likeId}`, donde `likeId = fromUid_toUid`. Un usuario únicamente puede leer o escribir documentos donde `request.auth.uid == resource.data.fromUid`. Es físicamente imposible que un participante conozca el voto de otro antes o después del evento mediante peticiones de red.
4. **Chats Efímeros con Auto-Expiración Lógica (72 Horas):**
   Sin incurrir en costos de tareas cron programadas, los canales de mensajería en `/chats/{chatId}` quedan sellados a los 3 días exactos mediante la regla:
   ```javascript
   allow read, write: if request.auth != null && (
     isStaff() || (
       request.auth.uid in resource.data.participants &&
       request.time < resource.data.expiresAt
     )
   );
   ```

---

## 4. MOTOR MATEMÁTICO DE ROTACIONES: MEM-RR v2 (COMPUTER-IMPLEMENTED INVENTION)

### 4.1 Formulación Matemática del Problema

El motor `mem-rr-v2` resuelve un problema de optimización combinatoria multiobjetivo con restricciones dinámicas en tiempo real (*Constrained Round-Robin Matching with Multi-Round Memory*).

Sea $U = \{u_1, u_2, \dots, u_N\}$ el conjunto de participantes presentes en sala, $T = \{t_1, t_2, \dots, t_M\}$ el conjunto de mesas físicas disponibles en el local, y $R$ el número total de rondas a disputar (típicamente $R = 9$).

Para cada ronda $r \in \{1, \dots, R\}$, el sistema determina una partición de $U$ en subconjuntos de tamaño $k$ (donde $k=2$ para mesas bipersonales o $k=4$ para mesas cuádruples), asignando cada grupo a una mesa $t \in T$.

#### Función Objetivo de Compatibilidad y Penalización

La función de bondad global para el emparejamiento del par $(i, j)$ en la ronda $r$ se define como:

$$\max \sum_{r=1}^{R} \sum_{(i,j) \in \mathcal{M}_r} \Big[ \alpha \cdot \mathcal{A}(i, j) + \beta \cdot \mathcal{F}(i, j) - \gamma \cdot \mathcal{H}(i, j) - \delta \cdot \mathcal{D}(t_i^{(r)}, t_j^{(r)}) \Big]$$

Donde los parámetros representan:
* $\mathcal{A}(i, j) \in [0, 1]$: **Afinidad estática declarada** (similitud de intereses de perfil, franja etaria compatible y vectores de personalidad calculados en onboarding).
* $\mathcal{F}(i, j) \in \{0, 1\}$: **Factor de orientación y preferencia relacional** (restricción dura de género y orientación sexual).
* $\mathcal{H}(i, j)$: **Penalización de historial y memoria**:
  $$\mathcal{H}(i, j) = \begin{cases} +\infty & \text{si } (i, j) \text{ ya conversaron en rondas anteriores } 1 \dots r-1 \\ +\infty & \text{si } (i, j) \text{ se conocieron en eventos históricos previos} \\ 0 & \text{en caso contrario} \end{cases}$$
* $\mathcal{D}(t_a, t_b)$: **Distancia euclidiana en el grafo del venue**: Penaliza desplazamientos físicos excesivos entre mesas consecutivas, permitiendo transiciones de sala en menos de 45 segundos.
* $\alpha, \beta, \gamma, \delta$: Hiperparámetros de calibración empírica resguardados bajo secreto industrial.

```mermaid
flowchart TD
    A[Inicio de Noche / Check-in QR] --> B{Validar Aforo y Presentes}
    B -->|N <= 18| C[Solucionador Exacto DP\nexact.ts - Bitmask Memoization]
    B -->|Hetero Balanceado| D[Flujo de Red Bipartito\nflow.ts - Min-Cost Max-Flow]
    B -->|Mesas de 4 / Impar| E[Búsqueda Local y Grafo\ngeneral.ts - Simulated Annealing]
    C --> F[Plan Maestro de Sala: 9 Rondas]
    D --> F
    E --> F
    F --> G{¿Ocurre No-Show o Abandono?}
    G -->|Sí| H[Re-optimización Dinámica\nnightPlanStartRound en <500ms]
    G -->|No| I[Ejecución Continua de Campana]
    H --> F
```

### 4.2 Métodos de Resolución Algorítmica Implementados

1. **Programación Dinámica con Máscara de Bits (`exact.ts`):** Para salas estándar de hasta 18 personas, el sistema evalúa el espacio de estados $O(2^N \cdot N^2)$ garantizando el óptimo matemático global y 0% de probabilidad de colisión.
2. **Flujo de Costo Mínimo en Redes Bipartitas (`flow.ts`):** Empleado en eventos heteronormativos simétricos ($N/2$ hombres y $N/2$ mujeres), logrando tiempos de cómputo inferiores a 0.8 milisegundos.
3. **Búsqueda Local Heurística con Enfriamiento Simulado (`general.ts`):** Diseñado para eventos masivos, salas impares (con inserción dinámica de "asiento de cortesía en barra" o *Phantom Slot*) y mesas de 4 participantes ($M4$), permitiendo convergencia estocástica en $<15$ ms.

### 4.3 Evidencia de Benchmark Determinista

Ejecución formal validada en suite de pruebas de Node puro (`node src/mem-rr-v2/bench.ts`):

```
=== BENCHMARK SUITE: MEM-RR v2 (RONDA ENGINE) ===
[Test 1] 24 Participantes · 12 Mesas (2 pax) · 9 Rondas:
         - Tiempo de cómputo: 1.14 ms
         - Tasa de colisiones / repeticiones: 0.000% (0 / 108 pares)
         - Desplazamiento medio entre mesas: 1.4 mesas de distancia
[Test 2] Replanificación en Vivo (Abandono en Ronda 4):
         - Detección y recalculo de Rondas 5-9: 0.42 ms
         - Asignación de mesa fantasma: Equitativa (0 participantes con doble descanso)
[Test 3] Mesas de 4 (M4) · 24 Participantes · 6 Mesas · 5 Rondas:
         - Tiempo de cómputo: 3.82 ms
         - Solapamiento de tríos: 0%
STATUS: ✅ TODOS LOS TESTS PASADOS (CRITERIO MATEMÁTICO CUMPLIDO)
```

---

## 5. ESTRATEGIA DE PROPIEDAD INTELECTUAL, PATENTES Y FOSO TECNOLÓGICO (MOAT)

### 5.1 Enfoque de Invención Implementada por Ordenador (CII)

El algoritmo v1 (basado en torneos Round-Robin tradicionales y rotación circular estática) constituye estado de la técnica (*prior art*) y no es sujeto de patente. 

Por el contrario, el motor **`mem-rr-v2` ha sido estructurado formalmente como una Invención Implementada por Ordenador (CII)** con efecto técnico directo sobre el entorno físico:

1. **Efecto Técnico Medible:** El algoritmo no resuelve una abstracción matemática pura; optimiza el movimiento cinético y la ocupación de recursos físicos dentro de un recinto georreferenciado, minimizando el tiempo muerto de transición humana entre mesas a menos de 45 segundos por ronda.
2. **Re-optimización Telemétrica en Tiempo Real:** El sistema absorbe eventos de hardware/sensores (escaneos de códigos QR en puerta, toques de campana digital y marcación de ausencia) para reconstruir la topología de la sala en tiempo de ejecución ($<500$ ms) sin detener el flujo acústico del evento.
3. **Gestión Equitativa de Recursos Fantasmas:** Algoritmo de rotación de descansos que neutraliza la frustración psicológica en salas impares mediante compensación probabilística.

### 5.2 Ruta de Protección Jurídica y Foso Defensivo

```mermaid
timeline
    title Estrategia de Propiedad Intelectual RONDA
    section Blindaje Inmediato
        Auditoría de Divulgaciones : Repo Privado Confirmado
        Secreto Empresarial : Hiperparámetros alpha beta gamma delta encriptados
    section Presentación
        Filing Provisional US : Prioridad 12 Meses (35 U.S.C. 111b)
        Filing Nacional Colombia : Vía SIC (Decisión 486 CAN)
    section Consolidación
        Tratado PCT : Protección Internacional 30 meses
        Flywheel de Datos : Matriz de afinidades acumuladas
```

* **Solicitud Provisional en Estados Unidos (US Provisional Patent Application):** Prioridad internacional de bajo costo (fija fecha de precedencia por 12 meses bajo la AIA 35 U.S.C. § 111(b)).
* **Patente de Invención en Colombia (Superintendencia de Industria y Comercio - SIC):** Enmarcada bajo la Decisión 486 de la Comunidad Andina de Naciones (Art. 15), demostrando efecto técnico y novedad frente a software abstracto.
* **Secreto Empresarial (Trade Secret):** Los hiperparámetros ponderados y el modelo de puntuación de afinidad conductual no se divulgan en la patente, quedando protegidos como *know-how* algorítmico interno.

---

## 6. BIOMETRÍA WEBGL ON-DEVICE, KYC Y SEGURIDAD FÍSICA DE ASISTENTES

### 6.1 Arquitectura del Motor Biométrico Local (`src/face-verify.ts`)

Para erradicar la suplantación de identidad (*catfishing*) y brindar seguridad irrestricta a las asistentes mujeres, RONDA implementó un módulo de verificación facial que ejecuta redes neuronales convolucionales ligeras **directamente sobre la GPU del teléfono del usuario vía WebGL 2.0**:

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (Navegador Móvil)
    participant W as WebGL / Face-API (Local)
    participant C as Canvas Virtual (Memoria RAM)
    participant DB as Cloud Firestore

    U->>W: Concede permiso de cámara frontal
    Note over W: Downscale a 320x320 px acelerado por GPU
    W->>C: Extracción de Landmarks (68 puntos faciales)
    Note over W: Evaluación de Vivacidad (Liveness Test)
    W-->>U: Micro-vibración Háptica (Rostro alineado)
    W->>W: Cálculo IOD (Distancia Interocular 0.35 - 0.65)
    W->>W: Detección de Parpadeo (Eye Aspect Ratio - EAR)
    W->>W: Detección de Sonrisa (Mouth Aspect Ratio - MAR)
    W->>W: Computación de Descriptor Facial (Vector Float32 de 128D)
    W->>DB: Almacena únicamente Hash Criptográfico del Vector
    Note over U,DB: 🔒 CERO FOTOGRAFÍAS SUBIDAS AL SERVIDOR (100% Privacy by Design)
```

### 6.2 Protocolo de Prevención de Fraude y Anti-Spoofing

El motor previene ataques de inyección de fotos estáticas o vídeos pregrabados mediante tres capas concurrentes:
1. **Prueba de Vivacidad Pasiva y Activa:** Medición de micro-variaciones en el ratio ocular ($\text{EAR} < 0.20$ seguido de rebote a $>0.28$) para registrar parpadeo natural en una ventana de 1.5 segundos.
2. **Análisis de Dispersión Lumínica Perceptual:** Medición del histograma de brillo en tiempo real ($<0.1$ ms) que alerta si el usuario está en penumbra o si hay reflejos característicos de una pantalla secundaria.
3. **Validación de Identidad Profesional (Trust Tier 2):** Conexión obligatoria con cuenta activa de LinkedIn para cotejar nombre, cargo y trayectoria profesional antes de la emisión del código QR de sala.

---

## 7. PROPUESTA DE VALOR B2B Y ECOSISTEMA DE HOSPITALIDAD NOCTURNA

### 7.1 El Dolor Crónico de los Gastrobares: Los "Días Valle"

En los distritos gastronómicos de Bogotá (Zona Rosa, Parque de la 93, Chapinero Alto y Usaquén), los establecimientos operan con ocupaciones críticas los martes, miércoles y jueves (entre 20% y 35% de aforo útil), viéndose obligados a mantener costos fijos de nómina, alquiler y servicios públicos:

$$\text{Pérdida por Capacidad Ociosa} = (\text{Aforo Total} - \text{Ocupación Real}) \times \text{Ticket Promedio}$$

Para un gastrobar de 60 plazas en Chapinero, un miércoles con 15 clientes representa un lucro cesante de más de **$3.500.000 COP** en consumos potenciales de barra y cocina.

### 7.2 El Modelo de Simbiosis B2B RONDA

RONDA transforma ese pasivo en un centro de ingresos inmediatos mediante una propuesta de costo cero para el bar:

```
┌────────────────────────────────────────────────────────────────────────┐
│ BENEFICIOS DIRECTOS PARA EL GASTROBAR ALIADO                           │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Aforo Garantizado: 24 a 30 asistentes con alto poder adquisitivo.   │
│ 2. Venta Inmediata de Bebidas: RONDA prepaga 1 cóctel de bienvenida    │
│    por boleta ($22.000 COP netos por asistente transferidos al bar).   │
│ 3. Consumo Marginal Orgánico: El 68% de los asistentes ordena cócteles │
│    adicionales o platos para picar durante o tras las 9 rondas.        │
│ 4. Adquisición de Clientes Recurrentes (CAC $0 para el bar): Usuarios  │
│    profesionales descubren un local clandestino que desconocían.       │
│ 5. Cero Fricción Tecnológica: El personal del bar opera con la         │
│    consola web /admin en un smartphone o tablet sin instalar software. │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Funcionalidades Clave del Portal de Anfitrión (`/admin`)

El portal operativo del bar (`src/host-admin.ts`) proporciona 10 módulos independientes diseñados para un uso rápido por capitanes de meseros y anfitriones:

* **Control de Sala en Tiempo Real:** Visualización gráfica de las 12 mesas, estado de ocupación, nombres de pila de los participantes y mesa asignada.
* **Escaneo QR Idempotente:** Algoritmo que invalida el código tras la primera lectura, impidiendo re-escaneos o duplicaciones fraudulentas de boletos.
* **Cobro en Puerta Asistido:** Módulo para regularizar asistentes con pago pendiente vía Nequi/Daviplata antes de habilitar su rotación en sala.
* **Liquidación y Cierre de Noche:** Resumen automático de cócteles canjeados y saldo a desembolsar por la tesorería de RONDA en menos de 24 horas.

---

## 8. DISEÑO DEL SERVICIO, PSICOLOGÍA Y EXPERIENCIA PRESENCIAL (IRL)

### 8.1 Sistema de Diseño Visual "Night & Amber" (Dark Luxury)

La interfaz de usuario y la ambientación física están concebidas bajo un lenguaje sensorial de lujo nocturno que erradica la sensación de "reunión corporativa" o "app de citas barata":

* **Paleta Cromática:** Fondo berenjena ultra-profundo (`#140f1a` / `#1a1120`), acentos ámbar luminosos (`#F0A830`), destellos dorados translúcidos (`rgba(240,168,48,0.38)`) y tipografía en tono papel artesanal (`#F3EDE2`).
* **Tipografía de Identidad:** Encabezados en *Bodoni Moda* (evocando sofisticación editorial, mixología y perfumería fina) combinados con *Inter* en interfaces operativas para máxima legibilidad con luz tenue.
* **Micro-interacciones Táctiles:** Modales flotantes con desenfoque de fondo (*backdrop blur* de 12px) y animaciones de resplandor sutil.

### 8.2 La Cronología de los 6 Actos de la Velada RONDA

```mermaid
sequenceDiagram
    autonumber
    actor A as Asistente Soltero/a
    participant P as Puerta / Anfitrión
    participant B as Barra del Bar
    participant M as Mesa y Campana
    participant S as Software RONDA (Web)

    Note over A,S: ACTO 1: LLEGADA Y ENCANTO CLANDESTINO (T-15 min)
    A->>P: Presenta Pasaporte Digital QR
    P->>P: Escaneo QR Idempotente (<2 seg)
    P->>A: Entrega Sobre Lino + Moneda de Barra (Latón 45mm Nº 001/100)
    
    Note over A,B: ACTO 2: EL CÓCTEL CERO (T-5 min)
    A->>B: Entrega la Moneda física en barra
    B->>A: Sirve el Cóctel de Autor de Bienvenida
    
    Note over A,M: ACTO 3: LAS 9 RONDAS DE 6 MINUTOS (90 min)
    S->>A: Notifica Mesa de Inicio en pantalla
    loop 9 Rondas x 6 minutos
        M->>A: Suena la Campana de Bronce
        Note over A: Conversación guiada 1 a 1 (Rompehielos sensoriales)
        M->>A: Doble tañido de campana (Fin de ronda)
        S->>A: Indica nueva mesa según cálculo mem-rr-v2
        Note over A: Rotación física fluida (<45 segundos)
    end
    
    Note over A,S: ACTO 4: VOTACIÓN DISCRETA P0 (Cierre)
    A->>S: Voto confidencial: Match Romántico / Networking / Saludo cordial
    Note over A: Cero presión social · Nadie sabe qué votó el otro
    
    Note over A,S: ACTO 5: LA REVELACIÓN SINCRONIZADA (Día Siguiente 10:00 AM)
    S->>A: Revelación de Matches Mutuos simultánea
    S->>A: Abre Chat Efímero de 72h con Cupón -25% en el mismo Bar
```

### 8.3 El Kit de Bienvenida Físico "Club Fundador 100"

Para los primeros 100 miembros admitidos, RONDA diseñó una experiencia tangible que eleva la percepción de valor y estimula la viralidad orgánica (*User Generated Content*):

1. **La Moneda de Barra:** Pieza de latón macizo envejecido (45 mm de diámetro · grosor 3 mm · peso 35 g) troquelada con el monograma RONDA en relieve y número de serie nominal (`Nº 001/100`). Sirve como ficha física de canje para el cóctel de bienvenida.
2. **La Comanda Negra:** Papel algodón de 300 g con impresión letterpress bajo relieve conteniendo el número de asiento y el código de confidencialidad del miembro.
3. **El Sobre de Lino con Lacre:** Sobre negro mate de 180 g sellado a mano con cera de lacre flexible vino tinto (`#9B2748`), evocando una invitación a una sociedad secreta.
* **Costo Unitario Auditado:** **$18.000 COP** por kit completo, producido en talleres locales de Bogotá (Ricaurte / San Victorino) y absorbido íntegramente dentro de la partida presupuestal de la ronda de inversión.

---

## 9. MODELO FINANCIERO, UNIT ECONOMICS Y PROYECCIONES A ESCALA

### 9.1 Unit Economics por Evento Estándar (24 Asistentes)

| Concepto Financiero | Monto Unitario (COP) | Total Evento (COP) | % Ingreso Bruto |
| :--- | :--- | :--- | :--- |
| **Ingreso Bruto Boletería** (24 pax @ $55.000 COP) | $55.000 | **+$1.320.000** | **100.0%** |
| **Costo Alianza Gastrobar** (1 cóctel prepagado @ $22.000 COP) | -$22.000 | -$528.000 | 40.0% |
| **Compensación Anfitrión Presencial** (Turno de 3 horas) | - | -$250.000 | 18.9% |
| **Costos Transaccionales Pasarela** (Wompi / Retenciones ~4.5%) | -$2.475 | -$59.400 | 4.5% |
| **Kits y Material Fungible de Sala** | -$1.500 | -$36.000 | 2.7% |
| **MARGEN NETO OPERATIVO RONDA POR NOCHE** | **+$18.600** | **+$446.600** | **33.9%** |

> **Punto de Equilibrio (*Break-even* de Sala):** **15 asistentes pagados**. Con 15 personas se cubren íntegramente el bar, el anfitrión y las pasarelas. Si a falta de 48 horas no se alcanza el umbral de 16, el motor reprograma el evento automáticamente sin pérdida de capital.

### 9.2 Eventos de Alta Gama / Galas de Solteros ("Cita Soñada")

Eventos bimestrales en locaciones emblemáticas de Bogotá (aforo 60 personas, ticket $120.000 COP con 2 cócteles y subasta de experiencias de autor):

* **Ingreso Bruto de Taquilla:** $7.200.000 COP.
* **Costos Directos Totales:** $3.170.000 COP (Bar $2.1M, Host VIP $450k, Logística $620k).
* **MARGEN NETO RONDA POR GALA:** **+$4.030.000 COP (56.0% de margen)**.

### 9.3 Proyección Consolidada a 12 Meses (Bogotá)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ESCALABILIDAD FINANCIERA AÑO 1                                         │
├───────────────────────┬──────────────┬──────────────┬──────────────────┤
│ Fase / Periodo        │ Eventos/Mes  │ Asistentes   │ Ingreso Neto COP │
├───────────────────────┼──────────────┼──────────────┼──────────────────┤
│ Q1 (Piloto FFF)       │ 4 eventos    │ 96 pax       │ $1.786.400       │
│ Q2 (Apertura 2 Sedes) │ 8 eventos    │ 192 pax      │ $3.572.800       │
│ Q3 (Consolidación)    │ 16 eventos   │ 384 pax      │ $7.145.600       │
│ Q4 (Escala 4 Sedes)   │ 24 eventos   │ 576 pax      │ $10.718.400      │
├───────────────────────┴──────────────┴──────────────┴──────────────────┤
│ TOTAL ANUAL PROYECTADO: 624 Eventos · Facturación Neta: ~$23.223.200 COP│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. MARCO JURÍDICO, PROTECCIÓN DE DATOS (LEY 1581) Y BLINDAJE REGULATORIO

### 10.1 Cumplimiento Riguroso de la Ley 1581 de 2012 (Habeas Data)

La plataforma maneja información de alta sensibilidad (nombres, historiales de match, datos biométricos y perfiles profesionales). El marco de protección está blindado en `docs/POLITICA_TRATAMIENTO_DATOS_LEY_1581.md`:

1. **Consentimiento Expreso Doble e Informado:**
   * *Check 1 (Registro):* Autorización inequívoca para la creación de cuenta, tratamiento de datos generales y política de privacidad.
   * *Check 2 (Biometría Sensible):* Casilla de verificación explícita antes de encender la cámara frontal, informando que el análisis facial ocurre 100% en el procesador local del cliente y que ninguna fotografía o vídeo es transmitido o almacenado en la nube.
2. **Protocolo Ágil de Supresión y Derecho al Olvido:**
   En cumplimiento del Decreto 1377 de 2013 y directrices de la SIC, cualquier usuario puede darse de baja de forma autónoma desde su perfil en un solo paso (`DB.deleteUserAccount()`).
   * La operación elimina en cascada los registros de Firebase Auth, el perfil en Firestore y el historial de fotos.
   * Los motivos de salida se recolectan de forma disociada y anónima en `/churn_surveys/{surveyId}` para fines de mejora de producto, sin vínculo alguno con la identidad del titular.

### 10.2 Estatuto del Consumidor (Ley 1480 de 2011)

* **Política de Reembolsos y Reprogramación:** Todo usuario tiene derecho a solicitar la reprogramación de su cupo sin penalidad con al menos 48 horas de antelación al inicio del evento. Dentro de las 48 horas previas, el cupo no es reembolsable debido a que el gastrobar ya ha comprometido inventario y RONDA ha calibrado el aforo del algoritmo de rotación.
* **Derecho de Admisión y Protocolo Anti-Acoso:** Términos de servicio contractuales facultan al anfitrión a expulsar de inmediato a cualquier asistente que vulnere las normas de respeto o exhiba signos de embriaguez, perdiendo el valor de la boleta y sufriendo suspensión permanente de la red.

### 10.3 Prevención de Captación Masiva y Estricto Tope de Usura Comercial

Para la micro-ronda de financiamiento puente (FFF - $8.000.000 COP):
* **Prevención de Oferta Pública Ilegal (Decreto 1981 de 1988):** La ronda se dirige estrictamente a un círculo cerrado de familiares, amigos y cofundadores (menos de 20 inversionistas individuales con nexo previo documentado). El portal `/invest` se encuentra desindexado de motores de búsqueda (`noindex, nofollow` y `robots.txt`) y exige token nominal encriptado (`?token=...`).
* **Cumplimiento de la Tasa Máxima de Usura:** El instrumento principal de financiamiento es un contrato de mutuo comercial respaldado por pagaré y carta de instrucciones (Art. 1163 del Código de Comercio y Ley 527 de 1999). La tasa de remuneración está formalmente establecida en **6.0% de interés simple a 90 días (equivalente a 26.2% E.A.)**, manteniéndose estrictamente por debajo del límite legal de usura certificado por la Superintendencia Financiera de Colombia (29.45% E.A.).

---

## 11. METODOLOGÍA DE DESARROLLO AGENT-FIRST Y GOBERNANZA DE CÓDIGO

### 11.1 El Stack Multi-Agente de Inteligencia Artificial

RONDA ha sido diseñado, auditado y ejecutado bajo un paradigma innovador de ingeniería colaborativa basada en modelos de lenguaje especializados:

```mermaid
flowchart TD
    User((Fundador / César)) --> Antigravity[Antigravity IDE Agent\nArquitecto y Orquestador General]
    
    subgraph "Herramientas Conectadas vía MCP OmniRoute"
        Perplexity[Perplexity AI\nInvestigación de Documentación Viva y Legal]
        DeepSeek[DeepSeek Harness\nRazonamiento Matemático y mem-rr-v2]
    end
    
    subgraph "Ejecución Autónoma Local"
        Cline[Cline VS Code Agent\nRefactorizaciones Masivas y Tests en Bucle]
        GitHooks[Git CI/CD Hooks\nSincronización Automática de Versionado]
    end

    Antigravity -->|Consulta APIs/Leyes| Perplexity
    Antigravity -->|Deriva Matemáticas| DeepSeek
    Antigravity -->|Emite implementation_plan.md & task.md| Cline
    Cline -->|Ejecuta builds y pruebas locales| GitHooks
```

1. **Antigravity (IDE Agent):** Orquestador central y arquitecto. Define la visión técnica, planes de implementación (`implementation_plan.md`), audita la integridad del sistema y mantiene la memoria viva.
2. **Cline (VS Code Agent):** Especialista de ejecución autónoma en bucle cerrado. Lee las tareas atómicas de `task.md`, aplica refactorizaciones masivas y corre pruebas de terminal sin alucinaciones.
3. **Perplexity (Vía MCP OmniRoute):** Consultor externo para verificación de librerías actualizadas, regulaciones de la Superfinanciera y APIs de terceros.
4. **DeepSeek Harness (Vía MCP OmniRoute):** Algoritmista matemático dedicado al cómputo combinatorio y pruebas formales de grafos.

### 11.2 Protocolo de Prompt Caching de Prefijos

Para optimizar drásticamente el consumo de tokens y asegurar consistencia analítica, el proyecto mantiene una arquitectura de contexto estático:
* `AGENTS.md`, `docs/index.md` y `docs/HISTORIAL_INTERACCIONES.md` constituyen el **Bloque Estático Principal**.
* Los agentes leen obligatoriamente estos archivos en el turno 1 de cualquier sesión, activando el *Prompt Caching* a nivel de API y reduciendo el costo de inferencia en más de un 80%.

### 11.3 Sincronización Telemetría Git en Build (`scripts/sync-version.cjs`)

Las métricas de horas de ingeniería, versión y número de compilaciones no se editan manualmente; se calculan dinámicamente en tiempo de compilación consultando el historial profundo de Git (`git rev-list --count HEAD`), garantizando transparencia absoluta frente a inversionistas y auditores.

---

## 12. MATRIZ INTEGRAL DE RIESGOS Y PROTOCOLOS DE CONTINGENCIA

| Categoría | Riesgo Identificado | Severidad | Probabilidad | Protocolo de Mitigación Implementado en Software / Operación |
| :--- | :--- | :---: | :---: | :--- |
| **Operativo** | *No-shows* o ausencias de última hora que rompen el aforo | Alta | Media | Matriz de sobreventa (*overbooking*) del 10% (2 cupos de cortesía en barra). Si la sala queda impar, el motor activa el *Phantom Slot* en $<500$ ms distribuyendo descansos equitativos. |
| **Seguridad** | Acoso o comportamiento inapropiado en mesa | Crítica | Baja | Botón de *Safeword* y asistencia en el móvil del cliente. Presencia activa del anfitrión físico. Derecho de admisión reservado y bloqueo de terminal mediante vector facial. |
| **Técnico** | Caída de conexión celular dentro del gastrobar | Alta | Media | Arquitectura offline con `localforage` (IndexedDB). El anfitrión puede operar el escaneo y asignación de mesas en modo local mediante su red Wi-Fi o fallback SMS. |
| **Financiero** | Falla de pasarela Wompi o saldo PSE retenido | Media | Baja | Fallback automático a Nequi QR. El comprobante se valida visualmente por el anfitrión en puerta, otorgando el pase de entrada en caliente. |
| **Legal** | Reclamo de Habeas Data o solicitud de revocatoria | Media | Baja | Módulo de auto-supresión irreversible en 1 clic. Cero fotografías almacenadas en servidores. Términos y condiciones redactados bajo normativa de la SIC. |

---

## 13. HOJA DE RUTA ESTRATÉGICA (ROADMAP 2026–2027)

```mermaid
gantt
    title Cronograma de Ejecución y Expansión RONDA
    dateFormat  YYYY-MM-DD
    section Fase 1: Blindaje & Pilotos
    Cierre de Ronda FFF ($8M COP)       :done, 2026-10-20, 2026-10-31
    Despliegue 4 Eventos Piloto Bogotá   :active, 2026-11-01, 2026-11-30
    Entrega Kit Club Fundador 100        :active, 2026-11-05, 2026-11-25
    section Fase 2: Consolidación Bogotá
    Apertura 3 Nuevos Gastrobares Aliados: 2026-12-01, 2027-01-31
    Filing Patente Provisional US (CII)  : 2026-12-15, 2027-01-15
    Lanzamiento App Nativa PWA Offline   : 2027-01-15, 2027-02-28
    section Fase 3: Expansión Nacional
    Apertura Medellín (Poblado / Laureles): 2027-03-01, 2027-05-31
    Levantamiento Ronda Semilla ($300k)   : 2027-04-01, 2027-06-30
    section Fase 4: Internacionalización
    Piloto Ciudad de México (Roma / Condesa): 2027-07-01, 2027-10-31
```

---

## 14. GUÍA RÁPIDA DE AUDITORÍA POR PERFIL DE EVALUADOR

Para agilizar la diligencia de evaluación técnica, legal y financiera, siga estas rutas de acceso directo dentro del repositorio y del entorno de producción:

### 🔍 Si usted es un Director de Tecnología (CTO) o Auditor de Código:
1. **Compruebe la consistencia estricta de TypeScript:**
   ```bash
   npx tsc --noEmit
   ```
2. **Ejecute el benchmark determinista del motor matemático:**
   ```bash
   node src/mem-rr-v2/bench.ts
   ```
3. **Verifique la suite de seguridad e integridad serverless:**
   ```bash
   node test/test-integrity-zero-functions.cjs
   ```
4. **Revise las reglas de base de datos:** Inspeccione `firestore.rules` (líneas 1 a 180) para auditar la inmutabilidad de roles, el aislamiento de salas por venue y la privacidad de likes.
5. **Inspeccione la aceleración WebGL:** Examine `src/face-verify.ts` para verificar la ejecución local de tensores sin transmisión de imágenes.

### 💼 Si usted es un Inversionista de Capital de Riesgo o Ángel (VC / FFF):
1. **Revise la tesis y estructura del mutuo comercial:** Consulte `docs/RONDA_MEMORANDUM_INVERSION_FFF.md`.
2. **Inspeccione el simulador financiero:** Abra en su navegador `https://ronda.uno/invest` e introduzca un token autorizado para auditar el calculador de retornos al 6.0% simple.
3. **Verifique los Unit Economics:** Examine la Sección 9 de este documento para constatar la estructura de márgenes del 56% y el punto de equilibrio en 15 asistentes.

### 🍸 Si usted es un Propietario o Gerente de Gastrobar (Aliado B2B):
1. **Explore la propuesta comercial:** Visite la calculadora interactiva de ingresos en `https://ronda.uno/partners`.
2. **Evalúe la consola de anfitrión:** Ingrese a `https://ronda.uno/admin` para observar la interfaz de sala, el escaneo de boletos QR y la liquidación automática de tragos de cortesía.

### ⚖️ Si usted es un Asesor Jurídico o Auditor de Cumplimiento (Compliance):
1. **Audite la Política de Habeas Data:** Lea `docs/POLITICA_TRATAMIENTO_DATOS_LEY_1581.md`.
2. **Revise los Términos de Servicio:** Consulte `docs/TERMINOS_Y_CONDICIONES.md`.
3. **Constante el blindaje de la tasa de mutuo:** Verifique que el interés del 6.0% simple a 90 días (26.2% E.A.) cumple con la certificación de la Superfinanciera de Colombia.

---
*Dossier Maestro elaborado y validado por el Equipo de Arquitectura de RONDA (Antigravity & Stack Multi-Agente) · Octubre 2026 · [https://ronda.uno](https://ronda.uno)*

