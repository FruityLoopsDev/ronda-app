# 📜 GUÍA MAESTRA DE MIGRACIÓN Y CONTINUIDAD TÉCNICA: PROYECTO RONDA
> **Destinatario:** Claude Code / Equipo de Desarrollo  
> **Proyecto:** RONDA (Citas Rápidas · Martes a Jueves · Modelo B2B/B2C para Bares en Colombia)  
> **Entorno:** Firebase (Auth, Firestore, Hosting, Cloud Functions) + Web3 (Polygon ERC-721) + Pasarela Wompi  
> **Fecha:** Agosto 2026  

---

## 1. RESUMEN EJECUTIVO Y MODELO DE NEGOCIO

### 1.1. ¿Qué es RONDA?
**RONDA** es una plataforma tecnológica que llena bares y gastrobares durante **días valle (martes a jueves)** mediante eventos presenciales de citas rápidas de 90 minutos.
* **Consumidor (B2C):** Paga una entrada (ej. $65.000 COP) que incluye 2 consumiciones + 9 citas rápidas de 6 minutos + dinámicas + Certificado digital NFT de asistencia.
* **Establecimiento (B2B):** Monopoliza el consumo cautivo en noches muertas sin costo fijo; comparte revenue o comisiones de bebidas adicionales.
* **Propiedad Intelectual y Foso Defendible:** El **Motor de Rotación con Memoria de Encuentros (Round-Robin con Memoria)** que garantiza cobertura 100% de la sala sin repetir citas y minimiza cruces con personas ya conocidas en noches pasadas.

---

## 2. SYSTEM BRAND & IDENTIDAD VISUAL

El diseño no utiliza frameworks genéricos (como Tailwind o Bootstrap). Está construido en **CSS Nativo de Alta Fidelidad** con una estética oscura ("Noche Premium").

### 2.1. Tokens de Color (`public/css/styles.css`)
```css
:root {
  --noche: #16101B;        /* Fondo principal */
  --barra: #221826;        /* Contenedores y tarjetas */
  --barra-alta: #2C2033;   /* Elementos elevados / modales */
  --luz: #F0A830;          /* Ámbar institucional (Botones primarios, acentos) */
  --botella: #2E6B54;      /* Verde esmeralda (Confirmaciones, Lado A) */
  --vino: #9B2748;         /* Magenta/Vino (Alertas, Repeticiones, Safeword) */
  --papel: #F3EDE2;        /* Texto claro, fondo de comandas/recibos */
  --tinta: #1B1520;        /* Texto oscuro sobre fondo papel */
  --humo: rgba(243,237,226,.62); /* Texto secundario */
  --linea: rgba(243,237,226,.14); /* Bordes */
  --r: 14px;               /* Radio de borde estándar */
}
```

### 2.2. Tipografías (Google Fonts)
* **Títulos y Marca:** `"Bodoni Moda", Georgia, serif` (pesos 600, 800, itálica).
* **Cuerpo e Interfaz:** `"Space Grotesk", system-ui, sans-serif` (pesos 400, 500, 700).
* **Datos, Contadores y Matriz:** `"JetBrains Mono", monospace` (pesos 400, 700).

### 2.3. Reglas de Responsive
* Tipografías fluidas con `clamp()`.
* Tarjeta de teléfono móvil simulada: `.tel` (`302px` de ancho, `max-width: 100%` adaptativa).
* Layouts flexibles mediante CSS Grid y Flexbox (`.fila`, `.escena`, `.grid3`, `.mapa`).

---

## 3. ARQUITECTURA TÉCNICA ACTUAL

