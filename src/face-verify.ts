// face-verify.ts — Verificación de identidad facial (selfie vs documento)
//
// DISEÑO ROBUSTO (a pruebas de fallo):
//  - Parte PURA (testeable en Node, sin DOM/red): distancia euclídea, umbral,
//    validación de cédula de Colombia y decisión combinada.
//  - Parte de CÁMARA/MODELOS (carga diferida con @vladmandic/face-api): extrae
//    descriptor facial (128-d). Cada operación devuelve un RESULTADO TIPADO
//    { descriptor | error } en lugar de lanzar, para que la UI maneje el fallo
//    sin romperse. Cubre: sin rostro, más de un rostro, modelo no cargado,
//    error de red (CDN), error de modelo y error desconocido.
// --------------------------------------------------------------------------------

// ---------- PARTE PURA (sin dependencias de DOM/red) ----------

export function euclideanDistance(a: number[] | Float32Array, b: number[] | Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Coincidencia facial. Umbral típico de face-api ~0.6 (menor = más estricto). */
export function matchDescriptors(
  d1: number[] | Float32Array,
  d2: number[] | Float32Array,
  threshold = 0.6
): { distance: number; matched: boolean } {
  const distance = euclideanDistance(d1, d2);
  return { distance, matched: distance < threshold };
}

/** Valida que el texto OCR sea de una cédula de ciudadanía de Colombia. */
export function validateCedulaText(ocrText: string): { valid: boolean; hits: string[] } {
  const upper = (ocrText || '').toUpperCase();
  const hits: string[] = [];
  if (upper.includes('REPUBLICA DE COLOMBIA')) hits.push('REPUBLICA DE COLOMBIA');
  if (upper.includes('CEDULA DE CIUDADANIA')) hits.push('CEDULA DE CIUDADANIA');
  return { valid: hits.length > 0, hits };
}

export interface IdentityResult {
  ok: boolean;
  reason?: string;
  distance?: number;
  threshold?: number;
  documentValid?: boolean;
  hits?: string[];
}

/** Combina descriptor facial + texto OCR -> veredicto (falla cerrada ante documentos inválidos). */
export function evaluateIdentity(
  selfie: number[] | Float32Array,
  doc: number[] | Float32Array,
  ocrText: string,
  threshold = 0.6
): IdentityResult {
  const { distance, matched } = matchDescriptors(selfie, doc, threshold);
  const docv = validateCedulaText(ocrText);
  if (!docv.valid) {
    return { ok: false, reason: 'documento_no_reconocido', distance, threshold, documentValid: false, hits: docv.hits };
  }
  if (!matched) {
    return { ok: false, reason: 'rostro_no_coincide', distance, threshold, documentValid: true, hits: docv.hits };
  }
  return { ok: true, distance, threshold, documentValid: true, hits: docv.hits };
}

// ---------- PARTE DE CÁMARA / MODELOS (carga diferida) ----------

export type FaceError = 'no_face' | 'multiple_faces' | 'model_error' | 'network_error' | 'unknown';

export interface DescriptorResult {
  descriptor?: Float32Array;
  error?: FaceError;
  message?: string;
}

function classifyFaceError(e: any): FaceError {
  const msg = String((e && e.message) || e);
  if (/loadFromUri|weights|manifest|404|not found|model/i.test(msg)) return 'model_error';
  if (/fetch|network|CORS|ERR_/i.test(msg)) return 'network_error';
  return 'unknown';
}

async function ensureModels(uri: string): Promise<any> {
  const faceapi = await import('@vladmandic/face-api');
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(uri),
    faceapi.nets.faceLandmark68Net.loadFromUri(uri),
    faceapi.nets.faceRecognitionNet.loadFromUri(uri),
  ]);
  return faceapi;
}

// Caché de la URI con la que ya se cargaron los modelos (evita recargar en cada detección).
let loadedUri: string | null = null;

/**
 * URIs de modelos en orden de preferencia (robustez): configuración runtime, carpeta
 * local '/models' y, por último, CDN de jsDelivr (última versión) para arrancar sin
 * desplegar modelos manualmente.
 */
export function getModelUris(): string[] {
  const g: any = (typeof window !== 'undefined' ? (window as any) : null);
  const uris: string[] = [];
  if (g && g.RONDA_FACE_MODEL_URI) uris.push(g.RONDA_FACE_MODEL_URI);
  uris.push('/models');
  uris.push('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/');
  return uris;
}

// Compatibilidad: getModelUri devuelve la primera URI preferida.
export function getModelUri(): string {
  return getModelUris()[0] ?? '/models';
}

/**
 * Extrae el descriptor de un único rostro de una imagen/video/canvas.
 * Nunca lanza: devuelve { descriptor } o { error, message }.
 * Intenta cada URI de modelos hasta que una cargue; si la detección da "sin rostro" o
 * "varios rostros", devuelve ese resultado directamente (no cambia de URI).
 */
export async function getDescriptor(image: any): Promise<DescriptorResult> {
  let lastErr: any = null;
  const uris = getModelUris();
  for (const uri of uris) {
    try {
      let faceapi: any;
      if (loadedUri === uri) {
        faceapi = await import('@vladmandic/face-api');
      } else {
        faceapi = await ensureModels(uri);
        loadedUri = uri;
      }
      const detections = await faceapi.detectAllFaces(image).withFaceLandmarks().withFaceDescriptors();
      if (!detections || detections.length === 0) {
        return { error: 'no_face', message: 'No se detectó ningún rostro.' };
      }
      if (detections.length > 1) {
        return { error: 'multiple_faces', message: 'Se detectaron más de un rostro. Usa una foto con una sola persona.' };
      }
      return { descriptor: detections[0].descriptor };
    } catch (e: any) {
      lastErr = e;
      loadedUri = null; // dejar que el siguiente intento vuelva a cargar
    }
  }
  return { error: classifyFaceError(lastErr), message: (lastErr && lastErr.message) || 'Error cargando modelos.' };
}

/**
 * Flujo completo (robusto): selfie + documento -> veredicto tipado.
 * Devuelve razones descriptivas para que la UI presente un mensaje claro.
 */
export async function verifyIdentity(
  selfieImage: any,
  docImage: any,
  ocrText: string,
  threshold = 0.6
): Promise<IdentityResult> {
  const selfie = await getDescriptor(selfieImage);
  if (selfie.error) return { ok: false, reason: selfie.error, threshold };
  const doc = await getDescriptor(docImage);
  if (doc.error) return { ok: false, reason: doc.error, threshold };
  return evaluateIdentity(selfie.descriptor!, doc.descriptor!, ocrText, threshold);
}
