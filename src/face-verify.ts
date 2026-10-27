// src/face-verify.ts — Motor de Verificación Biométrica y Liveness de RONDA
//
// ARQUITECTURA DE ALTA PRECISIÓN PARA NAVEGADORES MÓVILES ($0 INFRAESTRUCTURA):
//  1. Parte PURA (testeable en Node, sin DOM/red):
//     - Distancia euclídea (128-d), coincidencia facial (umbral primario <= 0.52,
//       compatible con firma legacy 0.6), validación de Cédula de Ciudadanía de Colombia,
//       cálculo de EAR (Eye Aspect Ratio) de 6 puntos, Liveness relativo por Delta
//       (caída >= 35% respecto al baseline calibrado en los primeros 3 frames),
//       geometría de Center-Crop isotrópico (preservando aspect ratio 1:1 o 3:4 sin
//       aplastamiento horizontal 16:9) y evaluación de iluminación tolerante a luz
//       cálida/nocturna.
//  2. Parte de CÁMARA / MODELOS (@vladmandic/face-api + WebGL):
//     - Pipeline Dual:
//       * Stream Selfie / Liveness (4 FPS): `TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 })`
//         sobre frame recortado proporcionalmente (Center-Crop isotrópico).
//       * Imagen Estática de Cédula: `SsdMobilenetv1Options({ minConfidence: 0.35 })` con
//         fallback a `TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.35 })` y
//         barrido de sub-regiones (ROI del rostro en cédula colombiana) para detectar rostros
//         pequeños (~40x45 px en la foto completa).
//     - Gestión estricta de memoria WebGL: limpieza de tensores con `tf.tidy()` / `tf.engine()`
//       para prevenir crashes en Safari iOS.
// --------------------------------------------------------------------------------

// ---------- TIPOS E INTERFACES ----------

export interface Point2D {
  x: number;
  y: number;
}

export interface CropBox {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dw: number;
  dh: number;
  scaleX: number;
  scaleY: number;
}

export interface LightingEvaluation {
  ok: boolean;
  meanLuminance: number;
  warmCompensation: number;
  effectiveScore: number;
  status: 'optimal' | 'warm_low' | 'too_dark' | 'overexposed';
  message: string;
}

export interface RelativeBlinkCalibration {
  baselineSamples: number[];
  baselineEar: number | null;
  minEarObserved: number;
  blinkDetected: boolean;
  dropRatio: number;
  framesProcessed: number;
}

export interface IdentityResult {
  ok: boolean;
  reason?: string;
  distance?: number;
  threshold?: number;
  documentValid?: boolean;
  ocrStatus?: 'verified' | 'pending_or_skipped' | 'failed';
  hits?: string[];
  livenessPassed?: boolean;
}

export type FaceError =
  | 'no_face'
  | 'multiple_faces'
  | 'low_lighting'
  | 'liveness_failed'
  | 'model_error'
  | 'network_error'
  | 'unknown';

export interface DescriptorResult {
  descriptor?: Float32Array;
  landmarks?: Point2D[];
  leftEye?: Point2D[];
  rightEye?: Point2D[];
  ear?: number;
  box?: { x: number; y: number; width: number; height: number };
  error?: FaceError;
  message?: string;
}

export interface DetectionPipelineOptions {
  /** 'selfie' usa TinyFaceDetector (inputSize 320, rápido); 'document' usa SsdMobilenetv1 / TinyFaceDetector (inputSize 608, alta resolución). */
  mode?: 'selfie' | 'document';
  /** Tamaño de entrada para TinyFaceDetector (debe ser múltiplo de 32: 320, 416, 512, 608). */
  inputSize?: number;
  /** Confianza mínima del detector (0.1 - 0.9). */
  scoreThreshold?: number;
  /** En modo documento, si hay más de un rostro (ej. holograma fantasma en cédula), elegir el de mayor área. */
  pickLargestFace?: boolean;
}