### 3.1. Estructura de Directorios
```text
ronda-app/
├── firebase.json              # Configuración de hosting, emuladores y firestore
├── firestore.rules            # Reglas de seguridad de base de datos
├── firestore.indexes.json      # Índices compuestos
├── ronda-files/               # Activos maestros y documentos de diseño
│   ├── ronda-maqueta-CO.html        # Fuente de verdad visual (Brand & Layout)
│   ├── ronda-motor-rotacion.html    # Fuente de verdad del algoritmo de rotación
│   ├── ronda-logica-negocio-CO.md   # Reglas completas de negocio
│   ├── # RONDA NFT Integration Strategy.md # Estrategia Web3
│   ├── RONDA_Setup_Tecnico_WOMPI.pdf # Integración de pagos
│   └── RONDA_Plan_Marketing_Colombia_COP.pdf
└── public/                    # Aplicación Web desplegada en Firebase Hosting
    ├── index.html             # Entrada principal (Vistas Auth, Cliente, Anfitrión)
    ├── css/
    │   └── styles.css         # Hoja de estilos System Brand
    └── js/
        ├── firebase-config.js # Inicialización SDK v10 (Proyecto 'ronda-uno')
        ├── auth.js            # Servicio de autenticación Firebase Auth
        ├── db.js              # Adaptador Firestore (CRUD y suscripciones onSnapshot)
        ├── bar.js             # Consola del Anfitrión + Motor Round-Robin
        ├── client.js          # Consola del Participante + Cronómetro + SafeWord
        ├── nft-config.js      # Configuración de Contrato ERC-721 en Polygon
        └── app.js             # Orquestador UI y navegación por pestañas
```

### 3.2. Configuración de Firebase (`public/js/firebase-config.js`)
* **Project ID:** `ronda-uno`
* **Hosting URL:** `https://ronda-uno.web.app`
* **Emuladores locales:**
  * Firestore: `localhost:8080`
  * Auth: `localhost:9099`
  * Hosting: `localhost:5000`

### 3.3. Modelo de Datos Firestore

#### Colección `users/{uid}`
```json
{
  "uid": "string",
  "name": "string",
  "email": "string",
  "role": "client | admin",
  "gender": "M | F | NB",
  "orientation": "F | M | All",
  "age": 28,
  "wallet_address": "0x...",
  "activeEventId": "e1",
  "nfts": [
    {
      "token_id": "1",
      "evento_nombre": "Ronda #1 - Chapinero",
      "fecha": "2026-08-25",
      "tx_hash": "0x..."
    }
  ]
}
```

#### Colección `events/{eventId}` (ej. `e1`)
```json
{
  "id": "e1",
  "venueId": "v1",
  "status": "waiting | active | finished",
  "currentRound": 1,
  "tables": 6,
  "participants": ["uid1", "uid2", "uid3", "uid4"],
  "activeMatches": [
    {
      "tableId": "01",
      "p1": { "uid": "uid1", "name": "Juan" },
      "p2": { "uid": "uid2", "name": "Sofia" },
      "isRepeat": false
    }
  ],
  "history": []
}
```

---

## 4. EL MOTOR MATEMÁTICO: ROUND-ROBIN CON MEMORIA

Extraído de `ronda-files/ronda-motor-rotacion.html`. Este algoritmo es el núcleo de `public/js/bar.js`:

1. **Partición de la Sala:**
   * Participantes divididos en **Lado A** (Fijos en mesa) y **Lado B** (Rotan $+1$ mesa por ronda).
   * Si el número de participantes es impar, se habilita la **Silla de Barra** (`ghost: true`): quien rota a la barra descansa esa ronda y consume un trago.
2. **Memoria de Noches Anteriores:**
   * Se almacena una matriz booleana `prior[a][b]` con el historial de cruces pasados.
3. **Optimización de Rotación:**
   * Para cada posible desplazamiento $d \in [0, m-1]$, se calcula el número de colisiones históricas:
     $$c(d) = \sum_{a=0}^{m-1} [\text{prior}[a][(a - d + m) \pmod m]]$$
   * Se ordenan los desplazamientos de menor a mayor colisión para determinar la secuencia de rondas que **maximiza caras nuevas**.

---

## 5. ESTADO ACTUAL Y TAREAS PENDIENTES PARA CLAUDE CODE

### ✅ Completado en esta fase:
1. **System Brand Unificado:** Extracción y estandarización del CSS de la maqueta en `public/css/styles.css`.
2. **Eliminación del Modo Demo:** Limpieza de datos estáticos y emulaciones locales que ensuciaban la arquitectura.
3. **Conexión Real con Firebase:** Integración con el proyecto de producción `ronda-uno` en Auth y Firestore.
4. **Despliegue Inicial:** Aplicación subida a `https://ronda-uno.web.app`.

### 🚀 Tareas prioritarias a ejecutar en Claude Code:

#### Tarea 1: Escáner QR Real para Entrada de Clientes
* Reemplazar los prompts de texto por una librería JS ligera de escaneo de cámara (ej. `html5-qrcode`) en la vista del anfitrión (`bar.js`).
* El cliente debe mostrar su QR personal desde su app (`client.js`) para que el anfitrión lo registre con un solo escaneo en la colección `events/e1/participants`.

#### Tarea 2: Reloj Centralizado y Campana Sincronizada
* Actualmente el temporizador de 5 minutos corre en el cliente al recibir el match.
* **Mejora requerida:** El anfitrión debe escribir `roundStartTime` (Timestamp del servidor) en Firestore. El cliente calculará `timeLeft = 300 - (now - roundStartTime)` para que todos los teléfonos de la sala estén sincronizados al milisegundo.
* Reproducir el audio de campana ("DING") cuando el tiempo llegue a cero.

#### Tarea 3: Minting de NFTs de Asistencia (Polygon ERC-721)
* Configurar una Cloud Function (`functions/mintAttendanceNFT.js`) con una wallet *relayer/minter* privada.
* Al presionar "Finalizar y Emitir NFTs" en `bar.js`, la función debe acuñar los tokens en el contrato Polygon y guardar la URL de OpenSea en el perfil del usuario.

#### Tarea 4: Integración de Checkout con Wompi Colombia
* Implementar el widget de checkout de Wompi para la compra del pase de 90 min ($65.000 COP) vía Nequi, PSE o Tarjeta.
* Crear webhook en Firebase Functions para escuchar `transaction.updated` y habilitar el pase al usuario.

---

## 6. COMANDOS ÚTILES PARA EL ENTORNO DE DESARROLLO

```bash
# Iniciar emuladores locales para pruebas sin costo de cuota
firebase emulators:start

# Desplegar únicamente las reglas de seguridad
firebase deploy --only firestore:rules

# Desplegar la aplicación web completa a producción
firebase deploy

# Consultar credenciales del SDK Web
firebase apps:sdkconfig web
```

---

## 7. CONFIGURACIÓN DEL PROYECTO EN CLAUDE (INSTRUCCIONES Y MEMORIA)

### 📌 1. Copiar en "Instrucciones" (Custom Instructions):
```text
Eres el Lead Architect y Senior Fullstack Developer del proyecto RONDA (plataforma de citas rápidas en Colombia para días valle).

Directrices estrictas de desarrollo:
1. Cero código simulado/demo: Todo debe ser funcional y listo para producción conectado a Firebase (Auth, Firestore, Hosting).
2. System Brand Estricto: Mantén la estética "Noche Premium" en CSS puro (variables --noche, --barra, --luz, --botella, --vino). Tipografías: Bodoni Moda, Space Grotesk y JetBrains Mono. NO uses Tailwind ni frameworks genéricos.
3. 100% Responsive: Todo componente debe adaptarse con fluidez a móviles y escritorios.
4. Lógica de Negocio: Respeta estrictamente el motor de rotación Round-Robin con memoria de encuentros extraído de 'ronda-files/ronda-motor-rotacion.html'.
5. Consulta siempre 'CLAUDE_MIGRATION_GUIDE.md' como la fuente técnica de verdad del proyecto.
```

### 🧠 2. Copiar en "Memoria" (Project Memory):
```text
- Proyecto: RONDA (Citas rápidas presenciales de 90 min en Colombia).
- Stack: Firebase v10 Modular (ID: ronda-uno, URL: https://ronda-uno.web.app), Firestore, Web3 Polygon (NFTs ERC-721), Wompi Colombia ($65.000 COP).
- Archivos clave:
  * CLAUDE_MIGRATION_GUIDE.md (Guía técnica maestra).
  * ronda-files/ronda-maqueta-CO.html (Diseño y maqueta visual base).
  * ronda-files/ronda-motor-rotacion.html (Algoritmo matemático de rotación).
  * public/css/styles.css (Tokens de color y tipografía de la marca).
- Regla de diseño: Botón de acción principal siempre en color Ámbar institucional (--luz: #F0A830).
```

---
*Este documento ha sido generado para garantizar que Claude Code continúe el desarrollo con total fidelidad visual, rigor matemático y solidez arquitectónica.*
