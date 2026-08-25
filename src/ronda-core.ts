// ronda-core.js: Motor Algorítmico MEM-RR (Memory-Driven Round-Robin)
// Patente pendiente: Algoritmo de rotación B2B2C con evasión de colisiones históricas.

class RondaEngineService {
  collisionMatrix: Map<string, number>;
  constructor() {
    // Matriz de colisiones históricas: trackea cuántas veces i y j se han cruzado.
    this.collisionMatrix = new Map();
  }

  // Genera un ID único para el par ordenado
  _getPairKey(p1, p2) {
    return [p1.uid, p2.uid].sort().join('-');
  }

  // Obtiene el costo de colisión
  getCollisionCost(p1, p2) {
    const key = this._getPairKey(p1, p2);
    return this.collisionMatrix.get(key) || 0;
  }

  // Actualiza el historial de colisiones después de una ronda
  recordRound(matches) {
    matches.forEach(match => {
      const key = this._getPairKey(match.p1, match.p2);
      const current = this.collisionMatrix.get(key) || 0;
      this.collisionMatrix.set(key, current + 1);
    });
  }

  // Calcula la afinidad base según orientación e intereses (0 a 1)
  getAffinityScore(p1, p2) {
    let score = 0;
    
    // Filtro estricto de orientación y género
    const p1MatchesP2 = p1.orientation === 'A' || p1.orientation === p2.gender;
    const p2MatchesP1 = p2.orientation === 'A' || p2.orientation === p1.gender;
    
    if (!p1MatchesP2 || !p2MatchesP1) return -999; // Incompatible

    score += 0.5; // Base compatible

    // Lógica adicional (ej: cercanía de edad)
    const ageDiff = Math.abs((p1.age || 25) - (p2.age || 25));
    if (ageDiff <= 5) score += 0.3;
    else if (ageDiff <= 10) score += 0.1;

    return score;
  }

  // Genera el Fixture óptimo para una ronda
  // Utiliza el modelo matemático Max Σ (Afinity - C * Collision)
  generateNextRound(participants) {
    if (participants.length < 2) return [];

    let bestMatches = [];
    let bestScore = -Infinity;
    
    const C = 2.0; // Coeficiente de penalización por colisión
    
    // Algoritmo heurístico para emparejamientos
    // En producción se usaría Edmond's Blossom Algorithm para Maximum Weight Matching.
    // Para la prueba/MVP, iteramos desplazamientos (Rotación Circular Mapeada).

    // Separamos aleatoriamente en dos grupos (estáticos y rotativos) para simular Round-Robin
    const half = Math.floor(participants.length / 2);
    let groupA = participants.slice(0, half);
    let groupB = participants.slice(half);

    // Si es impar, añadimos un "fantasma" o lo dejamos en espera
    if (groupA.length < groupB.length) groupA.push(null);

    // Explorar d desplazamientos (d desde 0 hasta N/2 - 1)
    for (let d = 0; d < groupB.length; d++) {
      let currentMatches = [];
      let currentScore = 0;

      for (let i = 0; i < groupA.length; i++) {
        const p1 = groupA[i];
        // Desplazamiento circular
        const p2 = groupB[(i + d) % groupB.length];

        if (p1 && p2) {
          const affinity = this.getAffinityScore(p1, p2);
          const collision = this.getCollisionCost(p1, p2);
          
          const weight = affinity - (C * collision);
          
          if (weight > -500) { // Si son medianamente compatibles
            currentMatches.push({ p1, p2, tableId: `Mesa-${i+1}`, weight });
            currentScore += weight;
          }
        }
      }

      if (currentScore > bestScore && currentMatches.length > 0) {
        bestScore = currentScore;
        bestMatches = currentMatches;
      }
    }

    return bestMatches;
  }
}

export const RondaEngine = new RondaEngineService();
