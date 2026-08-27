// mem-rr-v2/flow.ts — Solver exacto de emparejamiento bipartito ponderado
// vía Min-Cost Max-Flow (caminos de aumento sucesivos con SPFA).
// Módulo puro: sin dependencias de DOM ni Firebase.

export interface FlowEdge {
  to: number;
  cap: number;
  cost: number;
  rev: number;
}

export class MinCostFlow {
  n: number;
  g: FlowEdge[][];

  constructor(n: number) {
    this.n = n;
    this.g = Array.from({ length: n }, () => []);
  }

  addEdge(from: number, to: number, cap: number, cost: number): void {
    this.g[from].push({ to, cap, cost, rev: this.g[to].length });
    this.g[to].push({ to: from, cap: 0, cost: -cost, rev: this.g[from].length - 1 });
  }

  /**
   * Min-cost max-flow con SPFA (soporta costos negativos, adecuado para n pequeños).
   * Detiene si no encuentra más caminos aumentantes.
   */
  minCostMaxFlow(s: number, t: number): { flow: number; cost: number } {
    const { n, g } = this;
    const INF = Number.POSITIVE_INFINITY;
    let flow = 0;
    let cost = 0;

    while (true) {
      const dist = new Array<number>(n).fill(INF);
      const inQueue = new Array<boolean>(n).fill(false);
      const prevV = new Array<number>(n).fill(-1);
      const prevE = new Array<number>(n).fill(-1);
      dist[s] = 0;
      const queue: number[] = [s];
      inQueue[s] = true;

      while (queue.length > 0) {
        const v = queue.shift()!;
        inQueue[v] = false;
        for (let i = 0; i < g[v].length; i++) {
          const e = g[v][i];
          if (e.cap > 0 && dist[e.to] > dist[v] + e.cost) {
            dist[e.to] = dist[v] + e.cost;
            prevV[e.to] = v;
            prevE[e.to] = i;
            if (!inQueue[e.to]) {
              inQueue[e.to] = true;
              queue.push(e.to);
            }
          }
        }
      }

      if (dist[t] === INF) break; // sin más caminos

      // Encontrar el flujo máximo por este camino (1 por capacidad de nodo)
      let add = Number.POSITIVE_INFINITY;
      for (let v = t; v !== s; v = prevV[v]) {
        add = Math.min(add, g[prevV[v]][prevE[v]].cap);
      }
      for (let v = t; v !== s; v = prevV[v]) {
        const e = g[prevV[v]][prevE[v]];
        e.cap -= add;
        g[v][e.rev].cap += add;
      }
      flow += add;
      cost += add * dist[t];
    }

    return { flow, cost };
  }
}

/**
 * Resultado del emparejamiento bipartito con fantasma.
 */
export interface BipartiteMatchingResult {
  /** Índice del lado mayor (siempre emparejado). partnerOf[i] = índice del lado menor real, o -1 si descansa. */
  partnerOfLeft: number[];
  /** Índices del lado mayor que descansan (emparejados con fantasma). */
  restsLeft: number[];
  /** Peso total de los pares reales + descansos. */
  totalWeight: number;
  /** true si todos los participantes del lado mayor fueron asignados. */
  feasible: boolean;
}

/**
 * Emparejamiento perfecto ponderado en grafo bipartito con nodos fantasma.
 *
 * @param nLeft  Participantes del lado mayor (deben emparejarse todos).
 * @param nRight Participantes reales del lado menor (nRight <= nLeft).
 * @param nGhost Asientos fantasma en el lado menor (nRight + nGhost === nLeft).
 * @param weight Costo de emparejar left i con right j (números grandes para prohibido: ver HARD_COST).
 * @param ghostCost Costo de que left i descanse (fantasma). Infinity si no puede descansar.
 */
export function solveBipartite(
  nLeft: number,
  nRight: number,
  nGhost: number,
  weight: (i: number, j: number) => number,
  ghostCost: (i: number) => number
): BipartiteMatchingResult {
  const S = 0;
  const leftOffset = 1;
  const rightOffset = leftOffset + nLeft;
  const ghostOffset = rightOffset + nRight;
  const T = ghostOffset + nGhost;

  const mcf = new MinCostFlow(T + 1);

  for (let i = 0; i < nLeft; i++) {
    mcf.addEdge(S, leftOffset + i, 1, 0);
  }
  for (let i = 0; i < nLeft; i++) {
    for (let j = 0; j < nRight; j++) {
      mcf.addEdge(leftOffset + i, rightOffset + j, 1, weight(i, j));
    }
    for (let k = 0; k < nGhost; k++) {
      mcf.addEdge(leftOffset + i, ghostOffset + k, 1, ghostCost(i));
    }
  }
  for (let j = 0; j < nRight; j++) {
    mcf.addEdge(rightOffset + j, T, 1, 0);
  }
  for (let k = 0; k < nGhost; k++) {
    mcf.addEdge(ghostOffset + k, T, 1, 0);
  }

  const { flow, cost } = mcf.minCostMaxFlow(S, T);
  const feasible = flow === nLeft;

  // Extraer asignación recorriendo las aristas de ida (left -> right / ghost)
  const partnerOfLeft = new Array<number>(nLeft).fill(-1);
  for (let i = 0; i < nLeft; i++) {
    for (const e of mcf.g[leftOffset + i]) {
      if (e.cap === 0 && e.to >= rightOffset) {
        if (e.to < ghostOffset) {
          partnerOfLeft[i] = e.to - rightOffset;
        } else {
          partnerOfLeft[i] = -2; // fantasma (descansa)
        }
      }
    }
  }

  const restsLeft: number[] = [];
  for (let i = 0; i < nLeft; i++) {
    if (partnerOfLeft[i] === -2) restsLeft.push(i);
  }

  return { partnerOfLeft, restsLeft, totalWeight: -cost, feasible };
}
