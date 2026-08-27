// mem-rr-v2/general.ts — Solver de emparejamiento general (grafo no bipartito)
// Búsqueda local multi-arranque: greedy + 2-opt iterado, con reparación de vértices sueltos.
// Casi-óptimo para n ≤ 40 y a prueba de errores. El solver exacto (DP) para n ≤ 18 está en exact.ts;
// el upgrade exacto de producción planificado es Edmonds' Blossom ponderado (ver spec §3.1).
// Módulo puro: sin dependencias de DOM ni Firebase.

export interface GeneralMatchingResult {
  /** mate[i] = índice del compañero de i, o -1 si quedó sin pareja. */
  mate: number[];
  weight: number;
  iterations: number;
  restarts: number;
}

function forbiddenEdge(w: (i: number, j: number) => number, i: number, j: number): boolean {
  return w(Math.min(i, j), Math.max(i, j)) <= -1e8;
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function computeWeight(n: number, w: (i: number, j: number) => number, mate: number[]): number {
  let weight = 0;
  for (let i = 0; i < n; i++) {
    if (mate[i] > i) weight += w(i, mate[i]);
  }
  return weight;
}

function runOnce(n: number, w: (i: number, j: number) => number, iterations: number, seed: number): { mate: number[]; weight: number; iterations: number } {
  const rnd = seededRng(seed);

  // --- Fase 1: greedy por peso (vértices en orden aleatorio) ---
  const mate = new Array<number>(n).fill(-1);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  for (const v of order) {
    if (mate[v] !== -1) continue;
    let best = -1;
    let bestW = -Infinity;
    for (let u = 0; u < n; u++) {
      if (u === v || mate[u] !== -1 || forbiddenEdge(w, v, u)) continue;
      const ww = w(Math.min(v, u), Math.max(v, u));
      if (ww > bestW) {
        bestW = ww;
        best = u;
      }
    }
    if (best !== -1) {
      mate[v] = best;
      mate[best] = v;
    }
  }

  // --- Fase 2: 2-opt (mejorar pares de aristas) ---
  let improved = true;
  let iters = 0;
  while (improved && iters < iterations) {
    improved = false;
    iters++;
    for (let i = 0; i < n; i++) {
      const j = mate[i];
      if (j === -1 || j <= i) continue;
      for (let k = 0; k < n; k++) {
        const l = mate[k];
        if (l === -1 || l <= k) continue;
        if (i === k || j === k || i === l) continue;
        if (forbiddenEdge(w, i, k) || forbiddenEdge(w, j, l)) continue;
        const cur = w(i, j) + w(k, l);
        const cand = w(i, k) + w(j, l);
        if (cand > cur + 1e-9) {
          mate[i] = k;
          mate[k] = i;
          mate[j] = l;
          mate[l] = j;
          improved = true;
        }
      }
    }
  }

  return { mate, weight: computeWeight(n, w, mate), iterations: iters };
}

/**
 * Emparejamiento general de peso máximo (multi-arranque).
 * @param n Número de vértices.
 * @param w Peso del par (i,j), i<j. <= -1e8 = prohibido.
 */
export function generalMatching(n: number, w: (i: number, j: number) => number, iterations = 300, restarts = 8): GeneralMatchingResult {
  let best: { mate: number[]; weight: number; iterations: number } | null = null;
  for (let r = 0; r < restarts; r++) {
    const seed = 123456789 + n * 7919 + r * 1013904223;
    const res = runOnce(n, w, iterations, seed);
    if (best === null || res.weight > best.weight) best = res;
  }
  return { mate: best!.mate, weight: best!.weight, iterations: best!.iterations, restarts };
}

/**
 * Emparejamiento general con preferencia por cobertura total:
 * si el greedy deja vértices sueltos, intenta emparejarlos reasignando pares, y
 * cierra con un pase final de 2-opt sobre el resultado.
 */
export function generalPerfectMatching(n: number, w: (i: number, j: number) => number): GeneralMatchingResult {
  const result = generalMatching(n, w);
  const mate = result.mate.slice();

  // Vértices sueltos: intentar casarlos con reasignación simple
  for (let iter = 0; iter < 50; iter++) {
    const singles: number[] = [];
    for (let i = 0; i < n; i++) if (mate[i] === -1) singles.push(i);
    if (singles.length === 0) break;

    let fixed = false;
    for (const s of singles) {
      if (fixed) break;
      let bestU = -1;
      let bestGain = -Infinity;
      for (let u = 0; u < n; u++) {
        if (u === s || mate[u] === -1) continue;
        const p = mate[u];
        if (forbiddenEdge(w, s, u)) continue;
        for (const s2 of singles) {
          if (s2 === s || forbiddenEdge(w, p, s2)) continue;
          const gain = w(Math.min(s, u), Math.max(s, u)) + w(Math.min(p, s2), Math.max(p, s2))
            - w(Math.min(u, p), Math.max(u, p));
          if (gain > bestGain) {
            bestGain = gain;
            bestU = u;
          }
        }
      }
      if (bestU !== -1) {
        const p = mate[bestU];
        const s2 = singles.find((x) => x !== s && !forbiddenEdge(w, p, x))!;
        mate[s] = bestU;
        mate[bestU] = s;
        mate[p] = s2;
        mate[s2] = p;
        fixed = true;
      }
    }
    if (!fixed) break;
  }

  // Pase final de mejora local (2-opt) sobre el resultado reparado
  let improved = true;
  let guard = 0;
  while (improved && guard < 100) {
    improved = false;
    guard++;
    for (let i = 0; i < n; i++) {
      const j = mate[i];
      if (j === -1 || j <= i) continue;
      for (let k = 0; k < n; k++) {
        const l = mate[k];
        if (l === -1 || l <= k) continue;
        if (i === k || j === k || i === l) continue;
        if (forbiddenEdge(w, i, k) || forbiddenEdge(w, j, l)) continue;
        const cur = w(i, j) + w(k, l);
        const cand = w(i, k) + w(j, l);
        if (cand > cur + 1e-9) {
          mate[i] = k;
          mate[k] = i;
          mate[j] = l;
          mate[l] = j;
          improved = true;
        }
      }
    }
  }

  return { mate, weight: computeWeight(n, w, mate), iterations: result.iterations, restarts: result.restarts };
}
