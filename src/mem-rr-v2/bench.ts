// mem-rr-v2/bench.ts — Suite de validación y benchmark del motor MEM-RR v2
// Ejecutar:  node src/mem-rr-v2/bench.ts
// Cubre:
//   1. Validación de solvers contra fuerza bruta (bipartito y general).
//   2. Comparativa v1 (offsets por colisiones) vs v2 (WMM) en igualdad de condiciones.
//   3. Escenario con restricciones duras (pares bloqueados): v1 falla, v2 no.
//   4. Escenario dinámico (no-shows): re-optimización del v2.
//   5. Rendimiento (tiempos por planificación).
// Módulo puro: sin dependencias de DOM ni Firebase.

// Tipado mínimo de Node para ejecutar este script sin @types/node
declare const process: { exit(code?: number): void };

import type { Participant, History, Encounter, Orientation } from './types.ts';
import { buildNightPlan } from './engine.ts';
import { solveBipartite } from './flow.ts';
import { generalMatching, generalPerfectMatching } from './general.ts';
import { dpPerfectMatching } from './exact.ts';
import { pairKey, pairWeight, HARD_COST, HARD_PENALTY } from './weights.ts';
import type { EngineConfig } from './types.ts';

// ---------------------------------------------------------------------------
// Utilidades
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

// ---------------------------------------------------------------------------
// Replicación del v1 (offsets por conteo de colisiones históricas)
// ---------------------------------------------------------------------------
function planV1(sideA: Participant[], sideB: Participant[], rounds: number, history: History) {
  const aLarger = sideA.length >= sideB.length;
  const left = aLarger ? sideA : sideB;
  const right = aLarger ? sideB : sideA;
  const m = left.length;
  const nR = right.length;

  const cols: { d: number; c: number }[] = [];
  for (let d = 0; d < m; d++) {
    let c = 0;
    for (let i = 0; i < m; i++) {
      const bIdx = (i + d) % m;
      if (bIdx < nR && history.get(left[i].uid, right[bIdx].uid)) c++;
    }
    cols.push({ d, c });
  }
  const Rr = Math.min(rounds, m);
  const offsets = cols.slice().sort((x, y) => x.c - y.c || x.d - y.d).slice(0, Rr).map((o) => o.d);

  let repeats = 0;
  let fresh = 0;
  let recentRepeats = 0;
  let affinityTotal = 0;
  const seen = new Set<string>();
  const perPersonRepeats = new Map<string, number>();
  for (const d of offsets) {
    for (let i = 0; i < m; i++) {
      const bIdx = (i + d) % m;
      if (bIdx >= nR) continue; // fantasma/descanso
      const key = pairKey(left[i].uid, right[bIdx].uid);
      if (seen.has(key)) continue;
      seen.add(key);
      const enc = history.get(left[i].uid, right[bIdx].uid);
      if (enc) {
        repeats++;
        if (enc.lastAtDaysAgo <= 14) recentRepeats++;
        perPersonRepeats.set(left[i].uid, (perPersonRepeats.get(left[i].uid) ?? 0) + 1);
        perPersonRepeats.set(right[bIdx].uid, (perPersonRepeats.get(right[bIdx].uid) ?? 0) + 1);
      } else {
        fresh++;
      }
      affinityTotal += 1; // v1 no modela afinidad
    }
  }
  const maxRepeats = perPersonRepeats.size > 0 ? Math.max(...perPersonRepeats.values()) : 0;
  return { repeats, fresh, recentRepeats, offsets, avgAffinity: 1, maxRepeats };
}

function planV2(sideA: Participant[], sideB: Participant[], rounds: number, history: History) {
  const plan = buildNightPlan({ sideA, sideB, rounds, history, config: { delta: 0 } });
  let recentRepeats = 0;
  let affinityTotal = 0;
  let pairCount = 0;
  for (const round of plan.rounds) {
    for (const t of round.tables) {
      if (!t.a || !t.b) continue;
      const enc = history.get(t.a.uid, t.b.uid);
      if (enc && enc.lastAtDaysAgo <= 14) recentRepeats++;
      affinityTotal += t.weight;
      pairCount++;
    }
  }
  return {
    repeats: plan.metrics.historyRepeats,
    fresh: plan.metrics.freshFaces,
    recentRepeats,
    avgAffinity: pairCount > 0 ? affinityTotal / pairCount : 0,
    plan
  };
}

