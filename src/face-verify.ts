// face-verify.ts — Verificación de identidad facial (selfie vs documento)
//
// Diseño:
//  - Parte PURA (testeable en Node): distancia euclídea entre descriptores, umbral de
//    coincidencia y validación del texto de la cédula ("REPUBLICA DE COLOMBIA" / "CEDULA DE
//    CIUDADANIA"). No depende de DOM ni de la red → se puede ejecutar con `node`.
//  - Parte de CÁMARA/MODELOS (carga diferida): utiliza @vladmandic/face-api (TensorFlow.js)
//    para extraer el descriptor facial (128-d) de un selfie y de la foto del documento,
//    y luego los compara. Se importa dinámicamente para no romper el build si el paquete
//    aún no está instalado (solo se resuelve al invocar verifyIdentity).
// --------------------------------------------------------------------------------

// ---------- Parte PURA (sin dependencias de DOM/red) ----------

/**
 * Distancia euclídea entre dos vectores (descriptores) de igual longitud.
 * Es la métrica estándar de face-api para comparar descriptores de rostro.
 */
export function euclideanDistance(a: number[] | Float32Array, b: number[] | Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Decide si dos descriptores corresponden a la misma persona.
 * face-api usa un umbral típico ~0.6 (cuanto menor, más estricto).
 */
export function matchDescriptors(
  d1: number[] | Float32Array,
  d2: number[] | Float32Array,
  threshold = 0.6
): { distance: number; matched: boolean } {
  const distance = euclideanDistance(d1, d2);
  return { distance, matched: distance < threshold };
}

/**
 * Valida que el texto OCR pertenezca a una cédula de ciudadanía de Colombia.
 * Devuelve la lista de frases reconocidas (insumo para debug) y si es válido.
 */
export function validateCedulaText(ocrText: string): { valid: boolean; hits: string[] } {
  const upper = (ocrText || '').toUpperCase();
  const hits: string[] = [];
  if (upper.includes('REPUBLICA DE COLOMBIA')) hits.push('REPUBLICA DE COLOMBIA');
  if (upper.includes('CEDULA DE CIUDADANIA')) hits.push('CEDULA DE CIUDADANIA');
  return { valid: hits.length > 0, hits };
}

/** Resultado de la verificación de identidad. */
export interface IdentityResult {
  ok: boolean;
  reason?: string;
  distance?: number;
  threshold?: number;
  documentValid?: boolean;
  hits?: string[];
}

/**
 * Compara el descriptor del selfie con el del documento y valida el texto OCR.
 * Combina la parte facial y la documental en un único veredicto.
 */
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

// ---------- Parte de CÁMARA / MODELOS (carga diferida) ----------

// Nota: en el navegador se instala el paquete y se importa dinámicamente:
//   npm i @vladmandic/face-api
// y se despliegan los modelos (o se cargan desde CDN) con loadFromUri.

async function loadFaceApi(): Promise<any> {
  const faceapi = await import('@vladmandic/face-api');
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
  ]);
  return faceapi;
}

/**
 * Extrae el descriptor facial (128-d) de una imagen/HTMLImageElement/HTMLVideoElement.
 * Devuelve null si no se detecta un único rostro (o ninguno).
 */
export async function descriptorFromImage(image: any, modelUri = '/models'): Promise<Float32Array | null> {
  const faceapi = await import('@vladmandic/face-api');
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(modelUri),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelUri),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelUri),
  ]);
  const detection = await faceapi
    .detectSingleFace(image)
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection ? detection.descriptor : null;
}

/**
 * Flujo completo: selfie + documento + texto OCR → veredicto.
 * @param selfieImage imagen del rostro (por ej. un canvas foto o <img> del selfie).
 * @param docImage   imagen del documento (por ej. el <img>/canvas de la cédula).
 * @param ocrText    texto extraído por Tesseract del documento.
 */
export async function verifyIdentity(selfieImage: any, docImage: any, ocrText: string, threshold = 0.6): Promise<IdentityResult> {
  await loadFaceApi();
  const [selfie, doc] = await Promise.all([
    descriptorFromImage(selfieImage, '/models'),
    descriptorFromImage(docImage, '/models'),
  ]);
  if (!selfie) return { ok: false, reason: 'sin_rostro_selfie' };
  if (!doc) return { ok: false, reason: 'sin_rostro_documento' };
  return evaluateIdentity(selfie, doc, ocrText, threshold);
}