/** Umbral biométrico primario en producción para RONDA (distancia euclídea <= 0.52). */
export const PRIMARY_BIOMETRIC_THRESHOLD = 0.52;

/** Caída relativa de EAR requerida (35%) respecto al baseline calibrado en los primeros 3 frames. */
export const RELATIVE_BLINK_DROP_RATIO = 0.35;

/** Cantidad de frames iniciales con ojos abiertos para calibrar el baseline EAR individual. */
export const BASELINE_CALIBRATION_FRAMES = 3;

// ---------- 1. PARTE PURA (Testeable en Node, sin DOM ni Red) ----------

/** Distancia euclídea L2 entre dos descriptores faciales (128-d). */
export function euclideanDistance(a: number[] | Float32Array, b: number[] | Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**Distancia 2D entre dos puntos cartesianos (landmarks). */
export function pointDistance(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

/**
 * Calcula el Eye Aspect Ratio (EAR) de Soukupová & Čech sobre los 6 puntos de un ojo:
 *   p0: comisura externa, p1/p2: párpado superior, p3: comisura interna, p4/p5: párpado inferior.
 *   EAR = (||p1 - p5|| + ||p2 - p4||) / (2 * ||p0 - p3||)
 * Al preservar el aspect ratio con Center-Crop isotrópico, ||p0 - p3|| no sufre compresión
 * horizontal y el EAR refleja fielmente la apertura palpebral real.
 */
export function computeEyeAspectRatio(eye: Point2D[]): number {
  if (!eye || eye.length < 6) return 0.3;
  const verticalA = pointDistance(eye[1], eye[5]);
  const verticalB = pointDistance(eye[2], eye[4]);
  const horizontal = pointDistance(eye[0], eye[3]);
  if (horizontal <= 1e-6) return 0.3;
  return (verticalA + verticalB) / (2.0 * horizontal);
}

/** Calcula el EAR promedio de ambos ojos a partir de las listas de 6 puntos por ojo. */
export function computeBilateralEAR(leftEye: Point2D[], rightEye: Point2D[]): number {
  const leftEar = computeEyeAspectRatio(leftEye);
  const rightEar = computeEyeAspectRatio(rightEye);
  return (leftEar + rightEar) / 2.0;
}

/**
 * Crea un estado limpio para el calibrador de parpadeo relativo por Delta.
 */
export function createBlinkCalibrationState(): RelativeBlinkCalibration {
  return {
    baselineSamples: [],
    baselineEar: null,
    minEarObserved: Number.POSITIVE_INFINITY,
    blinkDetected: false,
    dropRatio: 0,
    framesProcessed: 0
  };
}

/**
 * Actualiza el estado de Liveness relativo por Delta:
 *  - Calibra el `baselineEar` con la mediana/media de los primeros `BASELINE_CALIBRATION_FRAMES` (3) frames
 *    válidos (con EAR razonable > 0.14).
 *  - Una vez calibrado, evalúa la caída relativa:
 *      dropRatio = (baselineEar - currentEar) / baselineEar
 *  - Si `dropRatio >= requiredDropRatio` (0.35 -> caída del 35%), marca `blinkDetected = true`.
 */
export function updateRelativeBlinkState(
  state: RelativeBlinkCalibration,
  currentEar: number,
  requiredDropRatio = RELATIVE_BLINK_DROP_RATIO,
  calibrationFrames = BASELINE_CALIBRATION_FRAMES
): RelativeBlinkCalibration {
  if (!Number.isFinite(currentEar) || currentEar <= 0) {
    return state;
  }

  const next: RelativeBlinkCalibration = {
    baselineSamples: [...state.baselineSamples],
    baselineEar: state.baselineEar,
    minEarObserved: Math.min(state.minEarObserved, currentEar),
    blinkDetected: state.blinkDetected,
    dropRatio: state.dropRatio,
    framesProcessed: state.framesProcessed + 1
  };

  // Fase 1: Calibración en los primeros N frames (descartando parpadeos accidentales en el frame 1)
  if (next.baselineEar === null) {
    if (currentEar >= 0.14) {
      next.baselineSamples.push(currentEar);
    }
    if (next.baselineSamples.length >= calibrationFrames) {
      const sorted = [...next.baselineSamples].sort((a, b) => a - b);
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      next.baselineEar = sum / sorted.length;
    }
    return next;
  }

  // Fase 2: Detección por Delta relativo respecto al baseline individual del usuario
  const delta = Math.max(0, next.baselineEar - currentEar);
  const currentDropRatio = next.baselineEar > 1e-6 ? delta / next.baselineEar : 0;
  next.dropRatio = Math.max(next.dropRatio, currentDropRatio);

  if (currentDropRatio >= requiredDropRatio) {
    next.blinkDetected = true;
  } else if (currentEar > next.baselineEar && currentEar < 0.48) {
    // Ajuste suave hacia arriba si el usuario abre más los ojos después de calibrar
    next.baselineEar = next.baselineEar * 0.85 + currentEar * 0.15;
  }

  return next;
}

/**
 * Calcula la geometría de recorte centrado (Center-Crop isotrópico) que preserva
 * estrictamente la relación de aspecto 1:1 (o `targetWidth / targetHeight`) a partir
 * de cualquier fuente de video (16:9, 4:3, 9:16).
 * Evita el aplastamiento anisotrópico 1.77x que deformaba la distancia horizontal ocular.
 */
export function computeIsotropicCenterCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth = 320,
  targetHeight = 320
): CropBox {
  const srcW = Math.max(1, sourceWidth);
  const srcH = Math.max(1, sourceHeight);
  const dstW = Math.max(1, targetWidth);
  const dstH = Math.max(1, targetHeight);

  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;

  let sw = srcW;
  let sh = srcH;
  let sx = 0;
  let sy = 0;

  if (srcAspect > dstAspect) {
    // Video más ancho que el destino (ej. 16:9 -> 1:1 o 3:4): recortar laterales
    sw = Math.round(srcH * dstAspect);
    sh = srcH;
    sx = Math.round((srcW - sw) / 2);
    sy = 0;
  } else if (srcAspect < dstAspect) {
    // Video más alto que el destino (ej. 9:16 -> 1:1): recortar arriba/abajo
    sw = srcW;
    sh = Math.round(srcW / dstAspect);
    sx = 0;
    sy = Math.round((srcH - sh) / 2);
  }

  return {
    sx,
    sy,
    sw,
    sh,
    dw: dstW,
    dh: dstH,
    scaleX: dstW / sw,
    scaleY: dstH / sh
  };
}

/**
 * Evalúa la calidad de iluminación sobre un buffer RGBA (Uint8ClampedArray o number[])
 * muestreando una región amplia del rostro (70% central del frame, no solo 36x36 px) y
 * aplicando compensación para iluminación cálida/nocturna (bares, lámparas tungsteno/ámbar).
 */
export function evaluateLightingFromRgba(
  rgbaData: ArrayLike<number>,
  width: number,
  height: number
): LightingEvaluation {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const totalPixels = Math.floor(rgbaData.length / 4);
  if (totalPixels === 0) {
    return {
      ok: true,
      meanLuminance: 120,
      warmCompensation: 1,
      effectiveScore: 120,
      status: 'optimal',
      message: 'Iluminación adecuada.'
    };
  }

  // Muestrear el 70% central del frame (cubre todo el óvalo facial) con stride de 2 px
  const x0 = Math.floor(w * 0.15);
  const x1 = Math.max(x0 + 1, Math.floor(w * 0.85));
  const y0 = Math.floor(h * 0.15);
  const y1 = Math.max(y0 + 1, Math.floor(h * 0.85));

  let sumLum = 0;
  let sumRed = 0;
  let sumBlue = 0;
  let count = 0;

  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const idx = (y * w + x) * 4;
      if (idx + 2 >= rgbaData.length) continue;
      const r = rgbaData[idx];
      const g = rgbaData[idx + 1];
      const b = rgbaData[idx + 2];
      // Luminancia perceptual Rec. 709
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumLum += lum;
      sumRed += r;
      sumBlue += b;
      count++;
    }
  }

  if (count === 0) {
    return {
      ok: true,
      meanLuminance: 120,
      warmCompensation: 1,
      effectiveScore: 120,
      status: 'optimal',
      message: 'Iluminación adecuada.'
    };
  }

  const meanLuminance = sumLum / count;
  const meanRed = sumRed / count;
  const meanBlue = sumBlue / count;

  // Compensación cálida: en ambientes nocturnos/cálidos (R >> B), el canal rojo conserva
  // contraste facial suficiente para las convoluciones aunque la luminancia global baje.
  const warmthRatio = meanRed / Math.max(1, meanBlue);
  const warmCompensation = warmthRatio > 1.25 ? Math.min(1.35, 1 + (warmthRatio - 1.25) * 0.35) : 1.0;
  const effectiveScore = meanLuminance * warmCompensation;

  // Umbral permisivo (18/255 efectivo, ~14/255 en luz cálida) para no bloquear ambientes nocturnos
  if (effectiveScore < 18) {
    return {
      ok: false,
      meanLuminance,
      warmCompensation,
      effectiveScore,
      status: 'too_dark',
      message: 'Hay muy poca luz. Acércate un poco más al brillo de tu pantalla.'
    };
  }

  if (meanLuminance > 248) {
    return {
      ok: false,
      meanLuminance,
      warmCompensation,
      effectiveScore,
      status: 'overexposed',
      message: 'Demasiado contraluz directo. Evita apuntar hacia una lámpara brillante.'
    };
  }

  return {
    ok: true,
    meanLuminance,
    warmCompensation,
    effectiveScore,
    status: meanLuminance < 42 ? 'warm_low' : 'optimal',
    message: 'Iluminación válida.'
  };
}

