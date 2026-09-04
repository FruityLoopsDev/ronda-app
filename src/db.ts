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
  paymentPending?: boolean;  // Pago Nequi realizado, pendiente de verificación manual del anfitrión
  paymentMethod?: string;    // 'nequi'
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
  isDemo: boolean;
  memoryDb: {
    users: Record<string, User>;
    events: Record<string, RondaEvent>;
    venues: Record<string, Venue>;
    leads: Record<string, Lead>;
  };

  constructor() {
    this.isDemo = RondaConfig.isDemo;
    this.memoryDb = {
      users: {},
      events: {},
      venues: {
        'v1': { id: 'v1', name: 'CARONTE Cocktail Bar', address: 'Cra. 4A #66-22', zone: 'Zona G', lat: 4.6543, lng: -74.0567, status: 'active' },
        'v2': { id: 'v2', name: 'La María Quinta Camacho', address: 'Calle 70A #9-44', zone: 'Quinta Camacho', lat: 4.6565, lng: -74.0592, status: 'active' }
      },
      leads: {
        'l1': { id: 'l1', name: 'Patio Poca Prisa', contactName: 'Carlos M.', status: 'negotiating', sales_uid: 'sales1', commission: 500000 },
        'l2': { id: 'l2', name: 'Bar Enigma', contactName: 'Luis F.', status: 'lead', sales_uid: 'sales1', commission: 500000 }
      }
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
    const sanitized = cleanFirestoreData(user);
    await setDoc(docRef, sanitized, { merge: true });
    return user;
  }

  // --- Eventos / Salas ---
  async getEvent(eventId: string): Promise<RondaEvent | null> {
    if (this.isDemo) {
      return this.memoryDb.events[eventId] || null;
    }
    const docRef = doc(this._getFirestore(), 'events', eventId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as RondaEvent) : null;
  }
  
  async saveEvent(event: RondaEvent): Promise<RondaEvent> {
    if (this.isDemo) {
      this.memoryDb.events[event.id] = event;
      return event;
    }
    const docRef = doc(this._getFirestore(), 'events', event.id);
    await setDoc(docRef, event as any, { merge: true });
    return event;
  }

  async joinEvent(eventId: string, userId: string): Promise<RondaEvent> {
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

  async processEventMatches(eventId: string): Promise<{ matchedPairsCount: number }> {
    console.log(`[DB] Calculando matches mutuos para el evento: ${eventId} ($0 - Consola Host)...`);
    if (this.isDemo) {
      const participants = Object.values(this.memoryDb.users).filter(u => u.activeEventId === eventId);
      const mutual = Matches.calculateMutualMatches(participants);
      for (const m of mutual) {
        if (this.memoryDb.users[m.u1]) {
          this.memoryDb.users[m.u1].matches = this.memoryDb.users[m.u1].matches || [];
          if (!this.memoryDb.users[m.u1].matches.includes(m.u2)) this.memoryDb.users[m.u1].matches.push(m.u2);
        }
        if (this.memoryDb.users[m.u2]) {
          this.memoryDb.users[m.u2].matches = this.memoryDb.users[m.u2].matches || [];
          if (!this.memoryDb.users[m.u2].matches.includes(m.u1)) this.memoryDb.users[m.u2].matches.push(m.u1);
        }
      }
      return { matchedPairsCount: mutual.length };
    }

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
        callback(docSnap.data() as RondaEvent);
      }
    }, (error) => {
      console.error("Error en suscripción de Firestore:", error);
    });
    
    return unsubscribe;
  }

  // --- Venues (Red) ---
  async getVenues(): Promise<Venue[]> {
    if (this.isDemo) {
      return Object.values(this.memoryDb.venues);
    }
    // In a real app we would use getDocs(collection(db, 'venues'))
    return [];
  }

  // --- Leads (CRM) ---
  async getLeads(salesUid?: string): Promise<Lead[]> {
    if (this.isDemo) {
      let leads = Object.values(this.memoryDb.leads);
      if (salesUid) leads = leads.filter(l => l.sales_uid === salesUid);
      return leads;
    }
    return [];
  }

  async updateLeadStatus(leadId: string, status: 'lead' | 'negotiating' | 'signed'): Promise<void> {
    if (this.isDemo) {
      if (this.memoryDb.leads[leadId]) {
        this.memoryDb.leads[leadId].status = status;
      }
      return;
    }
    const docRef = doc(this._getFirestore(), 'leads', leadId);
    // setDoc or updateDoc in prod
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
