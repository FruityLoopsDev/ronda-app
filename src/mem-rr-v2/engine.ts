// mem-rr-v2/engine.ts — Orquestador del motor MEM-RR v2 (WMM)
// Construye el plan de noche completo: rondas, descansos (silla de barra) y métricas.
// Modos:
//   'offsets'      — estructura latina (sin restricciones duras): óptimo estructural.
//   'constrained'  — flujo bipartito por ronda con restricciones duras y memoria intra-noche.
//   'general'      — todos contra todos (noches temáticas/LGTBIQ+), solver general.
// Módulo puro: sin dependencias de DOM ni Firebase.

import type {
  NightParams,
  NightPlan,
  RoundResult,
  TableAssignment,
  EngineMetrics,
  PerPersonFreshness,
  Participant
} from './types.ts';
import {
  mergeConfig,
  pairWeight,
  pairKey,
  compatibilityOk,
  blockedPair,
  HARD_PENALTY,
  HARD_COST
} from './weights.ts';
import { solveBipartite } from './flow.ts';
import { generalPerfectMatching } from './general.ts';
import { dpPerfectMatching } from './exact.ts';

export type NightMode = 'offsets' | 'constrained' | 'general';

export function buildNightPlan(params: NightParams): NightPlan {
  const config = mergeConfig(params.config);
  const { history, room } = params;

  const general = params.general === true;
  const table4 = params.tableSize === 4 && !general;
  const nMax = table4
    ? Math.ceil(Math.max(params.sideA.length, params.sideB.length) / 2)
    : Math.max(params.sideA.length, params.sideB.length);
  const R = Math.max(
    1,
    Math.min(params.rounds, general ? Math.max(0, params.sideA.length + params.sideB.length - 1) : nMax)
  );

  if (general) {
    return buildGeneralNight(params, config, history, room, R);
  }
  if (table4) {
    return buildTable4Night(params, config, history, room, R);
  }
  return buildBipartiteNight(params, config, history, room, R);
}

// ---------------------------------------------------------------------------
// Modo mesas de 4 (2+2) — rotación por bloques (segmento 45+)
// ---------------------------------------------------------------------------
function buildTable4Night(
  params: NightParams,
  config: ReturnType<typeof mergeConfig>,
  history: NightParams['history'],
  room: NightParams['room'],
  R: number
): NightPlan {
  const { sideA, sideB } = params;
  const aLarger = sideA.length >= sideB.length;
  const left = aLarger ? sideA : sideB;
  const right = aLarger ? sideB : sideA;

  const block = (arr: Participant[]) => {
    const b: Participant[][] = [];
    for (let i = 0; i < arr.length; i += 2) b.push(arr.slice(i, i + 2));
    return b;
  };
  const lb = block(left);
  const rb = block(right);
  const nB = Math.max(lb.length, rb.length);
  while (lb.length < nB) lb.push([]);
  while (rb.length < nB) rb.push([]);

  const metTonight = new Set<string>();
  const offsetWeights: { d: number; w: number }[] = [];
  for (let d = 0; d < nB; d++) {
    let sum = 0;
    for (let ba = 0; ba < nB; ba++) {
      const bbIdx = (ba + d) % nB;
      const la = lb[ba];
      const rb2 = rb[bbIdx];
      if (la.length === 0 || rb2.length === 0) {
        sum += config.restWeight;
      } else {
        for (const a of la) for (const b of rb2) sum += pairWeight(a, b, history, config, room, ba, bbIdx);
      }
    }
    offsetWeights.push({ d, w: sum });
  }
  offsetWeights.sort((x, y) => y.w - x.w);
  const chosen = offsetWeights.slice(0, R).sort((x, y) => x.d - y.d);
  const restsCount = new Map<string, number>();
  const rounds: RoundResult[] = [];

  for (let r = 0; r < chosen.length; r++) {
    const t0 = nowMs();
    const d = chosen[r].d;
    const tables: TableAssignment[] = [];
    const rest: Participant[] = [];
    for (let ba = 0; ba < nB; ba++) {
      const bbIdx = (ba + d) % nB;
      const la = lb[ba];
      const rb2 = rb[bbIdx];
      const id = tables.length + 1;
      if (la.length === 0 || rb2.length === 0) {
        const restingPeople = la.length > 0 ? la : rb2;
        for (const p of restingPeople) {
          restsCount.set(p.uid, (restsCount.get(p.uid) ?? 0) + 1);
          rest.push(p);
        }
        tables.push({
          tableId: id,
          a: aLarger ? (la[0] ?? null) : null,
          b: aLarger ? null : (rb2[0] ?? null),
          ap: aLarger ? la : [],
          bp: aLarger ? rb2 : [],
          weight: config.restWeight
        });
      } else {
        let wsum = 0;
        for (const a of la) for (const b of rb2) {
          wsum += pairWeight(a, b, history, config, room, ba, bbIdx);
          metTonight.add(pairKey(a.uid, b.uid));
        }
        tables.push({
          tableId: id,
          a: aLarger ? la[0] : rb2[0],
          b: aLarger ? rb2[0] : la[0],
          ap: aLarger ? la : rb2,
          bp: aLarger ? rb2 : la,
          weight: wsum
        });
      }
    }
    rounds.push({ round: r + 1, tables, rest, computeMs: nowMs() - t0 });
  }

  const metrics = computeMetrics(rounds, history, sideA, sideB, room);
  return { rounds, metrics, mode: 'offsets' };
}

