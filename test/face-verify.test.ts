import { euclideanDistance, matchDescriptors, validateCedulaText, evaluateIdentity } from '../src/face-verify.js';
import assert from 'assert';

console.log("Iniciando pruebas unitarias de face-verify.ts...");

// Test euclideanDistance
const dist = euclideanDistance([1, 2, 3], [1, 2, 3]);
assert.strictEqual(dist, 0, 'La distancia debe ser 0 para descriptores idénticos');

const dist2 = euclideanDistance([0, 0], [3, 4]);
assert.strictEqual(dist2, 5, 'La distancia euclidiana (3,4) desde el origen es 5');

// Test matchDescriptors
const match = matchDescriptors([0.1, 0.1], [0.1, 0.1]);
assert.strictEqual(match.matched, true, 'Deben coincidir');
assert.strictEqual(match.distance, 0, 'La distancia debe ser 0');

const noMatch = matchDescriptors([0, 0], [1, 1], 0.6);
assert.strictEqual(noMatch.matched, false, 'No deben coincidir si la distancia > threshold');

// Test validateCedulaText
const validCedula = validateCedulaText("... REPUBLICA DE COLOMBIA ... CEDULA DE CIUDADANIA ...");
assert.strictEqual(validCedula.valid, true, 'Debe reconocer la cédula');

const invalidCedula = validateCedulaText("LICENCIA DE CONDUCCION");
assert.strictEqual(invalidCedula.valid, false, 'No debe reconocer textos sin palabras clave');

// Test evaluateIdentity
const eval1 = evaluateIdentity([0.1, 0.1], [0.1, 0.1], "REPUBLICA DE COLOMBIA", 0.6);
assert.strictEqual(eval1.ok, true, 'Identidad evaluada exitosamente');

const eval2 = evaluateIdentity([0, 0], [1, 1], "REPUBLICA DE COLOMBIA", 0.6);
assert.strictEqual(eval2.ok, false, 'Falla por rostro que no coincide');
assert.strictEqual(eval2.reason, 'rostro_no_coincide');

const eval3 = evaluateIdentity([0.1, 0.1], [0.1, 0.1], "OTRO DOC", 0.6);
assert.strictEqual(eval3.ok, false, 'Falla por documento no reconocido');
assert.strictEqual(eval3.reason, 'documento_no_reconocido');

console.log("✅ Todas las pruebas puras de face-verify completadas con éxito.");
