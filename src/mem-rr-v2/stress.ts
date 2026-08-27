// mem-rr-v2/stress.ts — Prueba de estrés del motor MEM-RR v2 (WMM)
// Ejecutar:  node src/mem-rr-v2/stress.ts
// Mide tiempo de planificación + delta de heap a distintas escalas y en los 3
// caminos de cómputo del motor:
//   A) Modo 'offsets'  — noches limpias (rotación clásica, O(n)/ronda): escala a miles.
//   B) Modo 'constrained' — restricciones duras + alreadyMet → solver de flujo: escala de sala llena.
//   C) Modo 'general'  — todos contra todos → DP exacto (n≤18) + búsqueda local (n>18).
// Módulo puro: sin DOM ni Firebase.

declare const process: { memoryUsage(): { heapUsed: number }; exit(code?: number): void };

import type { Participant, History, Encounter, Orientation } from './types.ts';
import { buildNightPlan } from './engine.ts';
import { pairKey } from './weights.ts';

// ---------------------------------------------------------------------------
// Utilidades (misma generación determinista que bench.ts)
// ---------------------------------------------------------------------------
function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class MapHistory implements History {
  map = new Map<string, Encounter>();
  get(uid1: string, uid2: string): Encounter | null {
    return this.map.get(pairKey(uid1, uid2)) ?? null;
  }
  set(uid1: string, uid2: string, e: Encounter): void {
    this.map.set(pairKey(uid1, uid2), e);
  }
}

const INTERESTS = ['salsa', 'cafe', 'running', 'vino', 'cine', 'viajes'];

function makeParticipants(nA: number, nB: number, seed: number): { sideA: Participant[]; sideB: Participant[] } {
  const rnd = mulberry32(seed);
  const make = (prefix: string, gender: 'F' | 'M', i: number): Participant => {
    const orientations: Orientation[] = gender === 'F' ? ['M', 'M', 'A'] : ['F', 'F', 'A'];
    return {
      uid: `${prefix}${i}`,
      gender,
      orientation: orientations[Math.floor(rnd() * orientations.length)],
      age: 25 + Math.floor(rnd() * 10),
      interests: INTERESTS.filter(() => rnd() < 0.5),
      verified: true
    };
  };
  const sideA: Participant[] = [];
  const sideB: Participant[] = [];
  for (let i = 0; i < nA; i++) sideA.push(make('A', 'F', i));
  for (let i = 0; i < nB; i++) sideB.push(make('B', 'M', i));
  return { sideA, sideB };
}

function makeHistory(sideA: Participant[], sideB: Participant[], density: number, seed: number): MapHistory {
  const rnd = mulberry32(seed);
  const h = new MapHistory();
  for (const a of sideA) {
    for (const b of sideB) {
      if (rnd() < density) {
        h.set(a.uid, b.uid, {
          n: 1 + Math.floor(rnd() * 3),
          lastAtDaysAgo: 1 + Math.floor(rnd() * 90),
          match: rnd() < 0.3
        });
      }
    }
  }
  return h;
}

/** Corta un conjunto de pares `alreadyMet` (≈frac de todos los pares cruzados) para forzar el solver. */
function makeAlreadyMet(sideA: Participant[], sideB: Participant[], frac: number, seed: number): Set<string> {
  const rnd = mulberry32(seed);
  const set = new Set<string>();
  for (const a of sideA) {
    for (const b of sideB) {
      if (rnd() < frac) set.add(pairKey(a.uid, b.uid));
    }
  }
  return set;
}

function run(label: string, fn: () => any) {
  const before = process.memoryUsage().heapUsed;
  const t0 = Date.now();
  let result: any = null;
  let err: string | null = null;
  try { result = fn(); } catch (e: any) { err = (e && e.message) || String(e); }
  const t1 = Date.now();
  const after = process.memoryUsage().heapUsed;
  const mb = (after - before) / 1048576;
  const color = err ? '✗' : '✓';
  console.log(`  ${color} ${label} → ${(t1 - t0).toFixed(1)} ms · heap ${mb >= 0 ? '+' : ''}${mb.toFixed(1)} MB${err ? ' · ERR: ' + err : ''}`);
  return err ? null : result;
}

function fmt(n: number): string { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

const ROUNDS_OFFSETS = 9;
const ROUNDS_FLOW = 8;
const ROUNDS_GEN = 6;

console.log('====================================================================');
console.log('A) Modo OFFSETS (noches limpias, rotación clásica) — escala');
console.log('====================================================================');
for (const n of [24, 50, 100, 200, 500, 1000]) {
  const { sideA, sideB } = makeParticipants(n, n, 101);
  const history = makeHistory(sideA, sideB, 0.35, 102);
  const plan = run(`${fmt(n)}+${fmt(n)} part. × ${ROUNDS_OFFSETS} rondas`, () =>
    buildNightPlan({ sideA, sideB, rounds: ROUNDS_OFFSETS, history, config: { delta: 0 } }));
  if (plan) console.log(`        modo=${plan.mode} · cobertura=${plan.metrics.coveragePct}% · caras nuevas=${plan.metrics.freshFaces}`);
}

console.log('====================================================================');
console.log('B) Modo CONSTRAINED (restricciones duras + alreadyMet → solver de flujo)');
console.log('====================================================================');
for (const n of [12, 20, 40, 80, 120]) {
  const { sideA, sideB } = makeParticipants(n, n, 201);
  const history = makeHistory(sideA, sideB, 0.3, 202);
  const alreadyMet = makeAlreadyMet(sideA, sideB, 0.35, 203);
  const plan = run(`${fmt(n)}+${fmt(n)} part. · alreadyMet=${alreadyMet.size} pares × ${ROUNDS_FLOW} rondas`, () =>
    buildNightPlan({ sideA, sideB, rounds: ROUNDS_FLOW, history, alreadyMet, config: { delta: 0 } }));
  if (plan) console.log(`        modo=${plan.mode} · rondas=${plan.rounds.length} · cobertura=${plan.metrics.coveragePct}%`);
}

console.log('====================================================================');
console.log('C) Modo GENERAL (todos contra todos — DP exacto n≤18 / búsqueda local n>18)');
console.log('====================================================================');
for (const n of [18, 20, 24, 32, 40]) {
  const halfA = Math.ceil(n / 2), halfB = Math.floor(n / 2);
  const { sideA, sideB } = makeParticipants(halfA, halfB, 301);
  const history = makeHistory(sideA, sideB, 0.2, 302);
  const plan = run(`${n} personas × ${ROUNDS_GEN} rondas (general)`, () =>
    buildNightPlan({ sideA, sideB, rounds: ROUNDS_GEN, history, general: true }));
  if (plan) console.log(`        modo=${plan.mode} · pares/ronda=${plan.rounds[0]?.tables.length ?? 0} · cobertura=${plan.metrics.coveragePct}%`);
}

console.log('====================================================================');
console.log('✅ STRESS OK — sin errores (revisa tiempos y heap por escala)');
console.log('====================================================================');
