# 🏛️ PLAN DE IMPLEMENTACIÓN — RONDA /admin
## ENTREGA 1 (Pasos 1–3): Arquitectura Canónica, Contratos Compartidos y Acceso Seguro por Local

> **Rama activa:** `feat/admin-host-workspace`  
> **Distinción Operativa Obligatoria:**  
> - `/admin`: Operación exclusiva del establecimiento aliado y anfitrión de sala.  
> - `/superadmin`: Consola administrativa global de RONDA (tesorería, finanzas, KYC global, reglas de plataforma).

---

## 📌 PASO 1. Inspección del Proyecto y Mapa Breve de Integración

### 1.1 Estado del Entorno y Control de Versiones
- **Repositorio:** `c:\Users\Cesar Dla Croix\Desktop\ronda-app`
- **Rama Creada:** `feat/admin-host-workspace` (a partir de `main`).
- **Gestor de Paquetes:** `npm` con `package-lock.json` bloqueado (versión Node LTS).
- **Entorno de Emuladores Activo:** Firebase Emulator Suite (Auth: `9099`, Firestore: `8081`, Hosting: `5001/5002`).

### 1.2 Mapa Canónico de Funciones y Servicios
| Función Operativa | Archivo / Controlador | Fuente de Datos Primaria | Permisos / Roles | Consumidores |
| :--- | :--- | :--- | :--- | :--- |
| **Resolución de Rutas** | `firebase.json`, `vite.config.ts` | Configuración estática | Público / HTTP Rewrite | Navegador (`/admin` → `admin.html`) |
| **Autenticación Portal** | `src/portal-auth.ts`, `src/auth.ts` | Firebase Auth (`users/{uid}`) | `admin`, `superadmin` | `admin.html`, `superadmin.html` |
| **Controlador Anfitrión** | `src/entry-admin.ts`, `src/bar.ts` | `events/{eventId}`, `venues/{venueId}` | `admin` (del local), `superadmin` | `admin.html` (`#view-admin`) |
| **Motor de Rondas (MEM-RR)** | `src/mem-rr-v2/engine.ts`, `src/bar.ts` | Memoria pura + `events/{id}` | `admin` (en sala), `superadmin` | Operador en vivo y Clientes |
| **Recepción y Check-in** | `src/bar.ts` (`html5-qrcode`) | `users/{uid}`, `events/{eventId}` | `admin` (capacidad `reception`) | Anfitrión en puerta y Cliente (`index.html`) |
| **Pagos y Tickets** | `src/payment.ts`, `functions-vercel/` | Wompi API / `transactions/` | Backend serverless, `superadmin` | Cliente al reservar, Admin al verificar |
| **Directorio de Locales** | `src/db.ts` (`DB.getVenues()`) | Colección `venues/{venueId}` | Lectura `trustTier >= 1`, Edición `admin` (propio local) | `/admin`, `/superadmin`, `/landing` |
| **Historial y Encuentros** | `src/mem-rr-history.ts`, `src/db.ts` | `users/{uid}/encounters` | Solo el usuario y staff de matching | Motor de emparejamiento |
| **Reglas de Seguridad** | `firestore.rules` | Firestore Security Rules | Evalúa rol + `venueId` | Todo el SDK cliente |

---

## 📌 PASO 2. Definición de Contratos Compartidos y Matriz de Sincronización

### 2.1 Especificación de Entidades

#### 1. Local / Establecimiento (`venues/{venueId}`)
- **Identificador:** `venueId` (slug único, ej. `'caronte'`, `'zona-g-bar'`).
- **Relaciones:** `venueId` es la clave canónica foránea para eventos, cierres, consumos y staff.
- **Campos Públicos (Landing / Directorio):** `id`, `name`, `address`, `zone`, `lat`, `lng`, `description`, `photos`, `dressCode`, `accessibility`, `parkingInfo`, `status`.
- **Campos Privados (Exclusivos Local & SuperAdmin):** `nit`, `branch_key`, `agreed_weekdays`, `bar_package_price_cop`, `included_consumptions`, `contract_id`, `staffUids`, `ownerUid`, `bankDetails`.
- **Lectura:** Pública/T1 para datos de proyección; Privada para staff asignado (`isVenueStaff(venueId)`) y `superadmin`.
- **Modificación:** Solo `superadmin` (términos contractuales/nit) y `admin` con capacidad `config` (textos de bienvenida, fotos, condiciones de sala).
- **Estados:** `draft` → `review` → `active` → `inactive` → `terminated`.

#### 2. Noche / Evento (`events/{eventId}`)
- **Identificador:** `eventId` (ej. `'rnd-caronte-2026-10-28'`).
- **Relación Canónica:** `event.venueId` (OBLIGATORIO, indexado).
- **Campos:** `id`, `venueId`, `venueName`, `status` (`'waiting' | 'in_progress' | 'completed' | 'cancelled'`), `dayDate`, `currentRound`, `tablesCount`, `participants` (array UIDs), `activeMatches`, `playedPairs`, `capacity`, `priceCop`.
- **Lectura:** Participantes confirmados leen su mesa y estado; anfitrión del local lee evento completo.
- **Modificación:** `superadmin` y anfitrión asignado a `event.venueId` con capacidad `operation`.

#### 3. Reservas (`users/{userId}.activeReservation` y subcolección / índice)
- **Identificador:** `bookingCode` (ej. `RND-7482`).
- **Relación:** Vinculado a `eventId` y `venueId`.
- **Campos:** `bookingCode`, `eventId`, `venueId`, `venueName`, `dayDate`, `tableNumber`, `cocktailName`, `status` (`'confirmed' | 'checked_in' | 'completed' | 'cancelled'`), `createdAt`.
- **Separación de Estados:**
  - *Estado de Reserva:* `confirmed` | `cancelled`
  - *Estado de Pago:* `ticket_paid` (Wompi) | `pending_cash` (en puerta)
  - *Estado de Asistencia:* `not_arrived` | `checked_in` | `no_show`