// ---------------------------------------------------------------------------
// Fuerza bruta (referencias de exactitud)
// ---------------------------------------------------------------------------
function bruteBipartite(nL: number, nR: number, nGhost: number, weight: (i: number, j: number) => number, ghostCost: (i: number) => number) {
  const slots = nR + nGhost;
  let best = Infinity;
  const used = new Array<boolean>(slots).fill(false);
  const perm = new Array<number>(nL).fill(-1);
  function rec(i: number) {
    if (i === nL) {
      let c = 0;
      for (let k = 0; k < nL; k++) c += perm[k] < nR ? weight(k, perm[k]) : ghostCost(k);
      if (c < best) best = c;
      return;
    }
    for (let s = 0; s < slots; s++) {
      if (used[s]) continue;
      used[s] = true;
      perm[i] = s;
      rec(i + 1);
      used[s] = false;
    }
  }
  rec(0);
  return best;
}

function bruteGeneral(n: number, w: (i: number, j: number) => number): { weight: number; feasible: boolean } {
  let best = -Infinity;
  const used = new Array<boolean>(n).fill(false);
  function rec(i: number, acc: number) {
    let s = -1;
    for (let k = i; k < n; k++) {
      if (!used[k]) {
        s = k;
        break;
      }
    }
    if (s === -1) {
      if (acc > best) best = acc;
      return;
    }
    used[s] = true;
    for (let t = s + 1; t < n; t++) {
      if (used[t]) continue;
      const ww = w(s, t);
      if (ww <= -1e8) continue;
      used[t] = true;
      rec(s + 1, acc + ww);
      used[t] = false;
    }
    used[s] = false;
  }
  rec(0, 0);
  return { weight: best, feasible: best > -Infinity };
}

// ---------------------------------------------------------------------------
// Resultados y aserciones
// ---------------------------------------------------------------------------
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}
function section(title: string) {
  console.log(`\n== ${title} ==`);
}

// ===========================================================================
// 1. Validación de solvers
// ===========================================================================
section('1. Validación de solvers contra fuerza bruta');

let seed = 42;
{
  // Bipartito: flujo vs fuerza bruta (matrices precomputadas → pesos deterministas)
  let mismatch = 0;
  const trials = 400;
  for (let t = 0; t < trials; t++) {
    const rnd = mulberry32(seed + t * 7);
    const nL = 2 + Math.floor(rnd() * 5); // 2..6
    const g = Math.floor(rnd() * 3);      // 0..2 fantasmas
    const nR = nL - g;
    if (nR < 1) continue;
    const wMat: number[][] = Array.from({ length: nL }, () => new Array<number>(nR).fill(0));
    for (let i = 0; i < nL; i++) {
      for (let j = 0; j < nR; j++) {
        wMat[i][j] = rnd() < 0.08 ? HARD_COST : -3 + rnd() * 6;
      }
    }
    const ghostVals = Array.from({ length: nL }, () => (rnd() < 0.1 ? HARD_COST : 0));
    const weight = (i: number, j: number) => wMat[i][j];
    const ghostCost = (i: number) => ghostVals[i];
    const brute = bruteBipartite(nL, nR, g, weight, ghostCost);
    const flow = solveBipartite(nL, nR, g, weight, ghostCost);
    if (Math.abs(flow.totalWeight - -brute) > 1e-6 || flow.feasible !== (brute < Infinity)) {
      mismatch++;
      if (mismatch <= 3) {
        console.log(`    mismatch nL=${nL} nR=${nR} g=${g} brute=${-brute} flow=${flow.totalWeight}`);
      }
    }
  }
  check(`flujo bipartito == fuerza bruta (${trials} casos)`, mismatch === 0, `${mismatch} discrepancias`);
}