// ---------------------------------------------------------------------------
// Modo bipartito (formato estándar A/B)
// ---------------------------------------------------------------------------
function buildBipartiteNight(
  params: NightParams,
  config: ReturnType<typeof mergeConfig>,
  history: NightParams['history'],
  room: NightParams['room'],
  R: number
): NightPlan {
  const { sideA, sideB } = params;
  const aLarger = sideA.length >= sideB.length;
  const left = aLarger ? sideA : sideB; // lado mayor: siempre emparejado; sus excedentes descansan
  const right = aLarger ? sideB : sideA; // lado menor: con asientos fantasma
  const nL = left.length;
  const nR = right.length;
  const g = nL - nR;

  const alreadyMet = params.alreadyMet ?? new Set<string>();
  const hasHard = left.some((l) => right.some((r) => !compatibilityOk(l, r) || blockedPair(l, r)));
  // Si hay pares ya vistos esta noche (re-planificación), la estructura latina no garantiza
  // no-repetición frente al plan anterior → se fuerza el modo restringido.
  const mode: NightMode = hasHard || alreadyMet.size > 0 ? 'constrained' : 'offsets';

  const rounds: RoundResult[] = [];
  const metTonight = new Set<string>(alreadyMet);
  const restsCount = new Map<string, number>();

  if (mode === 'offsets') {
    // Estructura latina: el offset d define left[i] ↔ right[(i+d) mod nL].
    // Offsets distintos ⇒ pares distintos ⇒ sin repetición intra-noche y descansos rotativos.
    const m = nL;
    const offsetScores: { d: number; w: number }[] = [];
    for (let d = 0; d < m; d++) {
      let sum = 0;
      for (let i = 0; i < m; i++) {
        const bIdx = (i + d) % m;
        const b = bIdx < nR ? right[bIdx] : null;
        sum += b === null
          ? config.restWeight
          : pairWeight(left[i], b, history, config, room, i, bIdx);
      }
      offsetScores.push({ d, w: sum });
    }
    offsetScores.sort((x, y) => y.w - x.w);
    const chosen = offsetScores.slice(0, R).sort((x, y) => x.d - y.d);

    for (let r = 0; r < chosen.length; r++) {
      const t0 = nowMs();
      const d = chosen[r].d;
      const tables: TableAssignment[] = [];
      const rest: Participant[] = [];
      for (let i = 0; i < m; i++) {
        const bIdx = (i + d) % m;
        const b = bIdx < nR ? right[bIdx] : null;
        const aP = aLarger ? left[i] : b;
        const bP = aLarger ? b : left[i];
        if (b === null) {
          tables.push({ tableId: i + 1, a: aLarger ? left[i] : null, b: aLarger ? null : left[i], weight: config.restWeight });
          rest.push(left[i]);
        } else {
          tables.push({ tableId: i + 1, a: aP, b: bP, weight: pairWeight(left[i], b, history, config, room, i, bIdx) });
        }
      }
      rounds.push({ round: r + 1, tables, rest, computeMs: nowMs() - t0 });
    }
  } else {
    // Modo restringido: flujo exacto por ronda con restricciones duras e intra-noche.
    for (let r = 0; r < R; r++) {
      const t0 = nowMs();
      const weight = (i: number, j: number): number => {
        const pL = left[i];
        const pR = right[j];
        if (metTonight.has(pairKey(pL.uid, pR.uid))) return HARD_COST;
        const wgt = pairWeight(pL, pR, history, config, room, i, j);
        return wgt <= -1e8 ? HARD_COST : -wgt;
      };
      const ghost = (i: number): number => {
        const uid = left[i].uid;
        const already = restsCount.get(uid) ?? 0;
        if (already > 0) {
          const allRested = left.every((p) => (restsCount.get(p.uid) ?? 0) > 0);
          if (!allRested) return HARD_COST;
        }
        return -config.restWeight;
      };

      let res = solveBipartite(nL, nR, g, weight, ghost);
      if (!res.feasible) {
        // Relajar restricción de descansos (situaciones extremas)
        res = solveBipartite(nL, nR, g, weight, () => -config.restWeight);
      }

      // Detección de infeasibilidad dura: si el flujo se vio forzado a usar un par
      // prohibido (bloqueado/incompatible), la noche termina en su máximo factible.
      // Nunca se sienta un par prohibido.
      let violates = false;
      for (let i = 0; i < nL && !violates; i++) {
        const pi = res.partnerOfLeft[i];
        if (pi >= 0 && pairWeight(left[i], right[pi], history, config, room, i, pi) <= -1e8) {
          violates = true;
        }
      }
      if (violates) break;

      const tables: TableAssignment[] = [];
      const rest: Participant[] = [];
      for (let i = 0; i < nL; i++) {
        const pL = left[i];
        if (res.partnerOfLeft[i] === -2) {
          tables.push({
            tableId: i + 1,
            a: aLarger ? pL : null,
            b: aLarger ? null : pL,
            weight: config.restWeight
          });
          rest.push(pL);
          restsCount.set(pL.uid, (restsCount.get(pL.uid) ?? 0) + 1);
        } else if (res.partnerOfLeft[i] >= 0) {
          const pR = right[res.partnerOfLeft[i]];
          const wgt = pairWeight(pL, pR, history, config, room, i, res.partnerOfLeft[i]);
          tables.push({
            tableId: i + 1,
            a: aLarger ? pL : pR,
            b: aLarger ? pR : pL,
            weight: wgt
          });
          metTonight.add(pairKey(pL.uid, pR.uid));
        }
      }
      rounds.push({ round: r + 1, tables, rest, computeMs: nowMs() - t0 });
    }
  }

  const metrics = computeMetrics(rounds, history, sideA, sideB, room);
  return { rounds, metrics, mode };
}

