// mem-rr-history.ts — Adaptador de historial de encuentros para el motor MEM-RR v2
// Implementa la interfaz History del motor (src/mem-rr-v2/types.ts).
// Demo: memoria con histórico determinista sembrado (como hacía el v1 con PRNG).
// Producción: lectura/escritura en Firestore `users/{uid}/encounters/{otherUid}`.
//
// NOTA: este módulo vive fuera de src/mem-rr-v2/ porque depende de Firebase/DB (capa app).

import { RondaServices } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { History, Encounter, Participant } from './mem-rr-v2/types.ts';
import { pairKey } from './mem-rr-v2/weights.ts';

export interface RecordedPair {
  a: Participant;
  b: Participant;
}

/** PRNG determinista (misma familia que usa el v1) para sembrar el histórico demo. */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class RondaHistoryAdapter implements History {
  private map = new Map<string, Encounter>();
  private loadedUids = new Set<string>();

  get(uid1: string, uid2: string): Encounter | null {
    return this.map.get(pairKey(uid1, uid2)) ?? null;
  }

  /** Número de pares con historial cargado (para diagnóstico). */
  get size(): number {
    return this.map.size;
  }

  /**
   * Carga el historial de encuentros de los participantes de la noche.
   * Llamar una vez al iniciar el plan (antes de buildNightPlan).
   */
  async loadFor(participants: Participant[]): Promise<void> {
    if (participants.length < 2) return;



    // Producción: leer users/{uid}/encounters/{otherUid}
    for (const p of participants) {
      if (this.loadedUids.has(p.uid)) continue;
      for (const q of participants) {
        if (q.uid === p.uid) continue;
        try {
          const ref = doc(RondaServices.db, 'users', p.uid, 'encounters', q.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const d = snap.data() as Record<string, unknown>;
            const lastAt = typeof d.lastAt === 'number' ? d.lastAt : Date.now();
            this.map.set(pairKey(p.uid, q.uid), {
              n: typeof d.n === 'number' ? d.n : 1,
              lastAtDaysAgo: Math.max(0, Math.round((Date.now() - lastAt) / 86400000)),
              match: d.match === true
            });
          }
        } catch (err) {
          console.warn('[Historial] No se pudo leer el historial de', p.uid, err);
        }
      }
      this.loadedUids.add(p.uid);
    }
  }

  /**
   * Registra los pares reales de una ronda en el historial (incrementa n, recencia = 0).
   * En producción escribe Firestore en modo fire-and-forget (best effort).
   */
  async recordPairs(pairs: RecordedPair[]): Promise<void> {
    const now = Date.now();
    for (const { a, b } of pairs) {
      const key = pairKey(a.uid, b.uid);
      const prev = this.map.get(key);
      const enc: Encounter = {
        n: (prev?.n ?? 0) + 1,
        lastAtDaysAgo: 0,
        match: prev?.match ?? false
      };
      this.map.set(key, enc);

      setDoc(
        doc(RondaServices.db, 'users', a.uid, 'encounters', b.uid),
        { n: enc.n, lastAt: now, match: enc.match },
        { merge: true }
      ).catch((err) => console.warn('[Historial] No se pudo escribir', err));
    }
  }

  /** Limpia el historial en memoria (al cerrar sesión / cambiar de evento). */
  reset(): void {
    this.map.clear();
    this.loadedUids.clear();
  }


}

export const RRHistory = new RondaHistoryAdapter();