{
  // DP exacto (general) vs fuerza bruta (matrices precomputadas)
  let mismatch = 0;
  const trials = 200;
  for (let t = 0; t < trials; t++) {
    const rnd = mulberry32(seed + t * 13);
    const n = 2 + 2 * Math.floor(rnd() * 4); // 2..8
    const wMat: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        wMat[i][j] = rnd() < 0.1 ? HARD_PENALTY : -2 + rnd() * 4;
        wMat[j][i] = wMat[i][j];
      }
    }
    const w = (i: number, j: number) => wMat[i][j];
    const brute = bruteGeneral(n, w);
    const dp = dpPerfectMatching(n, w);
    const ok = brute.feasible === dp.feasible && (!dp.feasible || Math.abs(dp.weight - brute.weight) < 1e-6);
    if (!ok) mismatch++;
  }
  check(`DP exacto == fuerza bruta (${trials} casos)`, mismatch === 0, `${mismatch} discrepancias`);
}

{
  // Búsqueda local (general) vs DP exacto: comparación solo sobre instancias factibles
  let equal = 0;
  let feasible = 0;
  let gap = 0;
  const trials = 300;
  for (let t = 0; t < trials; t++) {
    const rnd = mulberry32(seed + t * 29);
    const n = 2 + 2 * Math.floor(rnd() * 5); // 2..10
    const wMat: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        wMat[i][j] = rnd() < 0.08 ? HARD_PENALTY : -2 + rnd() * 4;
        wMat[j][i] = wMat[i][j];
      }
    }
    const w = (i: number, j: number) => wMat[i][j];
    const dp = dpPerfectMatching(n, w);
    if (!dp.feasible) continue; // solo instancias con emparejamiento perfecto
    feasible++;
    const ls = generalPerfectMatching(n, w);
    if (Math.abs(dp.weight - ls.weight) < 1e-6) equal++;
    else gap = Math.max(gap, dp.weight - ls.weight);
  }
  check(
    `búsqueda local ≈ DP exacto (${feasible} casos factibles)`,
    feasible > 0 && equal / feasible >= 0.9,
    `óptimos coincidentes: ${feasible > 0 ? (equal / feasible * 100).toFixed(1) : '0'}% · peor brecha: ${gap.toFixed(3)}`
  );
}

// ===========================================================================
// 2. Comparativa v1 vs v2 (mismo historial, misma sala)
// ===========================================================================
section('2. Comparativa v1 (offsets por colisiones) vs v2 (WMM)');

{
  const { sideA, sideB } = makeParticipants(10, 10, seed + 1);
  const history = makeHistory(sideA, sideB, 0.35, seed + 2);
  const R = 9;

  const v1 = planV1(sideA, sideB, R, history);
  const v2 = planV2(sideA, sideB, R, history);

  console.log(`  v1 (colisiones):    repeticiones=${v1.repeats} · recientes(≤14d)=${v1.recentRepeats} · caras nuevas=${v1.fresh} · max/persona=${v1.maxRepeats}`);
  console.log(`  v2 (WMM):           repeticiones=${v2.repeats} · recientes(≤14d)=${v2.recentRepeats} · caras nuevas=${v2.fresh} · max/persona=${v2.plan.metrics.historyRepeatsMax} · afinidad media=${v2.avgAffinity.toFixed(3)} · cobertura=${v2.plan.metrics.coveragePct}%`);

  check('v2 evita mejor los cruces recientes (recencia)', v2.recentRepeats <= v1.recentRepeats,
    `v1=${v1.recentRepeats} v2=${v2.recentRepeats}`);
  check('v2 mejora la calidad de pareja (afinidad media)', v2.avgAffinity > v1.avgAffinity + 0.2,
    `v1=${v1.avgAffinity} v2=${v2.avgAffinity.toFixed(3)}`);
  check('v2 no empeora la fairness (max repeticiones/persona)', v2.plan.metrics.historyRepeatsMax <= v1.maxRepeats + 1,
    `v1 max=${v1.maxRepeats} v2 max=${v2.plan.metrics.historyRepeatsMax}`);
  check('v2 mantiene cobertura ≥ 95%', v2.plan.metrics.coveragePct >= 95,
    `cobertura=${v2.plan.metrics.coveragePct}%`);
}

