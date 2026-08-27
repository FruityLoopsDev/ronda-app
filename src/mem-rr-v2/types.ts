// mem-rr-v2/types.ts — Tipos del motor MEM-RR v2 (WMM)
// Módulo puro: sin dependencias de DOM ni Firebase, ejecutable en Node.

export type Gender = 'M' | 'F' | 'NB';
export type Orientation = 'M' | 'F' | 'NB' | 'A'; // A = cualquier género

export interface Participant {
  uid: string;
  /** Nombre para mostrar (no usado por el motor; lo consume la UI del host) */
  name?: string;
  gender: Gender;
  orientation: Orientation;
  age: number;
  interests?: string[];
  verified?: boolean;
  /** UIDs que este participante ha bloqueado o denunciado (restricción dura) */
  blocked?: string[];
  /** Propensión de consumo 0..1 (para priorizar descansos que venden en barra) */
  consumptionPropensity?: number;
}

export interface Encounter {
  /** Número total de encuentros históricos */
  n: number;
  /** Días transcurridos desde el último encuentro */
  lastAtDaysAgo: number;
  /** Si el par tuvo match mutuo en algún encuentro */
  match: boolean;
}

export interface History {
  get(uid1: string, uid2: string): Encounter | null;
}

export interface RoomGraph {
  /** Distancia entre dos posiciones de mesa (0..1 normalizada por dist_máx) */
  distance(posA: number, posB: number): number;
  maxDistance: number;
}

export interface EngineConfig {
  /** Peso de la afinidad (compatibilidad + edad + intereses) */
  alpha: number;
  /** Peso de la frescura (curva de olvido) */
  beta: number;
  /** Peso de la penalización por repetición histórica */
  gamma: number;
  /** Peso de la distancia de transición (plano del local) */
  delta: number;
  /** Decaimiento por día (media-vida 30 días → ln2/30 ≈ 0.0231) */
  lambda: number;
  /** Peso base de descansar en la silla de barra (0 = neutro) */
  restWeight: number;
  /** Exigir participantes verificados para emparejar */
  requireVerified: boolean;
}

export const DEFAULT_CONFIG: EngineConfig = {
  alpha: 1.0,
  beta: 1.0,
  gamma: 1.0,
  delta: 0.0,
  lambda: Math.LN2 / 30,
  restWeight: 0.0,
  requireVerified: false
};

export type SideName = 'A' | 'B';

export interface TableAssignment {
  tableId: number;
  a: Participant | null; // null = asiento fantasma (descansa el de lado B)
  b: Participant | null; // null = asiento fantasma (descansa el de lado A)
  /** Miembros del lado A en mesas de 4 (2+2); vacío si no aplica. */
  ap?: Participant[];
  /** Miembros del lado B en mesas de 4 (2+2); vacío si no aplica. */
  bp?: Participant[];
  weight: number;
}

export interface RoundResult {
  round: number;
  tables: TableAssignment[];
  /** Participantes que descansaron esta ronda */
  rest: Participant[];
  computeMs: number;
}

export interface PerPersonFreshness {
  uid: string;
  fresh: number;   // caras nuevas (sin historial)
  repeats: number; // cruces con historial previo
}

export interface EngineMetrics {
  freshFaces: number;
  historyRepeats: number;
  historyRepeatsMax: number;
  perPerson: PerPersonFreshness[];
  coveragePct: number;
  restGini: number;
  totalDistance: number;
}

export interface NightPlan {
  rounds: RoundResult[];
  metrics: EngineMetrics;
  mode: 'offsets' | 'constrained' | 'general';
}

export interface NightParams {
  /** Participantes del lado A (fijo) */
  sideA: Participant[];
  /** Participantes del lado B (rota) */
  sideB: Participant[];
  /** Rondas de la noche */
  rounds: number;
  config?: Partial<EngineConfig>;
  history: History;
  room?: RoomGraph;
  /** true = formato "todos contra todos" (noches temáticas/LGTBIQ+); ignora la partición A/B */
  general?: boolean;
  /** Capacidad de mesa: 2 (1+1, por defecto) o 4 (2+2, segmento 45+). Modo offset-geométrico. */
  tableSize?: 2 | 4;
  /**
   * Pares (claves ordenadas "uid1|uid2") que ya se conocieron en rondas previas de esta
   * noche (re-planificación intra-noche). Se tratan como restricción dura. Si no está vacío,
   * el planificador fuerza el modo 'constrained'.
   */
  alreadyMet?: Set<string>;
  /** Semilla para reproducibilidad (solo afecta desempates) */
  seed?: number;
}
