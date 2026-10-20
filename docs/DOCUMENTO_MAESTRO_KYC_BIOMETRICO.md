# 📋 DOCUMENTO MAESTRO: AUDITORÍA Y REDISEÑO DE ALTO RENDIMIENTO — KYC BIOMÉTRICO (RONDA)

> **Destinatario:** Ingeniero Especialista en Computer Vision en Navegador / WebGL / Web Workers / @vladmandic/face-api.  
> **Proyecto:** RONDA (PWA Speed Dating presencial para bares y gastrobares).  
> **Stack:** Vite, TypeScript (Strict), Vanilla DOM/CSS, Firebase v12 (Auth/Firestore), `@vladmandic/face-api` v1.7.15, Tesseract.js.  
> **Objetivo:** Transformar el flujo biométrico de KYC de un proceso pesado y propenso a congelar el hilo principal (Main Thread) en una experiencia móvil fluida a 60 FPS, de bajo consumo de memoria y alta tasa de aprobación.

---

## 1. 🔍 Resumen Ejecutivo y Problema

### Síntomas Actuales
1. **Caída Severa de FPS / Bloqueo del UI (Main Thread Lag):** Al abrir la cámara y montar el detector facial para el encuadre dentro del óvalo guía, el hilo principal de JavaScript se satura. En dispositivos móviles de gama media/baja o Safari iOS, la interfaz se congela o experimenta latencias de 400ms a 1.2s por frame.
2. **Consumo Excesivo de Memoria (Riesgo OOM en iOS):** Al procesar buffers de video en resolución nativa de cámara (1080p o 4K) a través de tensores de WebGL sin liberación agresiva (`tf.dispose`), Safari en iPhone recarga la pestaña por consumo excesivo de memoria.
3. **Fricción en la Experiencia de Usuario (Liveness Challenge):** El reto de vida (parpadeo, sonrisa, giro) no ofrece retroalimentación instantánea debido a la latencia acumulada de inferencia.
4. **Desfase con OCR:** La lectura del documento de identidad mediante OCR compite por recursos de CPU/GPU con los modelos de detección facial.

---

## 2. 🏗️ Arquitectura y Archivos Clave del Módulo

| Archivo | Responsabilidad Actual | Problemas Identificados |
| :--- | :--- | :--- |
| `src/face-verify.ts` | Carga de modelos de Face-API, cálculo de descriptores (128-d vector), comparación euclidiana y presets de detección. | Carga de modelos y detección acopladas al contexto de ventana principal. Falta de recolección de basura estricta de tensores. |
| `src/verification.ts` | Orquestador visual del flujo KYC (máquina de estados: Permisos ➔ Óvalo ➔ Liveness ➔ Captura Cédula ➔ Validación). | Bucles de renderizado asíncronos y manipulación pesada del DOM en cada ciclo de video. |
| `src/kyc-review.ts` | Fallback de contingencia: almacena capturas y telemetría en Firestore (`kycReviews`) si falla la biometría automática. | **Debe mantenerse intacto**. Es el respaldo legal y operativo para revisión humana. |
| `src/db.ts` | Contrato de datos (`User.faceVerified`, `kycStatus`). | Debe preservarse la compatibilidad de tipos TypeScript (`npx tsc --noEmit`). |

---

## 3. 🎯 Restricciones y Reglas No Negociables del Negocio

1. **Compilación Estricta:** Cualquier solución propuesta debe pasar `npx tsc --noEmit` con **0 errores**.
2. **Garantía de Fallback Manual:** Bajo ninguna circunstancia se debe bloquear al usuario si el hardware o la cámara no colaboran. Tras 2 o 3 intentos fallidos, el sistema debe derivar suavemente a `submitKycReview()` en Firestore para validación humana por parte de los administradores.
3. **Compatibilidad Móvil Obligatoria:** 
   - Elementos `<video>` deben llevar atributos estrictos: `playsinline`, `autoplay`, `muted`.
   - Compatibilidad completa con WebKit / Safari iOS (donde `getUserMedia` y WebGL tienen restricciones de permisos y contexto).
4. **Independencia de Dependencias Pesadas Nuevas:** No agregar frameworks monolíticos adicionales; optimizar sobre la base existente (`@vladmandic/face-api`, Web APIs estándar).

---

## 4. ⚙️ Diagnóstico Técnico Detallado

