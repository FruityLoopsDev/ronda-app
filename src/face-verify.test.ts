// face-verify.test.ts — Test de la parte pura del módulo de verificación facial.
// Ejecutar:  node src/face-verify.test.ts
// Solo valida la matemática de comparación y la validación de texto (sin cámara ni red).

import { euclideanDistance, matchDescriptors, validateCedulaText, evaluateIdentity } from './face-verify.ts';

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

console.log('== matchDescriptors (umbral 0.6) ==');
const d1 = [0.1, 0.2, 0.3, 0.4, 0.5];
check('mismo vector → matched', matchDescriptors(d1, [...d1]).matched);
const far = [10, 10, 10, 10, 10];
check('vector lejano → no matched', matchDescriptors(d1, far, 0.6).matched === false);
check('umbral estricto (0.1) falla', matchDescriptors(d1, [0.1,0.2,0.3,0.4,0.9], 0.1).matched === false);

console.log('== validateCedulaText (cédula Colombia) ==');
check('texto válido', validateCedulaText('REPUBLICA DE COLOMBIA ...').valid);
check('cédula de ciudadanía válida', validateCedulaText('cedula de ciudadania').valid);
check('texto aleatorio inválido', validateCedulaText('hola mundo').valid === false);
check('vacío inválido', validateCedulaText('').valid === false);

console.log('== evaluateIdentity (flujo combinado) ==');
check('selfie==doc + texto válido → OK',
  evaluateIdentity(d1, [...d1], 'REPUBLICA DE COLOMBIA').ok === true);
check('texto inválido → documento_no_reconocido',
  evaluateIdentity(d1, [...d1], 'nada').reason === 'documento_no_reconocido');
check('rostro no coincide → rostro_no_coincide',
  evaluateIdentity(d1, far, 'REPUBLICA DE COLOMBIA').reason === 'rostro_no_coincide');

console.log('============================================');
console.log(`\nRESULTADO: ${passed} pasados, ${failed} fallados`);
process.exit(failed === 0 ? 0 : 1);
