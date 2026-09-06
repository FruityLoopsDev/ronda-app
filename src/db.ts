import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, getDocs, writeBatch, arrayUnion, Unsubscribe } from "firebase/firestore";
import { RondaConfig, RondaServices } from "./firebase-config.js";
import { Matches } from "./matches.js";

// Basic Types
export interface Reservation {
  id?: string;
  eventId: string;
  venueName: string;
  venueAddress: string;
  mapsUrl: string;
  dayDate: string;
  tableNumber: string;
  cocktailName: string;
  cocktailDesc?: string;
  cocktailImg?: string;
  bookingCode: string;
  priceFormatted: string;
  hostTips?: string[];
  status?: 'confirmed' | 'checked_in' | 'completed' | 'cancelled';
  createdAt?: string;
}

export interface User {
  uid: string;
  role: string;
  name?: string;
  email?: string;
  username?: string;
  photoURL?: string;
  age?: number;
  birthDate?: string;
  zodiacSign?: string;
  gender?: string;
  orientation?: string;
  bio?: string;
  favoriteCocktail?: string;
  preferredZones?: string[];
  ageRangePreference?: { min: number; max: number };
  isVerified?: boolean;
  linkedinUrl?: string;
  linkedinVerified?: boolean;
  linkedinVerifiedAt?: string;
  linkedinHeadline?: string;
  linkedinSlug?: string;
  profession?: string;
  safeword?: string;
  emergencyContact?: string;
  hasTicket?: boolean;
  paymentPending?: boolean;
  paymentMethod?: string;
  checkedIn?: boolean;
  phoneNumber?: string;
  stats?: {
    roundsPlayed?: number;
    venuesVisited?: number;
    matchesCount?: number;
  };
  privacySettings?: {
    shareDrinkStats?: boolean;
    marketingConsent?: boolean;
  };
  activeEventId?: string;
  activeWaitlist?: {
    eventId: string;
    venueName: string;
    dayDate: string;
    position: number;
    joinedAt: string;
    status: 'waiting' | 'spot_available';
  };
  activeReservation?: Reservation;
  reservationsHistory?: Reservation[];
  postEventState?: {
    eventId: string;
    venueName: string;
    dayDate: string;
    revealTimeIso: string;
    isRevealed: boolean;
    isLetterBurned?: boolean;
    chatExpiresAtIso?: string;
    chatHistory?: {
      id: string;
      sender: 'me' | 'partner';
      text: string;
      time: string;
      timestamp: number;
    }[];
    secondDateBooking?: {
      venueName: string;
      date: string;
      time: string;
      discountCode: string;
      status: 'pending' | 'confirmed';
    };
    matches: {
      id: string;
      name: string;
      age: number;
      profession: string;
      zone: string;
      cocktail: string;
      icebreakerSummary: string;
    }[];
  };
  serviceRequests?: {
    serviceName: string;
    requestedAt: string;
    status: 'pending' | 'scheduled' | 'completed';
  }[];
  wallet_address?: string;
  nfts?: any[];
  matches?: string[];
  satisfactionFeedback?: any;
}

export interface Match {
  tableId: string;
  p1: { uid: string; name: string };
  p2: { uid: string; name: string };
  isRepeat?: boolean;
}

export interface RondaEvent {
  id: string;
  status: string;
  participants: string[];
  currentRound: number;
  activeMatches?: Match[];
  playedPairs?: string[];
  name?: string;
  venueName?: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  zone: string;
  lat: number;
  lng: number;
  status: 'active' | 'inactive';
}

export interface Lead {
  id: string;
  name: string;
  contactName: string;
  status: 'lead' | 'negotiating' | 'signed';
  sales_uid: string;
  commission: number;
}

function cleanFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanFirestoreData(item)).filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned;
  }
  return obj;
}

export class DatabaseInterface {
  memoryDb?: any;

  constructor() {}

  private _getFirestore() {
    return RondaServices.db;
  }

  // --- Usuarios ---
  async getUser(userId: string): Promise<User | null> {
    const docRef = doc(this._getFirestore(), 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as User) : null;
  }

  async saveUser(user: User): Promise<User> {
    const docRef = doc(this._getFirestore(), 'users', user.uid);
    const sanitized = cleanFirestoreData(user);
    await setDoc(docRef, sanitized, { merge: true });
    return user;
  }

  // --- Eventos / Salas ---
  async getEvent(eventId: string): Promise<RondaEvent | null> {
    const docRef = doc(this._getFirestore(), 'events', eventId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as RondaEvent) : null;
  }
  
  async saveEvent(event: RondaEvent): Promise<RondaEvent> {
    const docRef = doc(this._getFirestore(), 'events', event.id);
    await setDoc(docRef, event as any, { merge: true });
    return event;
  }

