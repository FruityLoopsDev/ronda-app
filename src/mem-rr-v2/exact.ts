// mem-rr-v2/exact.ts — Emparejamiento perfecto exacto (grafo general) por DP de subconjuntos.
// Referencia de exactitud para validar solvers heurísticos y para salas pequeñas (n ≤ 18).
// Para salas grandes (n > 18) se usa general.ts (búsqueda local); el upgrade exacto de
// producción planificado es Edmonds' Blossom ponderado (Blossom V) — ver spec §3.1.
// Módulo puro: sin dependencias de DOM ni Firebase.

export interface ExactMatchingResult {
  /** mate[i] = compañero de i, o -1 si el emparejamiento perfecto no existe. */
  mate: number[];
  weight: number;
  /** true si se encontró emparejamiento perfecto. */
  feasible: boolean;
}

function lowestUnsetBit(mask: number, n: number): number {
  for (let i = 0; i < n; i++) {
    if ((mask & (1 << i)) === 0) return i;
  }
  return -1;
}

/**
 * Emparejamiento perfecto de peso máximo por DP sobre subconjuntos.
 * O(2^n · n). Exacto. Prohibido: w(i,j) <= -1e8.
 */
export function dpPerfectMatching(n: number, w: (i: number, j: number) => number): ExactMatchingResult {
  if (n === 0) return { mate: [], weight: 0, feasible: true };
  if (n % 2 !== 0) {
    return { mate: new Array<number>(n).fill(-1), weight: 0, feasible: false };
  }
  if (n > 18) {
    throw new Error(`dpPerfectMatching: n=${n} excede el límite de 18 vértices`);
  }

  const N = 1 << n;
  const NEG = -Infinity;
  const dp = new Float64Array(N).fill(NEG);
  const choice = new Int32Array(N).fill(-1);
  dp[0] = 0;

  for (let mask = 0; mask < N; mask++) {
    const cur = dp[mask];
    if (cur === NEG) continue;
    const i = lowestUnsetBit(mask, n);
    if (i === -1) continue; // máscara completa
    for (let j = i + 1; j < n; j++) {
      if ((mask & (1 << j)) !== 0) continue;
      const ww = w(i, j);
      if (ww <= -1e8) continue; // prohibido
      const nm = mask | (1 << i) | (1 << j);
      const nv = cur + ww;
      if (nv > dp[nm]) {
        dp[nm] = nv;
        choice[nm] = i * n + j;
      }
    }
  }

  const full = N - 1;
  if (dp[full] === NEG) {
    return { mate: new Array<number>(n).fill(-1), weight: 0, feasible: false };
  }

  const mate = new Array<number>(n).fill(-1);
  let mask = full;
  while (mask !== 0) {
    const c = choice[mask];
    if (c < 0) break;
    const i = Math.floor(c / n);
    const j = c % n;
    mate[i] = j;
    mate[j] = i;
    mask &= ~(1 << i);
    mask &= ~(1 << j);
  }

  return { mate, weight: dp[full], feasible: true };
}