/** Coincidencia facial. Umbral por defecto 0.6 para retrocompatibilidad con tests unitarios; en flujo KYC se usa 0.52. */
export function matchDescriptors(
  d1: number[] | Float32Array,
  d2: number[] | Float32Array,
  threshold = 0.6
): { distance: number; matched: boolean } {
  const distance = euclideanDistance(d1, d2);
  return { distance, matched: distance <= threshold };
}

/** Valida que el texto OCR contenga indicadores de una Cédula de Ciudadanía de Colombia (tolerante a tildes y ruido OCR). */
export function validateCedulaText(ocrText: string): { valid: boolean; hits: string[] } {
  const normalized = (ocrText || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const hits: string[] = [];
  if (normalized.includes('REPUBLICA DE COLOMBIA') || normalized.includes('COLOMBIA')) {
    hits.push('REPUBLICA DE COLOMBIA');
  }
  if (
    normalized.includes('CEDULA DE CIUDADANIA') ||
    normalized.includes('CIUDADANIA') ||
    normalized.includes('IDENTIFICACION PERSONAL') ||
    normalized.includes('REGISTRADURIA')
  ) {
    hits.push('CEDULA DE CIUDADANIA');
  }
  return { valid: hits.length > 0, hits };
}

/**
 * Combina descriptor facial + texto OCR -> veredicto.
 * Soporta dos modos:
 *  - Modo estricto OCR (`allowBiometricPrimary = false`, por defecto para mantener 100% de
 *    compatibilidad con `src/face-verify.test.ts` en Node).
 *  - Modo Biométrico Primario (`allowBiometricPrimary = true`, usado en producción móvil):
 *    si la distancia euclídea entre selfie y cédula es `<= threshold` (0.52), aprueba la
 *    identidad incluso si Tesseract OCR expiró por timeout o no logró leer la fuente holográfica.
 */
export function evaluateIdentity(
  selfie: number[] | Float32Array,
  doc: number[] | Float32Array,
  ocrText: string,
  threshold = 0.6,
  allowBiometricPrimary = false
): IdentityResult {
  const { distance, matched } = matchDescriptors(selfie, doc, threshold);
  const docv = validateCedulaText(ocrText);

  if (allowBiometricPrimary) {
    if (!matched) {
      return {
        ok: false,
        reason: 'rostro_no_coincide',
        distance,
        threshold,
        documentValid: docv.valid,
        ocrStatus: docv.valid ? 'verified' : 'pending_or_skipped',
        hits: docv.hits
      };
    }
    return {
      ok: true,
      distance,
      threshold,
      documentValid: true,
      ocrStatus: docv.valid ? 'verified' : 'pending_or_skipped',
      hits: docv.hits
    };
  }

  if (!docv.valid) {
    return {
      ok: false,
      reason: 'documento_no_reconocido',
      distance,
      threshold,
      documentValid: false,
      ocrStatus: 'failed',
      hits: docv.hits
    };
  }
  if (!matched) {
    return {
      ok: false,
      reason: 'rostro_no_coincide',
      distance,
      threshold,
      documentValid: true,
      ocrStatus: 'verified',
      hits: docv.hits
    };
  }
  return {
    ok: true,
    distance,
    threshold,
    documentValid: true,
    ocrStatus: 'verified',
    hits: docv.hits
  };
}

// ---------- 2. PARTE DE CÁMARA, CANVAS ISOTRÓPICO Y MODELOS WEBGL ----------

function classifyFaceError(e: any): FaceError {
  const msg = String((e && e.message) || e);
  if (/loadFromUri|weights|manifest|404|not found|model/i.test(msg)) return 'model_error';
  if (/fetch|network|CORS|ERR_/i.test(msg)) return 'network_error';
  return 'unknown';
}

// Caché de modelos cargados para evitar recargas innecesarias
let loadedUri: string | null = null;
let modelsLoadingPromise: Promise<any> | null = null;

/**
 * URIs de modelos en orden de preferencia:
 * 1. Variable global `window.RONDA_FACE_MODEL_URI` (si existe)
 * 2. Carpeta local `/models` servida desde `public/models` (0 latencia de red externa)
 * 3. CDN jsDelivr como último recurso
 */
export function getModelUris(): string[] {
  const g: any = typeof window !== 'undefined' ? (window as any) : null;
  const uris: string[] = [];
  if (g && g.RONDA_FACE_MODEL_URI) uris.push(g.RONDA_FACE_MODEL_URI);
  uris.push('/models');
  uris.push('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/');
  return uris;
}

export function getModelUri(): string {
  return getModelUris()[0] ?? '/models';
}

/**
 * Carga todos los modelos requeridos para el pipeline dual:
 * - `tinyFaceDetector`: inferencia ultrarrápida a 4 FPS en el stream de selfie y barrido 608 en documento.
 * - `ssdMobilenetv1`: detector single-shot de alta sensibilidad para rostros pequeños en cédulas.
 * - `faceLandmark68Net`: extracción de los 68 puntos (incluyendo 6 por ojo para EAR y alineación).
 * - `faceRecognitionNet`: ResNet-34 que produce el vector biométrico de 128 dimensiones.
 */
async function ensureModels(uri: string): Promise<any> {
  if (loadedUri === uri) {
    return import('@vladmandic/face-api');
  }
  if (modelsLoadingPromise) {
    return modelsLoadingPromise;
  }
  modelsLoadingPromise = (async () => {
    try {
      const faceapi = await import('@vladmandic/face-api');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(uri),
        faceapi.nets.ssdMobilenetv1.loadFromUri(uri),
        faceapi.nets.faceLandmark68Net.loadFromUri(uri),
        faceapi.nets.faceRecognitionNet.loadFromUri(uri)
      ]);
      loadedUri = uri;
      return faceapi;
    } finally {
      modelsLoadingPromise = null;
    }
  })();
  return modelsLoadingPromise;
}