#### 4. Asistencia / Check-in (`events/{eventId}/checkins/{userId}`)
- **Identificador:** `${userId}` dentro de la subcolección de auditoría del evento.
- **Campos:** `userId`, `eventId`, `venueId`, `checkedInAt` (timestamp ISO), `operatorUid`, `method` (`'qr_scanner' | 'manual_entry'`), `initialTier`.
- **Garantía:** Registro idempotente. Dos lecturas del mismo QR devuelven el registro existente sin duplicar participantes ni reiniciar el motor.

#### 5. Consumos y Cierre de Noche (`night_closings/{closingId}`)
- **Identificador:** `${venueId}_${eventId}`.
- **Campos:** `closingId`, `venueId`, `eventId`, `closedAt`, `operatorUid`, `attendeesCount`, `includedDrinksCount`, `extraDrinksCop`, `foodCop`, `barTotalCop`, `rondaCommissionCop`, `netVenueCop`, `status` (`'draft' | 'submitted' | 'approved' | 'settled'`), `notes`, `adjustmentLog`.
- **Inmutabilidad:** Una vez en estado `approved`, queda bloqueada la edición directa; solo admite adiciones en `adjustmentLog`.

#### 6. Beneficios y Cortesías (`benefit_redemptions/{redemptionId}`)
- **Identificador:** `${venueId}_${benefitCode}_${userId}`.
- **Campos:** `redemptionId`, `venueId`, `userId`, `benefitType` (`'welcome_cocktail' | 'second_date_discount'`), `redeemedAt`, `operatorUid`, `status` (`'valid' | 'used' | 'rejected'`).
- **Protección Concurrente:** Canje único verificado atómicamente antes de servir el trago.

#### 7. Miembros de Equipo del Local (`users/{uid}` + `venues/{venueId}.staff`)
- **Campos en User:** `role: 'admin'`, `venueId: string`, `venueIds: string[]`, `venueCapabilities: string[]`.
- **Capacidades Específicas:**
  - `read`: Consulta de agenda y métricas.
  - `reception`: Puerta, escáner QR y control de acceso.
  - `operation`: Control del motor MEM-RR y rotación de mesas.
  - `cashier`: Registro de consumos, borrador y envío de cierres de caja.
  - `config`: Edición de ficha del bar y carta de bienvenida.
  - `team`: Asignación y revocación de colaboradores del local.

---

### 2.2 Matriz de Sincronización entre Paneles
| Flujo Operativo | Productor (Escritura) | Consumidores en Tiempo Real (Lectura) | Garantía de Consistencia |
| :--- | :--- | :--- | :--- |
| **A. Publicación de Noche** | SuperAdmin / Venue Admin (`events`) | `/admin` (Agenda), `/app` (Lobby), `landing.html` | Firestore realtime listener con filtro de status `waiting` |
| **B. Reserva de Cupo** | Cliente / Wompi Webhook (`users`, `events`) | `/app` (Boleta), `/admin` (Lista confirmados), `/superadmin` | Transacción atómica de incremento de participantes |
| **C. Check-in en Puerta** | `/admin` en recepción (`events/checkins`) | `/app` (Pantalla de Mesa y Silla), `/admin` (Consola Sala) | Idempotencia: `setDoc` con ID determinista del UID |
| **D. Transición de Ronda** | `/admin` en sala (`events.currentRound`) | `/app` (Mesa actual de los 24 asistentes), `/admin` | Suscripción sincrónica al documento del evento |
| **E. Cierre de Noche** | `/admin` en caja (`night_closings`) | `/superadmin` (Tesorería / Payouts), `/admin` (Historial) | Bloqueo de mutaciones en estado `approved` |
| **F. Canje de Beneficio** | `/admin` en barra (`benefit_redemptions`) | `/app` (Estado canjeado en cliente), `/admin` | Verificación de no-existencia previa del ID |

---

## 📌 PASO 3. Autorización Estricta por Establecimiento y Aislamiento

### 3.1 Vulnerabilidades Identificadas en el Esquema Previo
1. `isAdmin()` otorgaba `isStaff() == true` globalmente en `firestore.rules`.
2. Un anfitrión con sesión de Caronte podía leer y modificar eventos de cualquier otro local.
3. El frontend dependía de un fallback `adminUser?.venueId ?? 'rnd-caronte-mar-25'`, sin verificar si el UID estaba asignado al local.
4. El anfitrión podía leer campos personales y sensibles de usuarios (matches cruzados, chats, selfies KYC).

### 3.2 Reglas de Seguridad Blindadas (`firestore.rules`)
Se implementa la función helper `isVenueStaff(venueId)` y se delimita el acceso:
- Un operador `admin` solo tiene privilegios sobre documentos donde `venueId` coincida con su `venueId` o esté en su array `venueIds`.
- Se deniega a `admin` la lectura de colecciones globales financieras (`commission_ledger`, `payouts`, `transactions`, `invest_tokens`).
- `superadmin` conserva acceso omnisciente y soberano.

### 3.3 Suite de Validación Automatizada
Script local de verificación de aislamiento:
- Prueba positiva: Anfitrión de `caronte` lee y opera evento `caronte-noche-01`.
- Prueba negativa: Anfitrión de `caronte` intenta leer/modificar evento `salto-noche-01` (debe retornar `PERMISSION_DENIED`).
- Prueba de auto-elevación: Anfitrión intenta cambiar su propio `venueId` o su `role` a `superadmin` (debe ser rechazado por la regla de actualización de `users`).
