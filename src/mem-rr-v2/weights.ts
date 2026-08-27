// mem-rr-v2/weights.ts — Modelo de pesos w(i,j) = α·A + β·F − γ·R − δ·D
// Módulo puro: sin dependencias de DOM ni Firebase.

import type {
  Participant,
  History,
  RoomGraph,
  EngineConfig
} from './types.ts';
import { DEFAULT_CONFIG } from './types.ts';

/** Penalización para pares prohibidos (restricción dura). Debe dominar cualquier peso real. */
export const HARD_PENALTY = -1e9;

/** Costo de flujo equivalente para un par prohibido. */
export const HARD_COST = 1e9;

export function mergeConfig(config?: Partial<EngineConfig>): EngineConfig {
  return { ...DEFAULT_CONFIG, ...(config ?? {}) };
}

/** Compatibilidad dura por orientación/género. */
export function compatibilityOk(a: Participant, b: Participant): boolean {
  const aOk = a.orientation === 'A' || a.orientation === b.gender;
  const bOk = b.orientation === 'A' || b.orientation === a.gender;
  return aOk && bOk;
}

/** Par bloqueado/denunciado (restricción dura). */
export function blockedPair(a: Participant, b: Participant): boolean {
  return (a.blocked ?? []).includes(b.uid) || (b.blocked ?? []).includes(a.uid);
}

/** Afinidad blanda: base compatible + cercanía de edad + intereses compartidos. */
export function affinity(a: Participant, b: Participant): number {
  let s = 1;
  const ageDiff = Math.abs((a.age ?? 30) - (b.age ?? 30));
  if (ageDiff <= 5) s += 0.3;
  else if (ageDiff <= 10) s += 0.1;
  const shared = (a.interests ?? []).filter((x) => (b.interests ?? []).includes(x)).length;
  s += Math.min(0.3, shared * 0.1);
  return s;
}

/**
 * Frescura (curva de olvido): F = 1 − exp(−λ·Δdías) si se conocen; F = 1 si nunca se vieron.
 * Un cruce reciente reduce la novedad; el tiempo la recupera.
 */
export function freshness(a: Participant, b: Participant, history: History, lambda: number): number {
  const enc = history.get(a.uid, b.uid);
  if (!enc) return 1;
  return 1 - Math.exp(-lambda * enc.lastAtDaysAgo);
}

/**
 * Repetición acumulada con decaimiento: R = Σ_n exp(−λ·Δdías_n).
 * El historial se modela como n encuentros en el último encuentro (aproximación estable);
 * si el par tuvo match mutuo, el costo se reduce (ya tienen canal abierto).
 */
export function repetition(a: Participant, b: Participant, history: History, lambda: number): number {
  const enc = history.get(a.uid, b.uid);
  if (!enc) return 0;
  let r = enc.n * Math.exp(-lambda * enc.lastAtDaysAgo);
  if (enc.match) r *= 0.3;
  return r;
}

/**
 * Distancia de transición normalizada (0..1) entre posiciones de mesa.
 */
export function distanceCost(aPos: number, bPos: number, room: RoomGraph): number {
  return room.distance(aPos, bPos) / room.maxDistance;
}

/**
 * Peso completo de la pareja. Devuelve HARD_PENALTY si el par viola una restricción dura.
 */
export function pairWeight(
  a: Participant,
  b: Participant,
  history: History,
  config: EngineConfig,
  room?: RoomGraph,
  aPos?: number,
  bPos?: number
): number {
  if (!compatibilityOk(a, b)) return HARD_PENALTY;
  if (blockedPair(a, b)) return HARD_PENALTY;
  if (config.requireVerified && (!a.verified || !b.verified)) return HARD_PENALTY;

  const A = affinity(a, b);
  const F = freshness(a, b, history, config.lambda);
  const R = repetition(a, b, history, config.lambda);
  const D = room !== undefined && aPos !== undefined && bPos !== undefined
    ? distanceCost(aPos, bPos, room)
    : 0;

  return config.alpha * A + config.beta * F - config.gamma * R - config.delta * D;
}

export function pairKey(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}|${uid2}` : `${uid2}|${uid1}`;
}
