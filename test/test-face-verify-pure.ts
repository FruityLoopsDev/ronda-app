// face-verify.test.ts — Test de la parte pura del módulo de verificación facial.
// Ejecutar:  node src/face-verify.test.ts
// Valida la matemática de comparación, validación de texto, Center-Crop isotrópico,
// Liveness relativo por Delta (35% sobre 3 frames) e iluminación cálida/nocturna.

import {
  euclideanDistance,
  matchDescriptors,
  validateCedulaText,
  evaluateIdentity,
  computeIsotropicCenterCrop,
  computeEyeAspectRatio,
  createBlinkCalibrationState,
  updateRelativeBlinkState,
  evaluateLightingFromRgba,
  PRIMARY_BIOMETRIC_THRESHOLD
} from '../src/face-verify.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${detail}`); }
}

console.log('== euclideanDistance ==');
check('vector idéntico → 0', euclideanDistance([0,0], [0,0]) === 0);
check('distancia correcta (3-4-5)', Math.abs(euclideanDistance([0,0],[3,4]) - 5) < 1e-9);
check('dimensión mínima respetada', euclideanDistance([1,2,3],[1,2]) === 0);

console.log('== matchDescriptors (umbral 0.6 y primario 0.52) ==');
const d1 = [0.1, 0.2, 0.3, 0.4, 0.5];
check('mismo vector → matched', matchDescriptors(d1, [...d1]).matched);
const far = [10, 10, 10, 10, 10];
check('vector lejano → no matched', matchDescriptors(d1, far, 0.6).matched === false);
check('umbral estricto (0.1) falla', matchDescriptors(d1, [0.1,0.2,0.3,0.4,0.9], 0.1).matched === false);
check('umbral primario 0.52 constante', PRIMARY_BIOMETRIC_THRESHOLD === 0.52);

console.log('== validateCedulaText (cédula Colombia) ==');
check('texto válido', validateCedulaText('REPUBLICA DE COLOMBIA ...').valid);
check('cédula de ciudadanía válida', validateCedulaText('cedula de ciudadania').valid);
check('texto aleatorio inválido', validateCedulaText('hola mundo').valid === false);
check('vacío inválido', validateCedulaText('').valid === false);

console.log('== evaluateIdentity (flujo combinado + modo biométrico primario) ==');
check('selfie==doc + texto válido → OK',
  evaluateIdentity(d1, [...d1], 'REPUBLICA DE COLOMBIA').ok === true);
check('texto inválido → documento_no_reconocido (modo estricto)',
  evaluateIdentity(d1, [...d1], 'nada').reason === 'documento_no_reconocido');
check('rostro no coincide → rostro_no_coincide',
  evaluateIdentity(d1, far, 'REPUBLICA DE COLOMBIA').reason === 'rostro_no_coincide');
check('modo biométrico primario aprueba si distancia <= 0.52 aunque OCR falle/timeout',
  evaluateIdentity(d1, [...d1], '', 0.52, true).ok === true &&
  evaluateIdentity(d1, [...d1], '', 0.52, true).ocrStatus === 'pending_or_skipped');

console.log('== computeIsotropicCenterCrop (sin deformación anisotrópica 16:9) ==');
const crop16x9 = computeIsotropicCenterCrop(1280, 720, 320, 320);
check('recorta 1280x720 a cuadrado central 720x720', crop16x9.sw === 720 && crop16x9.sh === 720 && crop16x9.sx === 280 && crop16x9.sy === 0);
check('escala isotrópica exacta (scaleX === scaleY)', Math.abs(crop16x9.scaleX - crop16x9.scaleY) < 1e-9);

console.log('== Liveness relativo por Delta (35% sobre baseline de 3 frames) ==');
const openEye = [
  { x: 0, y: 0 }, { x: 3, y: 3 }, { x: 7, y: 3 },
  { x: 10, y: 0 }, { x: 7, y: -3 }, { x: 3, y: -3 }
];
const closedEye = [
  { x: 0, y: 0 }, { x: 3, y: 1.5 }, { x: 7, y: 1.5 },
  { x: 10, y: 0 }, { x: 7, y: -1.5 }, { x: 3, y: -1.5 }
];
const earOpen = computeEyeAspectRatio(openEye); // 0.6
const earBlink = computeEyeAspectRatio(closedEye); // 0.3 (caída del 50% >= 35%)
let blinkState = createBlinkCalibrationState();
blinkState = updateRelativeBlinkState(blinkState, earOpen);
blinkState = updateRelativeBlinkState(blinkState, earOpen);
blinkState = updateRelativeBlinkState(blinkState, earOpen);
check('calibra baseline en 3 frames', blinkState.baselineEar !== null && Math.abs(blinkState.baselineEar - 0.6) < 1e-6);
blinkState = updateRelativeBlinkState(blinkState, earBlink);
check('detecta parpadeo con caída >= 35%', blinkState.blinkDetected === true && blinkState.dropRatio >= 0.35);

console.log('== evaluateLightingFromRgba (tolerante a luz cálida nocturna) ==');
// Simular 20x20 píxeles con luz cálida de bar (R=45, G=28, B=14)
const warmPixels = new Uint8Array(20 * 20 * 4);
for (let i = 0; i < warmPixels.length; i += 4) {
  warmPixels[i] = 45;
  warmPixels[i + 1] = 28;
  warmPixels[i + 2] = 14;
  warmPixels[i + 3] = 255;
}
const warmEval = evaluateLightingFromRgba(warmPixels, 20, 20);
check('acepta iluminación cálida nocturna (< 36/255 pero con compensación R/B)', warmEval.ok === true && warmEval.warmCompensation > 1);

console.log('============================================');
console.log(`\nRESULTADO: ${passed} pasados, ${failed} fallados`);
(globalThis as any).process.exit(failed === 0 ? 0 : 1);