// ---------------------------------------------------------------------------
// Modo general (todos contra todos)
// ---------------------------------------------------------------------------
function buildGeneralNight(
  params: NightParams,
  config: ReturnType<typeof mergeConfig>,
  history: NightParams['history'],
  room: NightParams['room'],
  R: number
): NightPlan {
  const all = [...params.sideA, ...params.sideB];
  const n = all.length;
  const rounds: RoundResult[] = [];
  const metTonight = new Set<string>(params.alreadyMet ?? new Set<string>());

  const wPair = (i: number, j: number): number => {
    if (metTonight.has(pairKey(all[i].uid, all[j].uid))) return HARD_PENALTY;
    if (!compatibilityOk(all[i], all[j]) || blockedPair(all[i], all[j])) return HARD_PENALTY;
    return pairWeight(all[i], all[j], history, config, room, i, j);
  };

  for (let r = 0; r < R; r++) {
    const t0 = nowMs();
    const useDp = n <= 18;
    const solved = useDp
      ? dpPerfectMatching(n, wPair)
      : generalPerfectMatching(n, wPair);
    const mate = solved.mate; // ambos solvers exponen mate: number[]

    const tables: TableAssignment[] = [];
    for (let i = 0; i < n; i++) {
      if (mate[i] > i) {
        const a = all[i];
        const b = all[mate[i]];
        const wgt = pairWeight(a, b, history, config, room, i, mate[i]);
        tables.push({ tableId: tables.length + 1, a, b, weight: wgt });
        metTonight.add(pairKey(a.uid, b.uid));
      }
    }
    rounds.push({ round: r + 1, tables, rest: [], computeMs: nowMs() - t0 });
  }

  const metrics = computeMetrics(rounds, history, params.sideA, params.sideB, room);
  return { rounds, metrics, mode: 'general' };
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------
function computeMetrics(
  rounds: RoundResult[],
  history: NightParams['history'],
  sideA: Participant[],
  sideB: Participant[],
  room: NightParams['room']
): EngineMetrics {
  const all = [...sideA, ...sideB];
  const perPersonMap = new Map<string, { fresh: number; repeats: number; met: Set<string> }>();
  for (const p of all) perPersonMap.set(p.uid, { fresh: 0, repeats: 0, met: new Set() });

  let freshFaces = 0;
  let historyRepeats = 0;

  for (const round of rounds) {
    for (const t of round.tables) {
      // Mesas de 4: cada bloque (ap × bp) genera sus pares cruzados 2+2.
      const crossPairs: [Participant, Participant][] = [];
      if (t.ap && t.bp && t.ap.length > 0 && t.bp.length > 0) {
        for (const a of t.ap) for (const b of t.bp) crossPairs.push([a, b]);
      } else if (t.a && t.b) {
        crossPairs.push([t.a, t.b]);
      }
      for (const [pa, pb] of crossPairs) {
        const enc = history.get(pa.uid, pb.uid);
        const isRepeat = enc !== null;
        const ppA = perPersonMap.get(pa.uid)!;
        const ppB = perPersonMap.get(pb.uid)!;
        if (isRepeat) {
          historyRepeats++;
          ppA.repeats++;
          ppB.repeats++;
        } else {
          freshFaces++;
          ppA.fresh++;
          ppB.fresh++;
        }
        ppA.met.add(pb.uid);
        ppB.met.add(pa.uid);
      }
    }
  }

  // Distancia total de transición: lo que cada participante camina entre rondas
  // consecutivas (solo el lado que rota se mueve; se mide sobre el grafo del local).
  let totalDistance = 0;
  if (room) {
    const prevPos = new Map<string, number>();
    for (const round of rounds) {
      const curPos = new Map<string, number>();
      for (const t of round.tables) {
        const pos = t.tableId - 1;
        if (t.a) curPos.set(t.a.uid, pos);
        if (t.b) curPos.set(t.b.uid, pos);
      }
      for (const [uid, pos] of curPos) {
        const prev = prevPos.get(uid);
        if (prev !== undefined && prev !== pos) {
          totalDistance += room.distance(prev, pos);
        }
      }
      prevPos.clear();
      for (const [uid, pos] of curPos) prevPos.set(uid, pos);
    }
  }

  const perPerson: PerPersonFreshness[] = [...perPersonMap.entries()].map(([uid, v]) => ({
    uid,
    fresh: v.fresh,
    repeats: v.repeats
  }));
  const historyRepeatsMax = perPerson.reduce((mx, p) => Math.max(mx, p.repeats), 0);

  // Cobertura: pares únicos reales vs máximo posible por participante
  let coverageSum = 0;
  let coverageMax = 0;
  for (const p of all) {
    const pp = perPersonMap.get(p.uid)!;
    const isA = sideA.some((x) => x.uid === p.uid);
    const otherSize = isA ? sideB.length : sideA.length;
    const maxPossible = Math.min(rounds.length, otherSize);
    coverageSum += Math.min(pp.met.size, maxPossible);
    coverageMax += maxPossible;
  }
  const coveragePct = coverageMax > 0 ? Math.round((coverageSum / coverageMax) * 1000) / 10 : 0;

  // Gini de descansos
  const restCounts = all.map((p) => rounds.filter((r) => r.rest.some((x) => x.uid === p.uid)).length);
  const restGini = gini(restCounts);

  return {
    freshFaces,
    historyRepeats,
    historyRepeatsMax,
    perPerson,
    coveragePct,
    restGini,
    totalDistance
  };
}

function gini(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  let cum = 0;
  let sumCum = 0;
  for (let i = 0; i < n; i++) {
    cum += sorted[i];
    sumCum += cum;
  }
  if (cum === 0) return 0;
  const g = (2 * sumCum) / (n * cum) - (n + 1) / n;
  return Math.max(0, Math.min(1, g));
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