  async getUpcomingEvents(): Promise<any[]> {
    try {
      const colRef = collection(this._getFirestore(), 'events');
      const snap = await getDocs(colRef);
      const events: any[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'upcoming' || data.status === 'active') {
          events.push(data);
        }
      });
      return events;
    } catch (e) {
      console.warn("getUpcomingEvents no implementado o falló", e);
      return [];
    }
  }


  async joinEvent(eventId: string, userId: string): Promise<RondaEvent> {
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

  async processEventMatches(eventId: string): Promise<{ matchedPairsCount: number }> {
    console.log(`[DB] Calculando matches mutuos para el evento: ${eventId} ($0 - Consola Host)...`);
    try {
      const fs = this._getFirestore();
      const likesCol = collection(fs, 'events', eventId, 'likes');
      const likesSnap = await getDocs(likesCol);
      const likesList: { from: string; to: string; like: boolean }[] = [];
      
      likesSnap.forEach(snap => {
        const d = snap.data();
        if (d && d.from && d.to) {
          likesList.push({ from: d.from, to: d.to, like: Boolean(d.like) });
        }
      });

      const mutualMatches = Matches.findMutualMatchesFromLikes(likesList);
      if (mutualMatches.length > 0) {
        const batch = writeBatch(fs);
        for (const match of mutualMatches) {
          const u1Ref = doc(fs, 'users', match.user1);
          const u2Ref = doc(fs, 'users', match.user2);
          batch.update(u1Ref, { matches: arrayUnion(match.user2) });
          batch.update(u2Ref, { matches: arrayUnion(match.user1) });
        }
        await batch.commit();
      }
      return { matchedPairsCount: mutualMatches.length };
    } catch (err) {
      console.error("[DB] Error procesando matches mutuos:", err);
      return { matchedPairsCount: 0 };
    }
  }

  async confirmarSala(eventId: string, usersConfirmed: string[]): Promise<{ event: RondaEvent; matchesCount: number } | null> {
    console.log(`[DB] Confirmando sala y finalizando evento: ${eventId}...`);
    
    let event = await this.getEvent(eventId);
    if (!event) return null;
    
    event.status = 'finished';
    event.participants = usersConfirmed;
    await this.saveEvent(event);
    
    // 1. Procesar matches mutuos de forma autónoma en cliente ($0 sin Cloud Functions)
    const matchResult = await this.processEventMatches(eventId);

    // 2. Emisión de Certificados Digitales Proof-of-Attendance ($0 Web3 / Cryptographic Token)
    const timestamp = Date.now();
    for (const uid of usersConfirmed) {
      try {
        const user = await this.getUser(uid);
        if (user) {
          user.nfts = user.nfts || [];
          const randomBytes = new Uint8Array(16);
          crypto.getRandomValues(randomBytes);
          const certHash = "0x" + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
          
          user.nfts.push({
            tokenId: `POAP-${eventId.substring(0,6)}-${timestamp.toString().slice(-4)}`,
            evento_nombre: event.name || `Ronda #${eventId.substring(0,6)}`,
            fecha: new Date().toLocaleDateString('es-CO'),
            image_url: '/assets/ronda-token-badge.png',
            proofHash: certHash,
            venue: event.venueName || 'CARONTE Gastrobar',
            issuedAt: timestamp
          });
          await this.saveUser(user);
        }
      } catch (userErr) {
        console.warn(`[DB] Error emitiendo certificado a ${uid}:`, userErr);
      }
    }
    
    return { event, matchesCount: matchResult.matchedPairsCount };
  }

  subscribeToEvent(eventId: string, callback: (data: RondaEvent) => void): Unsubscribe | Function {
    const docRef = doc(this._getFirestore(), 'events', eventId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as RondaEvent);
      }
    }, (error) => {
      console.error("Error en suscripción de Firestore:", error);
    });
    
    return unsubscribe;
  }

  // --- Venues (Red) ---
  async getVenues(): Promise<Venue[]> {
    try {
      const snap = await getDocs(collection(this._getFirestore(), 'venues'));
      return snap.docs.map(d => d.data() as Venue);
    } catch (e) {
      console.error("Error obteniendo venues:", e);
      return [];
    }
  }

  // --- Leads (CRM) ---
  async getLeads(salesUid?: string): Promise<Lead[]> {
    try {
      const snap = await getDocs(collection(this._getFirestore(), 'leads'));
      let leads = snap.docs.map(d => d.data() as Lead);
      if (salesUid) leads = leads.filter(l => l.sales_uid === salesUid);
      return leads;
    } catch (e) {
      console.error("Error obteniendo leads:", e);
      return [];
    }
  }

  async updateLeadStatus(leadId: string, status: 'lead' | 'negotiating' | 'signed'): Promise<void> {
    const docRef = doc(this._getFirestore(), 'leads', leadId);
    await setDoc(docRef, { status }, { merge: true });
  }

  // --- Waitlist (Lista de Espera) ---
  async saveWaitlistEntry(entry: { name: string; linkedin?: string; whatsapp: string; email: string; interestZone?: string; source?: string }): Promise<void> {
    const data = {
      ...entry,
      createdAt: new Date().toISOString()
    };
    try {
      const id = 'wl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const docRef = doc(this._getFirestore(), 'waitlist', id);
      await setDoc(docRef, data);
      console.log("[DB] Waitlist guardada exitosamente:", id);
    } catch (err) {
      console.error("[DB] Error al guardar en waitlist:", err);
      throw err;
    }
  }
}

export const DB = new DatabaseInterface();