// ===========================================================================
// 3. Restricciones duras (pares bloqueados): v1 no puede evitarlos
// ===========================================================================
section('3. Restricciones duras — pares bloqueados');

{
  const { sideA, sideB } = makeParticipants(12, 12, seed + 3);
  const history = makeHistory(sideA, sideB, 0.3, seed + 4);
  // Noche completa: la rotación por offsets del v1 cubre TODOS los pares cruzados,
  // por lo que los pares bloqueados son estructuralmente inevitables.
  const R = 12;

  // Bloquear 3 pares
  const blocked: [string, string][] = [];
  for (let k = 0; k < 3; k++) {
    const a = sideA[k];
    const b = sideB[k];
    a.blocked = [...(a.blocked ?? []), b.uid];
    blocked.push([a.uid, b.uid]);
  }

  const v1 = planV1(sideA, sideB, R, history);
  const v2 = planV2(sideA, sideB, R, history);

  const v1Violations = countBlockedInV1(v1, sideA, sideB, blocked);
  const v2Violations = countBlockedInPlan(v2.plan, blocked);

  console.log(`  v1 viola ${v1Violations} emparejamientos bloqueados (noche completa) · v2 viola ${v2Violations} (rondas factibles: ${v2.plan.rounds.length}/${R})`);
  check('v1 fuerza pares bloqueados (debilidad estructural)', v1Violations > 0,
    `violaciones v1=${v1Violations}`);
  check('v2 evita 100% de los pares bloqueados', v2Violations === 0,
    `violaciones v2=${v2Violations}`);
  check('v2 modo constrained mantiene cobertura', v2.plan.metrics.coveragePct >= 90,
    `cobertura=${v2.plan.metrics.coveragePct}% · modo=${v2.plan.mode}`);
}

function countBlockedInV1(_v1: ReturnType<typeof planV1>, sideA: Participant[], sideB: Participant[], blocked: [string, string][]) {
  // v1 usa offset rotation: un offset d fuerza A_i ↔ B_{(i+d)%m}. Contar cuántos pares bloqueados aparecen.
  const aLarger = sideA.length >= sideB.length;
  const left = aLarger ? sideA : sideB;
  const right = aLarger ? sideB : sideA;
  const m = left.length;
  const nR = right.length;
  const blockSet = new Set(blocked.map(([x, y]) => pairKey(x, y)));
  let violations = 0;
  const seen = new Set<string>();
  for (const d of _v1.offsets) {
    for (let i = 0; i < m; i++) {
      const bIdx = (i + d) % m;
      if (bIdx >= nR) continue;
      const key = pairKey(left[i].uid, right[bIdx].uid);
      if (seen.has(key)) continue;
      seen.add(key);
      if (blockSet.has(key)) violations++;
    }
  }
  return violations;
}

function countBlockedInPlan(plan: ReturnType<typeof buildNightPlan>, blocked: [string, string][]) {
  const blockSet = new Set(blocked.map(([x, y]) => pairKey(x, y)));
  let violations = 0;
  for (const round of plan.rounds) {
    for (const t of round.tables) {
      if (!t.a || !t.b) continue;
      if (blockSet.has(pairKey(t.a.uid, t.b.uid))) violations++;
    }
  }
  return violations;
}

// ===========================================================================
// 4. Re-optimización dinámica (no-shows antes de la ronda 4)
// ===========================================================================
section('4. Re-optimización dinámica — no-shows');

