import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, Unsubscribe } from "firebase/firestore";
import { RondaConfig, RondaServices } from "./firebase-config.js";

// Basic Types
export interface User {
  uid: string;
  role: string;
  name?: string;
  age?: number;
  gender?: string;
  orientation?: string;
  activeEventId?: string;
  wallet_address?: string;
  nfts?: any[];
}

export interface Match {
  tableId: string;
  p1: { uid: string; name: string };
  p2: { uid: string; name: string };
  isRepeat?: boolean;
}

export interface Event {
  id: string;
  status: string;
  participants: string[];
  currentRound: number;
  activeMatches?: Match[];
}

export class DatabaseInterface {
  isDemo: boolean;
  memoryDb: {
    users: Record<string, User>;
    events: Record<string, Event>;
  };

  constructor() {
    this.isDemo = RondaConfig.isDemo;
    this.memoryDb = {
      users: {},
      events: {}
    };
  }

  private _getFirestore() {
    return RondaServices.db;
  }

  // --- Usuarios ---
  async getUser(userId: string): Promise<User | null> {
    if (this.isDemo) {
      return this.memoryDb.users[userId] || null;
    }
    const docRef = doc(this._getFirestore(), 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as User) : null;
  }

  async saveUser(user: User): Promise<User> {
    if (this.isDemo) {
      this.memoryDb.users[user.uid] = user;
      return user;
    }
    const docRef = doc(this._getFirestore(), 'users', user.uid);
    await setDoc(docRef, user, { merge: true });
    return user;
  }

  // --- Eventos / Salas ---
  async getEvent(eventId: string): Promise<Event | null> {
    if (this.isDemo) {
      return this.memoryDb.events[eventId] || null;
    }
    const docRef = doc(this._getFirestore(), 'events', eventId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as Event) : null;
  }
  
  async saveEvent(event: Event): Promise<Event> {
    if (this.isDemo) {
      this.memoryDb.events[event.id] = event;
      return event;
    }
    const docRef = doc(this._getFirestore(), 'events', event.id);
    await setDoc(docRef, event as any, { merge: true });
    return event;
  }

  async joinEvent(eventId: string, userId: string): Promise<Event> {
    if (this.isDemo) {
      const event = this.memoryDb.events[eventId] || { id: eventId, status: 'waiting', currentRound: 0, participants: [] };
      if (!event.participants.includes(userId)) {
        event.participants.push(userId);
      }
      this.memoryDb.events[eventId] = event;
      if (this.memoryDb.users[userId]) {
        this.memoryDb.users[userId].activeEventId = eventId;
      }
      return event;
    }
    
    const event = await this.getEvent(eventId);
    if (!event) throw new Error("El evento no existe.");
    
    if (!event.participants) {
      event.participants = [];
    }
    
    if (!event.participants.includes(userId)) {
      event.participants.push(userId);
    }
    
    await this.saveEvent(event);
    
    const userDoc = await this.getUser(userId);
    if (userDoc) {
      userDoc.activeEventId = eventId;
      await this.saveUser(userDoc);
    }
    
    return event;
  }

  async confirmarSala(eventId: string, usersConfirmed: string[]): Promise<Event | null> {
    console.log(`[DB] Confirmando sala para el evento: ${eventId}...`);
    
    let event = await this.getEvent(eventId);
    if (!event) return null;
    
    event.status = 'finished';
    event.participants = usersConfirmed;
    await this.saveEvent(event);
    
    // Simplificación de NFTs (Se integrará en la fase de Web3)
    console.log("[DB] NFTs simulados...");
    
    return event;
  }

  subscribeToEvent(eventId: string, callback: (data: Event) => void): Unsubscribe | Function {
    if (this.isDemo) {
      setTimeout(() => {
        const event = this.memoryDb.events[eventId];
        if (event) callback(event);
      }, 1000);
      return () => { console.log('Unsubscribed'); };
    }
    
    const docRef = doc(this._getFirestore(), 'events', eventId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as Event);
      }
    }, (error) => {
      console.error("Error en suscripción de Firestore:", error);
    });
    
    return unsubscribe;
  }
}

export const DB = new DatabaseInterface();
