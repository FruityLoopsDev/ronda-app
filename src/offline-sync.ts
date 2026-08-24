import localforage from 'localforage';
import { setDoc, doc } from 'firebase/firestore';
import { RondaServices } from './firebase-config.js';

interface QueuedVote {
  id: string;
  myUid: string;
  targetUid: string;
  isYes: boolean;
  eventId: string;
  timestamp: number;
}

class OfflineSyncManager {
  private queueKey = 'ronda_pending_votes';

  constructor() {
    localforage.config({
      name: 'RondaApp',
      storeName: 'offline_sync'
    });

    // Listen to online event to flush queue
    window.addEventListener('online', () => {
      console.log("[OfflineSync] Conexión recuperada. Intentando sincronizar...");
      this.flushQueue();
    });
  }

  async pushVote(myUid: string, targetUid: string, isYes: boolean, eventId: string) {
    if (navigator.onLine) {
      // Try to send immediately if online
      try {
        await this._sendToFirebase(myUid, targetUid, isYes, eventId);
        return { status: 'sent' };
      } catch (err) {
        console.warn("[OfflineSync] Falló el envío directo. Encolando...", err);
      }
    }

    // Enqueue if offline or if direct send failed
    const vote: QueuedVote = {
      id: `${myUid}_${targetUid}_${Date.now()}`,
      myUid,
      targetUid,
      isYes,
      eventId,
      timestamp: Date.now()
    };

    await this._enqueue(vote);
    return { status: 'queued' };
  }

  private async _enqueue(vote: QueuedVote) {
    let queue = await localforage.getItem<QueuedVote[]>(this.queueKey) || [];
    queue.push(vote);
    await localforage.setItem(this.queueKey, queue);
    console.log(`[OfflineSync] Voto guardado offline (${queue.length} pendientes).`);
  }

  async flushQueue() {
    let queue = await localforage.getItem<QueuedVote[]>(this.queueKey) || [];
    if (queue.length === 0) return;

    console.log(`[OfflineSync] Procesando ${queue.length} votos pendientes...`);
    const remaining = [];

    for (const vote of queue) {
      try {
        await this._sendToFirebase(vote.myUid, vote.targetUid, vote.isYes, vote.eventId);
        console.log(`[OfflineSync] Voto sincronizado: ${vote.id}`);
      } catch (err) {
        console.error(`[OfflineSync] Error sincronizando ${vote.id}:`, err);
        remaining.push(vote);
      }
    }

    await localforage.setItem(this.queueKey, remaining);
    
    if (remaining.length === 0) {
      // Trigger event so UI knows sync is done
      window.dispatchEvent(new Event('ronda:synced'));
    }
  }

  private async _sendToFirebase(myUid: string, targetUid: string, isYes: boolean, eventId: string) {
    const docRef = doc(RondaServices.db, `events/${eventId}/likes/${myUid}_${targetUid}`);
    await setDoc(docRef, {
      from: myUid,
      to: targetUid,
      like: isYes,
      timestamp: new Date() // Server will update this accurately
    }, { merge: true });
  }
}

export const OfflineSync = new OfflineSyncManager();