{
  const { sideA, sideB } = makeParticipants(11, 11, seed + 5);
  const history = makeHistory(sideA, sideB, 0.3, seed + 6);
  const R = 8;

  const full = buildNightPlan({ sideA, sideB, rounds: R, history });
  // Simular: al cierre del check-in faltan 2 del lado B
  const removed = new Set(sideB.slice(0, 2).map((p) => p.uid));
  const remainingB = sideB.filter((p) => !removed.has(p.uid));

  const replan = buildNightPlan({ sideA, sideB: remainingB, rounds: R - 3, history, config: { delta: 0 } });

  let referencesRemoved = 0;
  for (const round of replan.rounds) {
    for (const t of round.tables) {
      if (t.a && removed.has(t.a.uid)) referencesRemoved++;
      if (t.b && removed.has(t.b.uid)) referencesRemoved++;
    }
  }
  // En modo offsets con 11+9, hay 2 descansos por ronda (lado mayor = A): todas las mesas con 2 personas reales
  const fullTables = replan.rounds.every((r) => r.tables.filter((t) => t.a && t.b).length >= 7);

  console.log(`  v2 replanifica 11+9 con ${replan.rounds.length} rondas · mesas completas/ronda ≥ 7: ${fullTables} · refs a ausentes: ${referencesRemoved}`);
  check('v2 re-optimiza sin referencias a ausentes', referencesRemoved === 0);
  check('v2 mantiene salas completas tras no-shows', fullTables);
  check('v2 conserva cobertura ≥ 90% tras replanificación', replan.metrics.coveragePct >= 90,
    `cobertura=${replan.metrics.coveragePct}%`);
  void full;
}

// ===========================================================================
// 6. Re-planificación intra-noche (alreadyMet)
// ===========================================================================
section('6. Re-planificación intra-noche (alreadyMet)');

{
  const { sideA, sideB } = makeParticipants(8, 8, seed + 11);
  const history = makeHistory(sideA, sideB, 0.2, seed + 12);

  // Primera mitad: plan normal; se juegan 3 rondas
  const plan1 = buildNightPlan({ sideA, sideB, rounds: 9, history });
  const played: string[] = [];
  for (let i = 0; i < 3; i++) {
    for (const t of plan1.rounds[i].tables) {
      if (t.a && t.b) played.push(pairKey(t.a.uid, t.b.uid));
    }
  }

  // Segunda mitad: un no-show del lado B + re-planificación con alreadyMet
  const remainingB = sideB.slice(0, sideB.length - 1);
  const plan2 = buildNightPlan({
    sideA,
    sideB: remainingB,
    rounds: 4,
    history,
    alreadyMet: new Set(played)
  });

  let repeats = 0;
  for (const round of plan2.rounds) {
    for (const t of round.tables) {
      if (!t.a || !t.b) continue;
      if (played.includes(pairKey(t.a.uid, t.b.uid))) repeats++;
    }
  }
  console.log(`  replan: ${plan2.rounds.length} rondas factibles · modo=${plan2.mode} · cobertura=${plan2.metrics.coveragePct}%`);
  check('replan no repite pares de rondas anteriores', repeats === 0, `repeticiones=${repeats}`);
  check('replan usa modo constrained (estructura latina no garantiza novedad)', plan2.mode === 'constrained', `modo=${plan2.mode}`);
  check('replan mantiene cobertura', plan2.metrics.coveragePct >= 90, `cobertura=${plan2.metrics.coveragePct}%`);
}

// ===========================================================================
// 7. M4 — Mesas de 4 (2+2) y grafo del local (δ·D)
// ===========================================================================
section('7. M4 — Mesas de 4 y grafo del local');

