import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, getDocs, writeBatch, arrayUnion, Unsubscribe, serverTimestamp } from "firebase/firestore";
import { RondaServices } from "./firebase-config.js";
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
  faceVerified?: boolean;
  trustTier?: 0 | 1 | 2 | 3;
  verifications?: {
    identity?: {
      method: 'face_kyc' | 'linkedin_persona' | 'manual_admin';
      verifiedAt: string;
      confidenceScore?: number;
      reviewerUid?: string;
    };
    professional?: {
      method: 'linkedin_oauth' | 'corporate_email' | 'professional_card' | 'rut' | 'portfolio' | 'referral';
      verifiedAt: string;
      details?: {
        companyOrDomain?: string;
        sourceUrl?: string;
        referrerUid?: string;
      };
    };
  };
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
  /** Club Fundador 100 - insignia de los primeros 100 usuarios */
  isFoundingMember?: boolean;
  founderNumber?: number;
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

export type MilestoneState = 'not_eligible' | 'accrued' | 'review' | 'payable' | 'paid' | 'held' | 'void';

export interface Scout {
  uid: string;
  user_uid?: string;
  name?: string;
  email?: string;
  status: 'active' | 'inactive';
  identity_verified?: boolean;
  contract_id?: string;
  contract_version?: string;
  contract_signed_at?: string;
  tax_profile_id?: string;
  payout_account_ref?: string;
  conflict_declared_at?: string;
  tier?: 1 | 2 | 3;
  total_earnings_cop?: number;
  // Perfil fiscal (T1: persistencia para aprobación de desembolsos)
  rutVerified?: boolean;
  pilaVerified?: boolean;
  pilaPeriod?: string; // YYYY-MM en America/Bogota; si ≠ mes actual se trata como false
  tax_verified_by?: string;
  tax_verified_at?: string;
}

export interface Host {
  uid: string;
  user_uid?: string;
  name?: string;
  email?: string;
  status: 'active' | 'inactive';
  contract_id?: string;
  contract_version?: string;
  tax_profile_id?: string;
  payout_account_ref?: string;
  founder_mode?: boolean;
  frequency_review_flag?: boolean;
  total_earnings_cop?: number;
  // Perfil fiscal (T1: persistencia para aprobación de desembolsos)
  rutVerified?: boolean;
  pilaVerified?: boolean;
  pilaPeriod?: string; // YYYY-MM en America/Bogota; si ≠ mes actual se trata como false
  tax_verified_by?: string;
  tax_verified_at?: string;
}

export interface LedgerEntry {
  id: string;
  payee_uid: string;
  payee_type: 'scout' | 'host';
  venue_id?: string;
  lead_id?: string;
  event_id?: string;
  offer_id?: string;
  milestone: 'A' | 'B' | 'C' | 'residual' | 'tier_adjustment' | 'host_base' | 'host_bonus' | 'cancellation' | 'reversal';
  amount_gross_cop: number;
  withholding_cop?: number;
  applicable_invoice_tax_cop?: number;
  amount_net_cop?: number;
  status: MilestoneState;
  accrued_at: string;
  payable_after?: string;
  paid_at?: string;
  policy_version: string;
  idempotency_key: string;
  original_entry_id?: string;
  payout_id?: string;
  approved_by?: string;
  reason?: string;
  notes?: string;
}

export interface Payout {
  id: string;
  payee_uid: string;
  ledger_entry_ids: string[];
  gross_cop: number;
  withholding_cop?: number;
  net_cop: number;
  status: 'pending' | 'processing' | 'approved' | 'completed' | 'reconciled';
  approved_by?: string;
  transfer_reference?: string;
  reconciled_at?: string;
  bank_account_version?: string;
  createdAt: string;
}

export interface AuditLog {
  id?: string;
  actor_uid: string;
  actor_type: 'superadmin' | 'sales' | 'host' | 'scout' | 'system';
  entity_type: 'lead' | 'venue' | 'event' | 'ledger' | 'payout' | 'policy' | 'scout' | 'host' | 'invest_token';
  entity_id: string;
  action: string;
  previous_state?: any;
  new_state?: any;
  reason?: string;
  timestamp: string;
  correlation_id?: string;
}

export interface EventTicket {
  ticket_id: string;
  event_id: string;
  attendee_uid: string;
  purchaser_uid: string;
  transaction_id: string;
  payment_state: 'paid' | 'free' | 'refunded' | 'failed';
  refund_state?: 'none' | 'partial' | 'full';
  checked_in_at?: string;
  checked_in_by?: string;
  ip_address?: string;
  device_hash?: string;
}

