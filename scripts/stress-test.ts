import { buildNightPlan } from '../src/mem-rr-v2/engine.js';
import type { Participant, History, Encounter } from '../src/mem-rr-v2/types.js';

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
    const k = uid1 < uid2 ? uid1 + '|' + uid2 : uid2 + '|' + uid1;
    return this.map.get(k) ?? null;
  }
  set(uid1: string, uid2: string, e: Encounter): void {
    const k = uid1 < uid2 ? uid1 + '|' + uid2 : uid2 + '|' + uid1;
    this.map.set(k, e);
  }
}

function generateLoad(nA: number, nB: number, rounds: number) {
  console.log(`\n🔥 Iniciando Stress Test: ${nA} Mujeres, ${nB} Hombres, ${rounds} Rondas`);
  const rnd = mulberry32(12345);
  
  const sideA: Participant[] = Array.from({ length: nA }, (_, i) => ({
    uid: `F${i}`, gender: 'F', orientation: 'M', age: 25 + Math.floor(rnd() * 10), interests: ['salsa'], verified: true
  }));
  const sideB: Participant[] = Array.from({ length: nB }, (_, i) => ({
    uid: `M${i}`, gender: 'M', orientation: 'F', age: 25 + Math.floor(rnd() * 10), interests: ['salsa'], verified: true
  }));

  const history = new MapHistory();
  // Simular historial 10% densidad
  for (const a of sideA) {
    for (const b of sideB) {
      if (rnd() < 0.1) {
        history.set(a.uid, b.uid, { n: 1, lastAtDaysAgo: 10, match: false });
      }
    }
  }

  const start = performance.now();
  try {
    const plan = buildNightPlan({ sideA, sideB, rounds, history, config: { delta: 0 } });
    const ms = performance.now() - start;
    console.log(`✅ ÉXITO: Tiempo total = ${ms.toFixed(2)} ms`);
    console.log(`📊 Métricas: ${plan.rounds.length} rondas factibles, Cobertura: ${plan.metrics.coveragePct}%`);
    if (ms > 5000) console.log(`⚠️ ALERTA: Tiempo excedió los 5 segundos. Hilo bloqueado.`);
  } catch (error: any) {
    const ms = performance.now() - start;
    console.log(`❌ ERROR (OOM o Timeout): Falló después de ${ms.toFixed(2)} ms.`);
    console.error(error.message);
  }
}

// Ejecutar escenarios
console.log("=== RONDA APP: STRESS TEST V2 ===");
generateLoad(12, 12, 9);    // Escenario Típico
generateLoad(30, 30, 10);   // Macro-evento Pequeño
generateLoad(50, 50, 10);   // Macro-evento Mediano
generateLoad(100, 100, 10); // Macro-evento Gigante (Probable Timeout/Congelamiento)