{
  // Mesas de 4: cada mesa completa debe tener 2+2 = 4 personas
  const { sideA, sideB } = makeParticipants(12, 12, seed + 13);
  const history = makeHistory(sideA, sideB, 0.2, seed + 14);
  const plan4 = buildNightPlan({ sideA, sideB, rounds: 6, history, tableSize: 4 });

  const fullTables = plan4.rounds.reduce(
    (acc, r) => acc + r.tables.filter((t) => t.ap?.length === 2 && t.bp?.length === 2).length, 0);
  const fourSeaters = plan4.rounds.reduce(
    (acc, r) => acc + r.tables.filter((t) => ((t.ap?.length ?? 0) + (t.bp?.length ?? 0)) === 4).length, 0);
  console.log(`  mesas de 4: ${fourSeaters} mesas de 4 asientos · ${fullTables} mesas 2+2 · cobertura=${plan4.metrics.coveragePct}%`);
  check('mesas de 4 generan mesas 2+2', fullTables > 0 && fullTables === fourSeaters,
    `2+2=${fullTables} / 4 asientos=${fourSeaters}`);
  check('mesas de 4 mantienen cobertura', plan4.metrics.coveragePct >= 85, `cobertura=${plan4.metrics.coveragePct}%`);
}

{
  // Grafo del local: el término δ·D debe penalizar la distancia física (unit test sobre pairWeight)
  const { sideA, sideB } = makeParticipants(4, 4, seed + 15);
  const history = makeHistory(sideA, sideB, 0.1, seed + 16);
  const a = sideA[0];
  const b = sideB[0];
  const room = { distance: (x: number, y: number) => Math.abs(x - y), maxDistance: 5 };
  const cfg: Partial<EngineConfig> = { alpha: 1, beta: 1, gamma: 1, delta: 1, lambda: Math.LN2 / 30 };
  const wClose = pairWeight(a, b, history, { ...cfg, delta: 1 } as any, room, 0, 0);
  const wFar = pairWeight(a, b, history, { ...cfg, delta: 1 } as any, room, 0, 5);
  check('δ·D reduce el peso con mayor distancia', Math.abs((wClose - wFar) - 1.0) < 1e-6,
    `Δ=${(wClose - wFar).toFixed(4)} (esperado 1.0 = δ·dist/max)`);
  check('δ=0 ignora la distancia', Math.abs(pairWeight(a, b, history, { ...cfg, delta: 0 } as any, room, 0, 5)
    - pairWeight(a, b, history, { ...cfg, delta: 0 } as any, room, 0, 0)) < 1e-9);
}

// ===========================================================================
// 5. Rendimiento
// ===========================================================================
section('5. Rendimiento');

{
  const { sideA, sideB } = makeParticipants(12, 12, seed + 7);
  const history = makeHistory(sideA, sideB, 0.35, seed + 8);

  const t0 = Date.now();
  const plan = buildNightPlan({ sideA, sideB, rounds: 9, history, config: { delta: 0 } });
  const t1 = Date.now();
  const perRound = plan.rounds.reduce((s, r) => s + r.computeMs, 0) / plan.rounds.length;

  console.log(`  bipartito 12+12 × 9 rondas: plan completo=${(t1 - t0).toFixed(1)} ms · media/ronda=${perRound.toFixed(2)} ms · modo=${plan.mode}`);
  check('plan completo < 100 ms', t1 - t0 < 100, `${(t1 - t0).toFixed(1)} ms`);

  // General (todos contra todos), 20 personas
  const genA = makeParticipants(10, 10, seed + 9);
  const g0 = Date.now();
  const gplan = buildNightPlan({ sideA: genA.sideA, sideB: genA.sideB, rounds: 6, history: makeHistory(genA.sideA, genA.sideB, 0.2, seed + 10), general: true });
  const g1 = Date.now();
  console.log(`  general 20 personas × 6 rondas: ${(g1 - g0).toFixed(1)} ms · pares/ronda=${gplan.rounds[0]?.tables.length ?? 0}`);
  check('plan general < 500 ms', g1 - g0 < 500, `${(g1 - g0).toFixed(1)} ms`);
}

// ===========================================================================
console.log(failures === 0 ? '\n✅ BENCH OK — todas las aserciones pasaron' : `\n❌ ${failures} aserción(es) fallaron`);
process.exit(failures === 0 ? 0 : 1);