export interface EventVerification {
  event_id: string;
  distinct_paid_checked_in_attendees: number;
  exclusions: string[];
  evidence_refs: string[];
  valid_for_scout: boolean;
  validation_status: 'pending' | 'verified' | 'rejected' | 'risk_review';
  verified_by?: string;
  verified_at?: string;
  review_deadline?: string;
  risk_review_id?: string;
}

export interface HostOffer {
  id: string;
  event_id: string;
  offered_rate_cop: number;
  accepted_rate_cop?: number;
  service_starts_at: string;
  service_ends_at: string;
  cancellation_policy_version: string;
  offer_status: 'offered' | 'accepted' | 'declined' | 'cancelled';
  accepted_host_uid?: string;
  accepted_at?: string;
  proposed_substitute_uid?: string;
  approved_substitute_uid?: string;
  rejection_reason?: string;
}

export interface HostReport {
  id: string;
  event_id: string;
  host_uid: string;
  checkin_evidence_ref?: string;
  service_completed: boolean;
  operational_report?: string;
  incident_refs?: string[];
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  zone: string;
  lat: number;
  lng: number;
  status: 'active' | 'inactive';
  nit?: string;
  branch_key?: string;
  normalized_address?: string;
  origin_scout_uid?: string;
  affiliation_status?: 'registered' | 'qualified' | 'signed' | 'verified' | 'first_event_completed' | 'active' | 'inactive' | 'terminated';
  agreed_weekdays?: string[];
  bar_package_price_cop?: number;
  bar_price_tax_included?: boolean;
  included_consumptions?: number;
  contract_id?: string;
  territorial_terms?: string;
  termination_at?: string;
  termination_reason?: string;
}

export interface Lead {
  id: string;
  name: string;
  contactName: string;
  status: 'lead' | 'negotiating' | 'signed';
  sales_uid: string; // Propietario comercial original (se mantiene para retrocompatibilidad)
  scout_uid?: string; // Mapeo explícito para B2B Scout
  venue_id?: string;
  attribution_status?: 'assigned' | 'verified' | 'disputed';
  commission: number;
  phone?: string;
  zone?: string;
  notes?: string;
  tablesCount?: number;
  preferredDay?: 'martes' | 'miércoles' | 'jueves';
  venueId?: string;
  createdAt?: string;
  registered_at?: string;
  signed_at?: string;
  verified_at?: string;
  first_valid_event_at?: string;
  activation_month?: string; // Formato YYYY-MM en America/Bogota
  policy_version?: string;
  cohort_tier?: 1 | 2 | 3;
  retention_review_at?: string;
  retention_window_ends_at?: string;
  valid_event_count?: number;
  residual_accrued_count?: number;
  milestone_status?: {
    A: MilestoneState;
    B: MilestoneState;
    C: MilestoneState;
  };
  risk_review_id?: string;
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

  async countUsers(): Promise<number> {
    try {
      const snap = await getDocs(collection(this._getFirestore(), 'users'));
      return snap.docs.length;
    } catch (err) {
      console.error('[DB] Error contando usuarios:', err);
      return 0;
    }
  }

  // --- Eventos / Salas ---
  async getEvent(eventId: string): Promise<RondaEvent | null> {
    const docRef = doc(this._getFirestore(), 'events', eventId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as RondaEvent) : null;
  }
  