### A. Ciclo de Inferencia y Tamaño de Entrada
- **Problema:** Enviar frames directos de la cámara (por ejemplo, 1280x720 o 1920x1080) al detector `tinyFaceDetector`.
- **Patrón Recomendado:** Inferencia sobre un `OffscreenCanvas` o canvas oculto downscaleado a **224x224 px** o **320x320 px** máximo.
- **Tasa de Refresco:** La interfaz del óvalo solo requiere ~3 a 5 FPS de inferencia para saber si la cara está centrada; los 60 FPS de animación del óvalo deben ser puramente CSS / `requestAnimationFrame` desacoplado del cálculo de IA.

### B. Ciclo de Vida de Tensores (Memory Leaks)
- Si los tensores generados en cada frame no se ejecutan dentro de `tf.tidy()` o no se limpian manualmente, se acumulan en la memoria de WebGL, provocando bloqueos del hilo de renderizado o expulsión por el sistema operativo móvil.

### C. Estrategia de Retos de Vida (Liveness Detection)
- Actualmente se intenta validar gestos consecutivos en tiempo real. 
- Se necesita una heurística liviana:
  - **Distancia Interocular (IOD):** Confirmar profundidad y escala.
  - **Eye Aspect Ratio (EAR):** Detección de parpadeo con bajo coste computacional usando landmarks de 68 puntos.
  - **Mouth Aspect Ratio (MAR):** Detección de sonrisa o apertura de boca.

### D. Comparación Cruzada (Selfie vs Documento)
- **Umbral de Distancia Euclidiana:** `faceapi.euclideanDistance(descSelfie, descDoc)`
- En producción, fotos de documentos colombianos (Cédula de Ciudadanía con holograma o plástico reflectivo) degradan la precisión. El umbral ideal suele rondar entre `0.45` y `0.58`.

---

## 5. 📦 Entregables Requeridos del Experto

El especialista debe entregar una solución lista para producción que cubra:

### 1. `src/face-verify.ts` (Motor Optimizado)
- Carga perezosa (lazy loading) e inicialización singleton de modelos (`tinyFaceDetector`, `faceLandmark68Net`, `faceRecognitionNet`).
- Función de downscale ultra-eficiente para alimentar el detector.
- Throttling configurable con descarte de frames obsoletos (si una inferencia tarda más que el intervalo, omitir el frame siguiente en vez de encolar).
- Manejo correcto de liberación de memoria y tensores.

### 2. `src/verification.ts` (Orquestación Desacoplada)
- Inicialización asíncrona segura de la cámara sin pantallas negras ni loops de polling bloqueantes.
- Desacoplamiento total: la animación del óvalo (UI) corre a 60 FPS mientras la IA reporta estado (`'buscando' | 'centrado' | 'muy_lejos' | 'muy_cerca' | 'listo'`) a 3-5 FPS.
- Máquina de estados clara y transiciones suaves con microinteracciones.
- Fallback automático hacia `kyc-review.ts` tras fallos persistentes.

### 3. Checklist de Verificación y Métricas de Rendimiento
- Consumo máximo de memoria RAM estimado en móvil (< 80 MB para el proceso de IA).
- Tiempo de respuesta de inferencia (< 120 ms por frame en gama media).
- Instrucciones de prueba local paso a paso en modo responsive / emulación táctil.

---

## 6. 📁 Contexto del Código Actual (Snippets de Referencia)

### Extracción de Descriptores Actual (`src/face-verify.ts`):
```typescript
export async function getFaceDescriptor(input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<Float32Array | null> {
  await loadFaceModels();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const detection = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection ? detection.descriptor : null;
}
```

### Orquestación de Cámara y Video Actual (`src/verification.ts`):
```typescript
private async waitForVideoReady(video: HTMLVideoElement, timeoutMs = 8000): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout de cámara')), timeoutMs);
    const onReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        clearTimeout(timer);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('playing', onReady);
        resolve();
      }
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);
  });
}
```

### Fallback Manual Existente (`src/kyc-review.ts`):
```typescript
export async function submitKycReview(data: KycReviewData): Promise<string> {
  // Guarda captura de cédula, selfie y motivo de falla en colección 'kycReviews' de Firestore
  // para que el equipo humano apruebe o rechace. NUNCA DEBE SER ELIMINADO.
}
```
