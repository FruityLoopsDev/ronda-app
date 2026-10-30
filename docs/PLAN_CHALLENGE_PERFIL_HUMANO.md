# 🍸 PLAN: DESAFÍO DE BIENVENIDA RONDA ("TU PASAPORTE A LA NOCHE")
## Onboarding Gamificado, Humano y Amistoso para Perfiles Nuevos o Incompletos

> **Versión:** 1.0  
> **Objetivo:** Transformar el registro y verificación de un formulario frío/técnico a una experiencia guiada, conversacional y gratificante que motive al usuario a completar su perfil al 100% en menos de 90 segundos.  
> **Tono de Marca:** Sofisticado pero cálido, cómplice, sin jerga técnica ni burocracia (prohibido hablar de "KYC", "trustTier" o "payloads" al usuario final).

---

## 1. El Diagnóstico del Problema Actual
Actualmente, un usuario nuevo o incompleto se encuentra con un modal gris (`#modal-profile`) con 7 campos apretados, avisos legales densos y botones deshabilitados sin explicación clara. Esto genera **fricción cognitiva**, dudas sobre privacidad y abandono prematuro antes de ver los eventos.

---

## 2. La Solución: "El Pasaporte RONDA" (Challenge de 4 Brindis)

En lugar de un formulario denso, el usuario desbloquea su **Pasaporte de Entrada** a través de 4 micro-pasos intuitivos con recompensas tangibles inmediatas.

```
┌─────────────────────────────────────────────────────────────┐
│ 🎟️ TU PASAPORTE A LA NOCHE                    [ 75% ] ──┐   │
│ "Estás a un paso de sentarte en tu primera mesa secreta"    │
├─────────────────────────────────────────────────────────────┤
│  ✓ 1. ¿Cómo te llamamos en la barra? (Nombre & Edad)        │
│  ✓ 2. Tu primera copa va por la casa (Tu Cóctel & Zona)     │
│  ○ 3. Ponle rostro a tu copa (Verificación en 30 seg)  ▶     │
│  ○ 4. Sello Profesional (LinkedIn opcional · Insignia)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Desglose de las 4 Misiones del Challenge

### 🥂 Misión 1: Tu Esencia Básica ("¿Cómo te llamamos en la barra?")
- **Campos:** Nombre de pila, edad y género / afinidad.
- **Micro-copy humano:**  
  *«Para presentarte con elegancia cuando suene la campana. Queremos llamarte por tu nombre y asegurarnos de que compartas mesa con personas en tu misma sintonía de edad.»*
- **Feedback Inmediato:** *"¡Mucho gusto, [Nombre]! Ya eres parte de la conversación."* (+25% de progreso).

### 🍸 Misión 2: Tu Brindis & Tu Barrio ("Tu primera copa va por la casa")
- **Campos:** Cóctel favorito (`badge-cocktail`) y Zona predilecta (`badge-zone`: Chapinero Alto, Zona G, Usaquén, Parque 93).
- **Micro-copy humano:**  
  *«El primer trago de la noche está incluido con tu entrada. ¿Eres más de Gin Tonic con botánicos, un Negroni clásico o un cóctel de autor sin alcohol? Cuéntanos también en qué barrio te mueves para sugerirte bares a tu medida.»*
- **Feedback Inmediato:** Desbloquea la burbuja destacada de su historia en el perfil (+25% de progreso).

### 📸 Misión 3: Ponle Rostro a tu Copa ("Cero perfiles falsos, 100% personas reales")
- **Acción:** Selfie ágil de 15 segundos con detección de vida (sonrisa o parpadeo).
- **Micro-copy humano:**  
  *«En RONDA no hay pantallas ni perfiles falsos. Nos aseguramos de que cada persona en la sala sea quien dice ser para que disfrutes con total tranquilidad. Una foto rápida y listo: nunca compartiremos tu documento con nadie.»*
- **Recompensa Inmediata:**  
  - Se ilumina el **Escudo Verde Verificado** 🛡️ en su perfil.
  - Se **desbloquea en vivo la Cartelera Secreta de Gastrobares y Lounges** (`trustTier: 1` en Firestore).

### 💼 Misión 4 (Opcional con Estrella): Tu Sello Profesional ("Conecta tu LinkedIn")
- **Acción:** Validar URL de LinkedIn.
- **Micro-copy humano:**  
  *«Una red de solteros profesionales, emprendedores y creativos en Bogotá. Añade tu perfil para sumar la insignia profesional y encontrar conexiones con tus mismas inquietudes.»*
- **Recompensa Inmediata:**  
  - Insignia de **Profesional Verificado** en el sobre de matches.
  - Pase completado al 100% con animación de bienvenida.

---

## 4. Puntos de Contacto en la Interfaz (UX/UI Touchpoints)

### A. Widget Flotante en el Lobby (`#view-lobby`)
- Ubicado en la parte superior de la cartelera de eventos.
- Si el usuario tiene `trustTier == 0`, la cartelera muestra los bares con un suave efecto *blur editorial* y una tarjeta atractiva:  
  *«🍸 Desbloquea los 3 speakeasies de este jueves. Completa los 2 minutos de tu Pasaporte para ver las barras aliadas y reservar tu mesa.»*
- Barra de progreso animada con los colores de marca (`--luz: #F0A830`, `--botella: #2E6B54`).

### B. Micro-Stepper Secuencial (Reemplazo del modal abrumador)
- En lugar de abrir un modal con 10 inputs juntos, al tocar el botón *"Comenzar Desafío"*, se abre un diálogo estilo historia o tarjetas deslizantes (1 sola pregunta a la vez):
  1. Pantalla 1: Nombre + Edad.
  2. Pantalla 2: Elige tu copa (grid visual con emojis e ilustraciones de cócteles).
  3. Pantalla 3: Verificación facial asistida con guía en tiempo real (*"Mira a la cámara y sonríe"*).
- Botón *"Guardar y continuar"* siempre visible con micro-animaciones suaves.

### C. Celebración de Completitud ("¡Estás listo para brindar!")
- Al alcanzar los 3 pasos esenciales (Nombre + Cóctel + Verificación):
  - Animación sutil de choque de copas 🥂.
  - Toast dorado: *«¡Pasaporte Desbloqueado! Tienes acceso a todos los eventos de la semana.»*
  - Redirección automática a la selección de mesas.

---

## 5. Arquitectura Técnica y Lógica de Negocio

### Helper de Cálculo de Estado (`src/onboarding.ts` o módulo en `profile.ts`):
```typescript
export interface ProfileChallengeState {
  completionPercent: number; // 0 a 100
  hasBasicInfo: boolean;     // name && age >= 18 && gender
  hasPreferences: boolean;   // preferredCocktail || preferredZone
  isVerified: boolean;       // trustTier >= 1 (KYC)
  hasLinkedin: boolean;      // linkedinVerified (opcional)
  nextAction: string;        // ID de la siguiente tarea sugerida
}
```

### Reglas de Negocio Vinculadas:
1. **Regla de lectura de venues en Firestore:** Requiere `trustTier >= 1`. Por ende, la Misión 3 es el habilitador directo de la compra/reserva.
2. **Progreso Progresivo No Bloqueante:** El usuario puede explorar la app, pero los botones de *"Reservar Mesa"* le muestran amablemente: *«Te falta solo tu foto de seguridad para confirmar tu asiento»*, llevándolo directo a la Misión 3 sin rodeos.
3. **Persistencia Silenciosa:** Cada paso completado guarda de inmediato en Firestore para que el usuario nunca pierda lo que ya ingresó.