  async saveEvent(event: RondaEvent): Promise<RondaEvent> {
    const docRef = doc(this._getFirestore(), 'events', event.id);
    await setDoc(docRef, event, { merge: true });
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

  // Registra el voto/like de un participante hacia otro.
  // Escribe en events/{eventId}/likes/{fromUid}_{toUid}: el prefijo del id
  // coincide con request.auth.uid, tal y como exigen las reglas de Firestore
  // (cada usuario escribe únicamente su propio like) y como leen tanto el
  // serverless process-matches como el fallback local ($0).
  async pushLike(eventId: string, fromUid: string, toUid: string, isYes: boolean): Promise<void> {
    const likeId = `${fromUid}_${toUid}`;
    const ref = doc(this._getFirestore(), 'events', eventId, 'likes', likeId);
    await setDoc(ref, { from: fromUid, to: toUid, like: isYes }, { merge: true });
  }

  async processEventMatches(eventId: string): Promise<{ matchedPairsCount: number }> {
    console.log(`[DB] Calculando matches mutuos para el evento: ${eventId}...`);
    
    // 1. Intentar delegar al backend (Vercel API) por seguridad si está configurado
    if ((import.meta as any).env?.VITE_VERCEL_API_URL) {
      try {
        const { API } = await import('./api-client.js');
        if (API.isConfigured) {
          console.log('[DB] Ejecutando processEventMatches via Vercel Serverless API...');
          const result = await API.post<{ matchedPairsCount: number }>('/api/process-matches', { eventId });
          console.log(`[DB] Matches calculados en servidor: ${result.matchedPairsCount}`);
          return result;
        }
      } catch (err) {
        console.warn("[DB] Falló llamada a Vercel API para matches, usando fallback local:", err);
      }
    }

    // 2. Fallback: Procesamiento local en cliente ($0 sin Cloud Functions, fallback robusto)
    console.log(`[DB] Usando fallback local ($0) para calcular matches...`);
    try {
      const fs = this._getFirestore();
      const likesCol = collection(fs, 'events', eventId, 'likes');
      const likesSnap = await getDocs(likesCol);
      
      // PROTECCIÓN DE BANDA ANCHA (Spark Tier): Evita procesar cientos de miles de docs en local.
      if (likesSnap.size > 500) {
        throw new Error('Demasiados likes para procesar en cliente (Fallback local abortado para proteger ancho de banda). Por favor, contacta a soporte o revisa el estado de Vercel API.');
      }
      
      const likesList: { id?: string; from: string; to: string; like: boolean }[] = [];
      
      likesSnap.forEach(snap => {
        const d = snap.data();
        if (d && d.to) {
          // SEGURIDAD: se pasa el `id` del documento (prefijo {uid}_{target}
          // autenticado por Firestore). El `from` NO se deriva de `d.from` (
          // controlado por el emisor, spoofeable).
          likesList.push({ id: snap.id, from: d.from, to: d.to, like: Boolean(d.like) });
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
      console.error("[DB] Error procesando matches mutuos en fallback:", err);
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

    // 2. Certificados Digitales Proof-of-Attendance
    // SEGURIDAD: la emisión de NFTs se eliminó de este flujo de cliente. Generar
    // aquí un `proofHash` aleatorio y empujarlo al array `nfts` permitía forjar
    // prueba de asistencia sin pasar por el mint de servidor (saludable/verificable).
    // La emisión real se hace únicamente vía la API serverless `POST /api/mint-nft`
    // (requiere rol admin + firma on-chain). Además, las reglas de Firestore
    // (`clientTouchedSensitive`) ya impiden que un cliente modifique su campo `nfts`.

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

  // Conversión Lead -> Venue oficial (Tarea 3 CRM). Requiere permiso de escritura
  // en `venues` (superadmin según firestore.rules).
  async saveVenue(venue: Venue): Promise<void> {
    const docRef = doc(this._getFirestore(), 'venues', venue.id);
    await setDoc(docRef, venue);
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

  async saveLead(lead: Lead): Promise<void> {
    const docRef = doc(this._getFirestore(), 'leads', lead.id);
    await setDoc(docRef, lead);
  }

  async deleteLead(leadId: string): Promise<void> {
    const docRef = doc(this._getFirestore(), 'leads', leadId);
    await deleteDoc(docRef);
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

  // --- B2B Scouts & Hosters (Módulo Operativo) ---
  async getScout(uid: string): Promise<Scout | null> {
    const docRef = doc(this._getFirestore(), 'scouts', uid);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as Scout) : null;
  }

  async getScouts(): Promise<Scout[]> {
    try {
      const snap = await getDocs(collection(this._getFirestore(), 'scouts'));
      return snap.docs.map(d => d.data() as Scout);
    } catch (err) {
      console.error("[DB] Error obteniendo scouts:", err);
      return [];
    }
  }

  async getHosts(): Promise<Host[]> {
    try {
      const snap = await getDocs(collection(this._getFirestore(), 'hosts'));
      return snap.docs.map(d => d.data() as Host);
    } catch (err) {
      console.error("[DB] Error obteniendo hosts:", err);
      return [];
    }
  }

  async saveScout(scout: Scout): Promise<void> {
    const docRef = doc(this._getFirestore(), 'scouts', scout.uid);
    await setDoc(docRef, cleanFirestoreData(scout), { merge: true });
  }

  async getHost(uid: string): Promise<Host | null> {
    const docRef = doc(this._getFirestore(), 'hosts', uid);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as Host) : null;
  }

  async saveHost(host: Host): Promise<void> {
    const docRef = doc(this._getFirestore(), 'hosts', host.uid);
    await setDoc(docRef, cleanFirestoreData(host), { merge: true });
  }

  async getLedgerEntries(payeeUid?: string): Promise<LedgerEntry[]> {
    try {
      const colRef = collection(this._getFirestore(), 'commission_ledger');
      const snap = await getDocs(colRef);
      let entries = snap.docs.map(d => d.data() as LedgerEntry);
      if (payeeUid) entries = entries.filter(e => e.payee_uid === payeeUid);
      return entries;
    } catch (err) {
      console.error("[DB] Error obteniendo commission_ledger:", err);
      return [];
    }
  }

  async saveLedgerEntry(entry: LedgerEntry): Promise<void> {
    const docRef = doc(this._getFirestore(), 'commission_ledger', entry.id);
    await setDoc(docRef, cleanFirestoreData(entry), { merge: true });
  }

  async getPayouts(payeeUid?: string): Promise<Payout[]> {
    try {
      const colRef = collection(this._getFirestore(), 'payouts');
      const snap = await getDocs(colRef);
      let payouts = snap.docs.map(d => d.data() as Payout);
      if (payeeUid) payouts = payouts.filter(p => p.payee_uid === payeeUid);
      return payouts;
    } catch (err) {
      console.error("[DB] Error obteniendo payouts:", err);
      return [];
    }
  }

  async savePayout(payout: Payout): Promise<void> {
    const docRef = doc(this._getFirestore(), 'payouts', payout.id);
    await setDoc(docRef, cleanFirestoreData(payout), { merge: true });
  }

  async logAudit(log: AuditLog): Promise<void> {
    try {
      const id = log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const docRef = doc(this._getFirestore(), 'audit_logs', id);
      await setDoc(docRef, { ...log, id, timestamp: log.timestamp || new Date().toISOString() });
    } catch (err) {
      console.warn("[DB] Error escribiendo audit_log:", err);
    }
  }

  async getHostOffers(hostUid?: string): Promise<HostOffer[]> {
    try {
      const colRef = collection(this._getFirestore(), 'host_offers');
      const snap = await getDocs(colRef);
      let offers = snap.docs.map(d => d.data() as HostOffer);
      if (hostUid) offers = offers.filter(o => o.accepted_host_uid === hostUid || o.offer_status === 'offered');
      return offers;
    } catch (err) {
      console.error("[DB] Error obteniendo host_offers:", err);
      return [];
    }
  }

  async saveHostOffer(offer: HostOffer): Promise<void> {
    const docRef = doc(this._getFirestore(), 'host_offers', offer.id);
    await setDoc(docRef, cleanFirestoreData(offer), { merge: true });
  }

  // =========================================================================
  // T-11.4: Supresión de cuenta y datos personales (Ley 1581 de 2012)
  // =========================================================================
  async deleteUserAccount(userId: string, surveyData?: { reason?: string; feedback?: string }): Promise<void> {
    // 1. Guardar encuesta de salida anonimizada (sin ID de usuario ni correo)
    if (surveyData?.reason || surveyData?.feedback) {
      try {
        const surveyRef = doc(collection(this._getFirestore(), 'churn_surveys'));
        await setDoc(surveyRef, {
          reason: surveyData.reason || null,
          feedback: surveyData.feedback || null,
          createdAt: serverTimestamp()
        });
        console.log('[DB] Encuesta de salida guardada (anonimizada) en churn_surveys');
      } catch (err) {
        console.warn('[DB] No se pudo guardar encuesta de salida:', err);
      }
    }

    // 2. Eliminar el documento del usuario en Firestore
    try {
      await deleteDoc(doc(this._getFirestore(), 'users', userId));
      console.log('[DB] Documento de usuario eliminado de Firestore:', userId);
    } catch (err) {
      console.error('[DB] Error eliminando documento de usuario:', err);
      throw err;
    }

    // 3. Purgar credenciales y cachés locales
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      // localforage puede estar disponible globalmente o vía import dinámica
      try {
        const lf = await import('localforage');
        if (lf && typeof lf.clear === 'function') {
          await lf.clear();
          console.log('[DB] Caché localforage purgada');
        }
      } catch (e) {
        console.warn('[DB] localforage no disponible para purga:', e);
      }
    } catch (err) {
      console.warn('[DB] Error purgando cachés locales:', err);
    }

    // 4. Eliminar el usuario en Firebase Authentication
    try {
      const { Auth } = await import('./auth.js');
      const fbUser = Auth['currentUser'] as any;
      if (fbUser && typeof fbUser.delete === 'function') {
        await fbUser.delete();
        console.log('[DB] Usuario eliminado de Firebase Auth');
      } else {
        // Si no se puede eliminar el token (requiere re-autenticación), cerrar sesión
        await Auth.logout();
        console.warn('[DB] No se pudo eliminar usuario de Auth (token expirado), sesión cerrada');
      }
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        try {
          const { Auth } = await import('./auth.js');
          await Auth.logout();
        } catch {}
        console.warn('[DB] Token expirado, sesión cerrada. Usuario debe re-autenticar para completar la baja.');
      } else {
        console.error('[DB] Error eliminando usuario de Firebase Auth:', err);
      }
    }
  }
}

export const DB = new DatabaseInterface();