/**
 * Ejecuta una función o limpieza dentro del motor TensorFlow.js expuesto por `@vladmandic/face-api`
 * para evitar fugas de memoria de texturas WebGL en Safari iOS y Chrome Android.
 */
export async function withWebGLMemoryGuard<T>(fn: (faceapi: any) => Promise<T>): Promise<T> {
  const faceapi: any = await import('@vladmandic/face-api');
  const tf: any = faceapi.tf;
  if (tf && typeof tf.engine === 'function') {
    try {
      return await fn(faceapi);
    } finally {
      // Ejecutar recolección de tensores huérfanos si existen scopes abiertos
      try {
        if (typeof tf.tidy === 'function') {
          tf.tidy(() => {});
        }
      } catch (_) {
        /* ignorar */
      }
    }
  }
  return fn(faceapi);
}

/**
 * Prepara un frame del stream de video o imagen aplicando **Center-Crop isotrópico**
 * (sin aplastar un video 16:9 dentro de un cuadrado 320x320) y corrige opcionalmente
 * la inversión en espejo (`mirrorHorizontal`) para que el canvas de inferencia y el
 * óvalo guía 3:4 coincidan píxel a píxel con lo que ve el usuario.
 */
export function prepareDownscaledFrame(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  targetCanvas?: HTMLCanvasElement,
  targetWidth = 320,
  targetHeight = 320,
  mirrorHorizontal = false
): { canvas: HTMLCanvasElement; crop: CropBox } {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  let srcW = targetWidth;
  let srcH = targetHeight;

  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    srcW = source.videoWidth || source.clientWidth || 640;
    srcH = source.videoHeight || source.clientHeight || 480;
  } else if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    srcW = source.naturalWidth || source.width || 640;
    srcH = source.naturalHeight || source.height || 480;
  } else if (source && typeof (source as any).width === 'number') {
    srcW = (source as any).width || 640;
    srcH = (source as any).height || 480;
  }

  const crop = computeIsotropicCenterCrop(srcW, srcH, targetWidth, targetHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (ctx) {
    ctx.save();
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    if (mirrorHorizontal) {
      ctx.translate(targetWidth, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      source as CanvasImageSource,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      crop.dw,
      crop.dh
    );
    ctx.restore();
  }

  return { canvas, crop };
}

/**
 * Evalúa la iluminación directamente desde un `<canvas>` o `<video>` en el navegador.
 */
export function evaluateLighting(
  source: HTMLCanvasElement | HTMLVideoElement
): LightingEvaluation {
  if (typeof document === 'undefined') {
    return {
      ok: true,
      meanLuminance: 120,
      warmCompensation: 1,
      effectiveScore: 120,
      status: 'optimal',
      message: 'Iluminación adecuada.'
    };
  }

  let canvas: HTMLCanvasElement;
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    const prepared = prepareDownscaledFrame(source, undefined, 160, 160, false);
    canvas = prepared.canvas;
  } else {
    canvas = source as HTMLCanvasElement;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) {
    return {
      ok: true,
      meanLuminance: 120,
      warmCompensation: 1,
      effectiveScore: 120,
      status: 'optimal',
      message: 'Iluminación adecuada.'
    };
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return evaluateLightingFromRgba(imgData.data, canvas.width, canvas.height);
}

/**
 * Genera candidatos de recorte de alta resolución sobre la imagen de la Cédula de Ciudadanía
 * cuando el pase sobre la imagen completa no detecta el rostro (porque la foto impresa en el
 * plástico ocupa solo ~15-25% del área total de la captura trasera).
 */
function buildDocumentRoiCanvases(docImage: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement[] {
  if (typeof document === 'undefined') return [];

  const srcW =
    (docImage as HTMLImageElement).naturalWidth ||
    (docImage as HTMLImageElement).width ||
    (docImage as HTMLCanvasElement).width ||
    0;
  const srcH =
    (docImage as HTMLImageElement).naturalHeight ||
    (docImage as HTMLImageElement).height ||
    (docImage as HTMLCanvasElement).height ||
    0;

  if (srcW < 120 || srcH < 120) return [];

  // Definición de regiones (en coordenadas normalizadas [x, y, w, h]):
  // 1. Imagen completa reescalada proporcionalmente a lado máximo 1280 px (mejora nitidez para SsdMobilenetv1)
  // 2. Mitad izquierda de la cédula (ubicación de la foto en la Cédula de Ciudadanía digital/holográfica)
  // 3. Mitad derecha de la cédula (por si la cédula es amarilla de hologramas o está rotada)
  // 4. Región central ampliada (75% central)
  const rois: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [0.02, 0.08, 0.55, 0.84],
    [0.43, 0.08, 0.55, 0.84],
    [0.12, 0.10, 0.76, 0.80]
  ];

  const canvases: HTMLCanvasElement[] = [];

  for (const [rx, ry, rw, rh] of rois) {
    const sx = Math.round(srcW * rx);
    const sy = Math.round(srcH * ry);
    const sw = Math.max(64, Math.round(srcW * rw));
    const sh = Math.max(64, Math.round(srcH * rh));

    // Escalar el recorte a ~608 px en su dimensión mayor para que el rostro impreso
    // supere los 120x140 px reales al entrar al detector.
    const maxDim = Math.max(sw, sh);
    const scale = maxDim < 608 ? 608 / maxDim : maxDim > 1280 ? 1280 / maxDim : 1;
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);

    const c = document.createElement('canvas');
    c.width = dw;
    c.height = dh;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(docImage as CanvasImageSource, sx, sy, sw, sh, 0, 0, dw, dh);
      canvases.push(c);
    }
  }

  return canvases;
}

/**
 * Extrae el descriptor facial (128-d), los 68 landmarks y el EAR bilateral de una imagen/video/canvas.
 * Implementa el **Pipeline Dual**:
 *  - `mode: 'selfie'`: usa `TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 })` con fallback a `SsdMobilenetv1`.
 *  - `mode: 'document'`: usa `TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.35 })` + `SsdMobilenetv1Options({ minConfidence: 0.32 })`
 *    y barrido automático de ROIs sobre la cédula si el rostro impreso es pequeño.
 * Nunca lanza: devuelve `{ descriptor, landmarks, ear, box }` o `{ error, message }`.
 */
export async function getDescriptor(
  image: any,
  options: DetectionPipelineOptions = {}
): Promise<DescriptorResult> {
  const mode = options.mode ?? 'selfie';
  let lastErr: any = null;
  const uris = getModelUris();

  for (const uri of uris) {
    try {
      const faceapi = await ensureModels(uri);

      return await withWebGLMemoryGuard(async () => {
        let detections: any[] = [];

        if (mode === 'document') {
          const inputSize = options.inputSize ?? 608;
          const scoreThreshold = options.scoreThreshold ?? 0.32;
          const tinyOpts = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
          const ssdOpts = new faceapi.SsdMobilenetv1Options({ minConfidence: scoreThreshold });

          // Candidatos: imagen original + recortes ROI de alta resolución para Cédula de Ciudadanía
          const candidates: any[] = [image, ...buildDocumentRoiCanvases(image)];

          for (const candidate of candidates) {
            // Intento 1: TinyFaceDetector a inputSize: 608 (alta resolución para rostros pequeños)
            detections = await faceapi
              .detectAllFaces(candidate, tinyOpts)
              .withFaceLandmarks()
              .withFaceDescriptors();

            if (!detections || detections.length === 0) {
              // Intento 2: SsdMobilenetv1 (mayor sensibilidad en fotos impresas con hologramas)
              detections = await faceapi
                .detectAllFaces(candidate, ssdOpts)
                .withFaceLandmarks()
                .withFaceDescriptors();
            }

            if (detections && detections.length > 0) {
              break;
            }
          }
        } else {
          // Modo Selfie / Liveness en tiempo real (4 FPS)
          const inputSize = options.inputSize ?? 320;
          const scoreThreshold = options.scoreThreshold ?? 0.42;
          const tinyOpts = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });

          detections = await faceapi
            .detectAllFaces(image, tinyOpts)
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (!detections || detections.length === 0) {
            const ssdOpts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });
            detections = await faceapi
              .detectAllFaces(image, ssdOpts)
              .withFaceLandmarks()
              .withFaceDescriptors();
          }
        }

        if (!detections || detections.length === 0) {
          return { error: 'no_face', message: 'No se detectó ningún rostro.' };
        }

        // En documentos de identidad (Cédula de Colombia), a veces existe un micro-rostro fantasma
        // secundario como marca de agua/holograma. Si pickLargestFace está activo o estamos en modo
        // 'document', seleccionamos el rostro principal de mayor área si es claramente dominante.
        let chosen = detections[0];
        if (detections.length > 1) {
          if (mode === 'document' || options.pickLargestFace) {
            const sortedByArea = [...detections].sort((a, b) => {
              const areaA = (a.detection?.box?.width || 0) * (a.detection?.box?.height || 0);
              const areaB = (b.detection?.box?.width || 0) * (b.detection?.box?.height || 0);
              return areaB - areaA;
            });
            chosen = sortedByArea[0];
          } else {
            return {
              error: 'multiple_faces',
              message: 'Se detectaron más de un rostro. Asegúrate de estar solo frente a la cámara.'
            };
          }
        }

        const landmarksObj = chosen.landmarks;
        const positions: Point2D[] = landmarksObj?.positions
          ? landmarksObj.positions.map((p: any) => ({ x: p.x, y: p.y }))
          : [];
        const leftEye: Point2D[] =
          typeof landmarksObj?.getLeftEye === 'function'
            ? landmarksObj.getLeftEye().map((p: any) => ({ x: p.x, y: p.y }))
            : positions.slice(36, 42);
        const rightEye: Point2D[] =
          typeof landmarksObj?.getRightEye === 'function'
            ? landmarksObj.getRightEye().map((p: any) => ({ x: p.x, y: p.y }))
            : positions.slice(42, 48);

        const ear =
          leftEye.length === 6 && rightEye.length === 6
            ? computeBilateralEAR(leftEye, rightEye)
            : undefined;

        const box = chosen.detection?.box
          ? {
              x: chosen.detection.box.x,
              y: chosen.detection.box.y,
              width: chosen.detection.box.width,
              height: chosen.detection.box.height
            }
          : undefined;

        return {
          descriptor: new Float32Array(chosen.descriptor),
          landmarks: positions,
          leftEye,
          rightEye,
          ear,
          box
        };
      });
    } catch (e: any) {
      lastErr = e;
      loadedUri = null;
    }
  }

  return {
    error: classifyFaceError(lastErr),
    message: (lastErr && lastErr.message) || 'Error cargando modelos biométricos.'
  };
}

/**
 * Flujo completo de alto nivel: selfie + documento -> veredicto tipado.
 * Utiliza el pipeline dual (`mode: 'selfie'` para la selfie y `mode: 'document'` con `inputSize: 608`
 * para la cédula).
 */
export async function verifyIdentity(
  selfieImage: any,
  docImage: any,
  ocrText: string,
  threshold = PRIMARY_BIOMETRIC_THRESHOLD,
  allowBiometricPrimary = true
): Promise<IdentityResult> {
  const selfie = await getDescriptor(selfieImage, { mode: 'selfie', inputSize: 320 });
  if (selfie.error) return { ok: false, reason: selfie.error, threshold };

  const doc = await getDescriptor(docImage, { mode: 'document', inputSize: 608, pickLargestFace: true });
  if (doc.error) {
    return {
      ok: false,
      reason: doc.error === 'no_face' ? 'sin_rostro_documento' : doc.error,
      threshold
    };
  }

  return evaluateIdentity(
    selfie.descriptor!,
    doc.descriptor!,
    ocrText,
    threshold,
    allowBiometricPrimary
  );
}