/**
 * RONDA B2B — Motor Operativo y de Liquidación para Scouts y Hosters
 * Basado en: Brief Final para Antigravity (v5.0 Consolidada)
 * 
 * Reglas deterministas, antifraude, idempotencia estricta y modo de simulación/prueba.
 */

import type {
  ScoutPolicy,
  HostPolicy,
  EconomicsConfig
} from './config/b2b-policies.ts';
import {
  DEFAULT_SCOUT_POLICY,
  DEFAULT_HOST_POLICY,
  DEFAULT_ECONOMICS
} from './config/b2b-policies.ts';
import type {
  Lead,
  Venue,
  LedgerEntry,
  Payout,
  AuditLog,
  EventTicket,
  EventVerification,
  HostOffer
} from './db.ts';

export interface VerificationResult {
  success: boolean;
  ledgerEntries: LedgerEntry[];
  leadUpdates?: Partial<Lead>;
  venueUpdates?: Partial<Venue>;
  auditLog?: AuditLog;
  reason?: string;
}

export class RondaB2BEngine {
  private scoutPolicy: ScoutPolicy;
  private hostPolicy: HostPolicy;
  private economics: EconomicsConfig;

  constructor(
    scoutPolicy: ScoutPolicy = DEFAULT_SCOUT_POLICY,
    hostPolicy: HostPolicy = DEFAULT_HOST_POLICY,
    economics: EconomicsConfig = DEFAULT_ECONOMICS
  ) {
    this.scoutPolicy = scoutPolicy;
    this.hostPolicy = hostPolicy;
    this.economics = economics;
  }

  // --- Utilidad de Fechas y Zona Horaria (America/Bogota) ---
  getLocalWeekdayAndDate(isoDateString: string): { weekday: string; dateBogota: string; yearMonth: string } {
    const d = new Date(isoDateString);
    // Formatear en America/Bogota
    const bogotaDateStr = d.toLocaleDateString('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
    const bogotaDayStr = d.toLocaleDateString('en-US', { timeZone: 'America/Bogota', weekday: 'short' }).toLowerCase();
    
    // Convertir 'mm/dd/yyyy' a 'yyyy-mm-dd'
    const parts = bogotaDateStr.split('/');
    const dateBogota = `${parts[2]}-${parts[0]}-${parts[1]}`;
    const yearMonth = `${parts[2]}-${parts[0]}`;

    // Normalizar día
    const dayMap: Record<string, string> = {
      'tue': 'tue', 'tuesday': 'tue', 'martes': 'tue',
      'wed': 'wed', 'wednesday': 'wed', 'miércoles': 'wed', 'miercoles': 'wed',
      'thu': 'thu', 'thursday': 'thu', 'jueves': 'thu',
      'fri': 'fri', 'friday': 'fri', 'viernes': 'fri',
      'mon': 'mon', 'monday': 'mon', 'lunes': 'mon',
      'sat': 'sat', 'saturday': 'sat', 'sábado': 'sat', 'sabado': 'sat',
      'sun': 'sun', 'sunday': 'sun', 'domingo': 'sun'
    };

    return {
      weekday: dayMap[bogotaDayStr] || bogotaDayStr,
      dateBogota,
      yearMonth
    };
  }

  // Obtener identificador de semana ISO local (Lunes a Domingo en America/Bogota)
  getBogotaWeekKey(isoDateString: string): string {
    const d = new Date(isoDateString);
    const date = new Date(d.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    date.setHours(0, 0, 0, 0);
    // Jueves de la semana determina la semana ISO
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${date.getFullYear()}-W${weekNum < 10 ? '0' : ''}${weekNum}`;
  }

  // --- 1. verifyVenue: Verificación independiente y provisión Hito A ---
  verifyVenue(
    lead: Lead,
    venueData: Partial<Venue>,
    verifierUid: string,
    options: { independentVerificationPassed: boolean; authorizedSignature: boolean }
  ): VerificationResult {
    if (!options.independentVerificationPassed || !options.authorizedSignature) {
      return {
        success: false,
        ledgerEntries: [],
        reason: 'Verificación rechazada: se requiere verificación independiente de operaciones y firma autorizada.'
      };
    }

    // Validar tope de paquete de barra acordado (máximo 22.500 COP según confirmación del fundador)
    const packagePrice = venueData.bar_package_price_cop ?? lead.commission ?? 22500;
    if (packagePrice > this.economics.bar_package_cap_cop) {
      return {
        success: false,
        ledgerEntries: [],
        reason: `Tarifa de barra excede el tope confirmado de $${this.economics.bar_package_cap_cop} COP.`
      };
    }

    const now = new Date().toISOString();
    const scoutUid = lead.scout_uid || lead.sales_uid;
    const idempotencyKey = `A_${lead.id}`;

    const entry: LedgerEntry = {
      id: `ledg_${idempotencyKey}`,
      payee_uid: scoutUid,
      payee_type: 'scout',
      venue_id: lead.venue_id || lead.venueId,
      lead_id: lead.id,
      milestone: 'A',
      amount_gross_cop: this.scoutPolicy.hit_a_cop, // 100.000 COP
      status: 'accrued',
      accrued_at: now,
      policy_version: this.scoutPolicy.version,
      idempotency_key: idempotencyKey,
      approved_by: verifierUid,
      reason: 'Hito A: Afiliación y verificación independiente del establecimiento'
    };

    const leadUpdates: Partial<Lead> = {
      status: 'signed',
      attribution_status: 'verified',
      verified_at: now,
      signed_at: lead.signed_at || now,
      policy_version: this.scoutPolicy.version,
      milestone_status: {
        A: 'accrued',
        B: lead.milestone_status?.B || 'not_eligible',
        C: lead.milestone_status?.C || 'not_eligible'
      }
    };

    const venueUpdates: Partial<Venue> = {
      affiliation_status: 'verified',
      origin_scout_uid: scoutUid,
      bar_package_price_cop: packagePrice,
      bar_price_tax_included: true
    };

    const auditLog: AuditLog = {
      actor_uid: verifierUid,
      actor_type: 'superadmin',
      entity_type: 'lead',
      entity_id: lead.id,
      action: 'VERIFY_VENUE_HIT_A',
      new_state: { milestone_A: 'accrued', amount: entry.amount_gross_cop },
      reason: 'Firma y verificación independiente aprobadas',
      timestamp: now
    };

    return {
      success: true,
      ledgerEntries: [entry],
      leadUpdates,
      venueUpdates,
      auditLog
    };
  }

  // --- 2. reconcilePayment: Conciliación de Webhook, Compras Grupales y Reembolsos ---
  reconcilePayment(ticketsPurchased: {
    transactionId: string;
    purchaserUid: string;
    tickets: Array<{ attendeeUid: string; ticketId: string; paymentState: 'paid' | 'free' | 'refunded' | 'failed' }>;
    ipAddress?: string;
    deviceHash?: string;
    paidAmountCop: number;
    eventId: string;
  }): {
    validTickets: EventTicket[];
    requiresReview: boolean;
    reviewReasons: string[];
  } {
    const validTickets: EventTicket[] = [];
    const reviewReasons: string[] = [];

    // Compras grupales: una sola transacción puede tener múltiples asistentes distintos con derecho de entrada
    const distinctAttendees = new Set<string>();

    for (const t of ticketsPurchased.tickets) {
      if (t.paymentState !== 'paid') {
        reviewReasons.push(`Ticket ${t.ticketId} no es pagado (Estado: ${t.paymentState}).`);
        continue;
      }

      if (distinctAttendees.has(t.attendeeUid)) {
        reviewReasons.push(`Attendee duplicado en la misma orden: ${t.attendeeUid}.`);
        continue;
      }

      distinctAttendees.add(t.attendeeUid);
      validTickets.push({
        ticket_id: t.ticketId,
        event_id: ticketsPurchased.eventId,
        attendee_uid: t.attendeeUid,
        purchaser_uid: ticketsPurchased.purchaserUid,
        transaction_id: ticketsPurchased.transactionId,
        payment_state: 'paid',
        ip_address: ticketsPurchased.ipAddress,
        device_hash: ticketsPurchased.deviceHash
      });
    }

    return {
      validTickets,
      requiresReview: reviewReasons.length > 0,
      reviewReasons
    };
  }

  // --- 3. verifyCompletedEvent: Validación de aforo real, Hito B y Honorarios Hoster ---
  verifyCompletedEvent(
    event: {
      id: string;
      venue_id: string;
      scheduled_at: string;
      host_uid?: string;
      founder_mode?: boolean;
    },
    lead: Lead,
    checkins: EventTicket[],
    verifierUid: string,
    existingLedgerKeys: Set<string>
  ): VerificationResult {
    const now = new Date().toISOString();
    const ledgerEntries: LedgerEntry[] = [];
    const auditLogs: AuditLog[] = [];

    // Validar día operativo (Martes, Miércoles o Jueves en America/Bogota)
    const { weekday, yearMonth } = this.getLocalWeekdayAndDate(event.scheduled_at);
    const isOperationalDay = this.economics.operational_weekdays.includes(weekday);

    // Contar personas distintas con ticket pagado y check-in único
    // Criterio 2: Comprador sin check-in no cuenta; persona con entrada gratuita no cuenta.
    const paidCheckedInAttendees = new Set<string>();
    const sharedIps = new Map<string, number>();

    for (const ticket of checkins) {
      if (ticket.payment_state === 'paid' && ticket.checked_in_at) {
        paidCheckedInAttendees.add(ticket.attendee_uid);
        if (ticket.ip_address) {
          sharedIps.set(ticket.ip_address, (sharedIps.get(ticket.ip_address) || 0) + 1);
        }
      }
    }

    const attendanceCount = paidCheckedInAttendees.size;
    const scoutUid = lead.scout_uid || lead.sales_uid;

    // --- LIQUIDACIÓN HOSTER (CONFIRMADO: COP 250.000 brutos por evento de 3 horas) ---
    // Regla de Oro: El honorario del Hoster NO depende del aforo mínimo del Scout.
    // Un Hoster que cumplió su servicio no pierde honorarios porque RONDA vendió pocos tickets.
    if (event.host_uid) {
      const hostKey = `host_base_${event.id}_${event.host_uid}`;
      if (!existingLedgerKeys.has(hostKey)) {
        if (event.founder_mode) {
          // Evento del fundador: Caja 0, costo de reemplazo analítico 250.000, no transferir al fundador
          ledgerEntries.push({
            id: `ledg_${hostKey}`,
            payee_uid: event.host_uid,
            payee_type: 'host',
            event_id: event.id,
            venue_id: event.venue_id,
            milestone: 'host_base',
            amount_gross_cop: 0, // Transferible 0
            status: 'void',
            accrued_at: now,
            policy_version: this.hostPolicy.version,
            idempotency_key: hostKey,
            reason: 'Evento del Fundador: Costo analítico de reemplazo $250.000 COP, transferencia externa $0 COP'
          });
        } else {
          ledgerEntries.push({
            id: `ledg_${hostKey}`,
            payee_uid: event.host_uid,
            payee_type: 'host',
            event_id: event.id,
            venue_id: event.venue_id,
            milestone: 'host_base',
            amount_gross_cop: this.hostPolicy.default_fee_cop, // 250.000 COP
            status: 'payable',
            accrued_at: now,
            policy_version: this.hostPolicy.version,
            idempotency_key: hostKey,
            approved_by: verifierUid,
            reason: 'Honorarios base Hoster por conducción y cierre de evento (3 horas)'
          });
        }
      }
    }

    // --- LIQUIDACIÓN SCOUT: HITO B ---
    // Requiere: Día operativo válido + al menos 16 asistentes pagados con check-in único
    const hitBKey = `B_${lead.id}`;
    let leadUpdates: Partial<Lead> = {};

    if (!isOperationalDay) {
      return {
        success: false,
        ledgerEntries,
        reason: `Evento en día no operativo (${weekday}). Válidos: martes, miércoles y jueves (America/Bogota).`
      };
    }

    // Si cumple >= 16 asistentes y aún no se ha causado el Hito B
    if (attendanceCount >= this.scoutPolicy.min_attendance_hit_b) {
      if (!existingLedgerKeys.has(hitBKey) && (!lead.milestone_status?.B || lead.milestone_status.B === 'not_eligible')) {
        const hitBEntry: LedgerEntry = {
          id: `ledg_${hitBKey}`,
          payee_uid: scoutUid,
          payee_type: 'scout',
          lead_id: lead.id,
          venue_id: event.venue_id,
          event_id: event.id,
          milestone: 'B',
          amount_gross_cop: this.scoutPolicy.hit_b_cop, // 250.000 COP
          status: 'accrued',
          accrued_at: now,
          // Revisión de fraude de 7 días antes de marcar 'payable'
          payable_after: new Date(Date.now() + this.scoutPolicy.b_review_days * 86400000).toISOString(),
          policy_version: this.scoutPolicy.version,
          idempotency_key: hitBKey,
          approved_by: verifierUid,
          reason: `Hito B: Activación del bar con ${attendanceCount} asistentes pagados y presentes.`
        };

        ledgerEntries.push(hitBEntry);

        leadUpdates = {
          first_valid_event_at: event.scheduled_at,
          activation_month: yearMonth,
          valid_event_count: (lead.valid_event_count || 0) + 1,
          milestone_status: {
            A: lead.milestone_status?.A || 'accrued',
            B: 'accrued',
            C: lead.milestone_status?.C || 'not_eligible'
          }
        };
      } else {
        // Evento posterior a la primera activación: cuenta para retención y residual semanal
        leadUpdates = {
          valid_event_count: (lead.valid_event_count || 0) + 1
        };
      }
    } else {
      // Menos de 16 asistentes: No activa Hito B para el Scout
      return {
        success: false,
        ledgerEntries, // Entrega el honorario del Hoster si corresponde
        reason: `Aforo insuficiente para activación de Scout (${attendanceCount}/16). Hito B no activado.`
      };
    }

    return {
      success: true,
      ledgerEntries,
      leadUpdates
    };
  }

  // --- 4. evaluateRetention: Evaluación Hito C a los 90 días ---
  evaluateRetention(
    lead: Lead,
    evaluationDateIso: string,
    validEventsCount: number,
    isVenueActive: boolean,
    hasOpenRiskReview: boolean
  ): VerificationResult {
    const hitCKey = `C_${lead.id}`;
    if (!lead.signed_at && !lead.verified_at) {
      return { success: false, ledgerEntries: [], reason: 'Lead sin fecha de inicio para calcular retención.' };
    }

    const startDate = new Date(lead.verified_at || lead.signed_at!);
    const evalDate = new Date(evaluationDateIso);
    const diffDays = Math.floor((evalDate.getTime() - startDate.getTime()) / (86400000));

    // Criterio 8: C antes del día 90 no es pagadero
    if (diffDays < this.scoutPolicy.retention_days_hit_c) {
      return {
        success: false,
        ledgerEntries: [],
        reason: `Ventana de retención en progreso (${diffDays}/90 días). Hito C se evalúa únicamente a partir del día 90.`
      };
    }

    // Evaluación al día 90+: requiere bar activo, >= 8 eventos válidos y sin revisión de riesgo abierta
    if (!isVenueActive) {
      return { success: false, ledgerEntries: [], reason: 'Bar no se encuentra activo al corte de 90 días.' };
    }

    if (hasOpenRiskReview) {
      return { success: false, ledgerEntries: [], reason: 'Bar tiene una revisión de fraude/riesgo abierta. Evaluación en retención.' };
    }

    if (validEventsCount < this.scoutPolicy.min_retention_events_hit_c) {
      return {
        success: false,
        ledgerEntries: [],
        reason: `Eventos válidos insuficientes (${validEventsCount}/${this.scoutPolicy.min_retention_events_hit_c}). Hito C no devengado.`
      };
    }

    const now = new Date().toISOString();
    const scoutUid = lead.scout_uid || lead.sales_uid;

    const hitCEntry: LedgerEntry = {
      id: `ledg_${hitCKey}`,
      payee_uid: scoutUid,
      payee_type: 'scout',
      lead_id: lead.id,
      venue_id: lead.venue_id || lead.venueId,
      milestone: 'C',
      amount_gross_cop: this.scoutPolicy.hit_c_cop, // 100.000 COP
      status: 'payable',
      accrued_at: now,
      policy_version: this.scoutPolicy.version,
      idempotency_key: hitCKey,
      reason: `Hito C: Retención a 90 días cumplida con ${validEventsCount} eventos válidos ejecutados.`
    };

    const leadUpdates: Partial<Lead> = {
      retention_review_at: now,
      milestone_status: {
        A: lead.milestone_status?.A || 'accrued',
        B: lead.milestone_status?.B || 'accrued',
        C: 'payable'
      }
    };

    return {
      success: true,
      ledgerEntries: [hitCEntry],
      leadUpdates
    };
  }

  // --- 5. closeWeeklyResiduals: Residual determinista semanal (Tope 12, máx 1/sem, ventana 6 meses) ---
  closeWeeklyResiduals(
    venueId: string,
    lead: Lead,
    eventsInWeek: Array<{ id: string; scheduled_at: string; attendance: number; isFirstActivationEvent: boolean }>,
    existingLedgerKeys: Set<string>
  ): VerificationResult {
    // Si el lead no tiene activación previa, no aplica residual
    if (!lead.first_valid_event_at) {
      return { success: false, ledgerEntries: [], reason: 'El bar aún no ha tenido su primer evento válido de activación.' };
    }

    const firstEventDate = new Date(lead.first_valid_event_at);
    const windowEnd = new Date(firstEventDate);
    windowEnd.setMonth(windowEnd.getMonth() + this.scoutPolicy.residual_window_months); // 6 meses

    // Filtrar eventos de la semana elegibles:
    // 1. No es el primer evento de activación (Regla 6: el primer evento NO paga residual)
    // 2. Ocurre dentro de los 6 meses desde activación
    // 3. Martes, miércoles o jueves local
    const eligibleEvents = eventsInWeek.filter(ev => {
      if (ev.isFirstActivationEvent) return false;
      const evDate = new Date(ev.scheduled_at);
      if (evDate > windowEnd) return false;
      const { weekday } = this.getLocalWeekdayAndDate(ev.scheduled_at);
      return this.economics.operational_weekdays.includes(weekday) && ev.attendance >= 10;
    });

    if (eligibleEvents.length === 0) {
      return { success: false, ledgerEntries: [], reason: 'No hay eventos elegibles para residual en esta semana.' };
    }

    // Ordenar cronológicamente y seleccionar determinísticamente el PRIMERO de la semana (Regla 7)
    eligibleEvents.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    const selectedEvent = eligibleEvents[0];

    const weekKey = this.getBogotaWeekKey(selectedEvent.scheduled_at);
    const idempotencyKey = `residual_${venueId}_${weekKey}`;

    // Validar idempotencia semanal
    if (existingLedgerKeys.has(idempotencyKey)) {
      return { success: false, ledgerEntries: [], reason: `Residual ya causado para la semana ${weekKey}.` };
    }

    // Validar tope de 12 residuales
    const currentResidualCount = lead.residual_accrued_count || 0;
    if (currentResidualCount >= this.scoutPolicy.residual_limit) {
      return { success: false, ledgerEntries: [], reason: `Límite máximo de ${this.scoutPolicy.residual_limit} residuales alcanzado.` };
    }

    const now = new Date().toISOString();
    const scoutUid = lead.scout_uid || lead.sales_uid;
    const residualAmount = (lead.cohort_tier === 3) ? this.scoutPolicy.tier3_residual_cop : this.scoutPolicy.residual_standard_cop;

    const entry: LedgerEntry = {
      id: `ledg_${idempotencyKey}`,
      payee_uid: scoutUid,
      payee_type: 'scout',
      venue_id: venueId,
      lead_id: lead.id,
      event_id: selectedEvent.id,
      milestone: 'residual',
      amount_gross_cop: residualAmount,
      status: 'accrued',
      accrued_at: now,
      policy_version: this.scoutPolicy.version,
      idempotency_key: idempotencyKey,
      reason: `Residual semanal (${weekKey}): Evento del ${selectedEvent.scheduled_at}`
    };

    return {
      success: true,
      ledgerEntries: [entry],
      leadUpdates: {
        residual_accrued_count: currentResidualCount + 1
      }
    };
  }

  // --- 6. closeMonthlyCohorts: Tiers de Aceleración y Diferenciales ---
  closeMonthlyCohorts(
    scoutUid: string,
    monthKey: string, // YYYY-MM
    activatedLeadsInMonth: Lead[],
    existingAdjustments: Set<string>
  ): VerificationResult {
    const barCount = activatedLeadsInMonth.length;
    let cohortTier: 1 | 2 | 3 = 1;

    if (barCount >= this.scoutPolicy.tier_threshold_3) {
      cohortTier = 3; // 7+ bares
    } else if (barCount >= this.scoutPolicy.tier_threshold_2) {
      cohortTier = 2; // 4-6 bares
    }

    if (cohortTier === 1) {
      return { success: true, ledgerEntries: [], reason: 'Tier 1 alcanzado (sin diferencial adicional).' };
    }

    const ledgerEntries: LedgerEntry[] = [];
    const now = new Date().toISOString();

    // Acelerador +20%: A=20k adicional, B=50k adicional, C=20k adicional
    // Para Tier 2 y 3: Crear ajuste diferencial de 70.000 COP (A+B) por cada bar de la cohorte activado
    for (const lead of activatedLeadsInMonth) {
      const adjKey = `cohort_adj_${lead.id}_T${cohortTier}`;
      if (existingAdjustments.has(adjKey)) continue;

      const diffAmountCop = (this.scoutPolicy.hit_a_cop + this.scoutPolicy.hit_b_cop) * (this.scoutPolicy.accelerator_bps / 10000); // 70.000 COP

      ledgerEntries.push({
        id: `ledg_${adjKey}`,
        payee_uid: scoutUid,
        payee_type: 'scout',
        lead_id: lead.id,
        venue_id: lead.venue_id,
        milestone: 'tier_adjustment',
        amount_gross_cop: diffAmountCop,
        status: 'payable',
        accrued_at: now,
        policy_version: this.scoutPolicy.version,
        idempotency_key: adjKey,
        reason: `Acelerador Tier ${cohortTier} (${monthKey}): Ajuste diferencial +20% sobre hitos causados (${diffAmountCop.toLocaleString('es-CO')} COP)`
      });
    }

    return {
      success: true,
      ledgerEntries
    };
  }

  // --- 7. approvePayout: Aprobación de Liquidación Manual por Superadmin y Validación RUT/PILA ---
  approvePayout(
    entries: LedgerEntry[],
    approverUid: string,
    approverRole: string,
    transferRef: string,
    isSuperadminApproved: boolean,
    payeeTaxProfile: {
      rutVerified: boolean;
      pilaVerified: boolean;
      taxIdNumber?: string;
    }
  ): { payout: Payout; updatedEntries: LedgerEntry[] } {
    // 1. Validación de rol: exclusivamente superadmin puede autorizar desembolso
    if (approverRole !== 'superadmin' || !isSuperadminApproved) {
      throw new Error('Bloqueo de seguridad: El desembolso manual debe ser aprobado exclusivamente por el Super Administrador.');
    }

    // 2. Validación de cumplimiento fiscal obligatorio: RUT y PILA
    if (!payeeTaxProfile.rutVerified) {
      throw new Error('Bloqueo de cumplimiento fiscal: El colaborador debe contar con RUT verificado antes de aprobar cualquier desembolso.');
    }

    if (!payeeTaxProfile.pilaVerified) {
      throw new Error('Bloqueo de seguridad social: El colaborador debe contar con planilla PILA (seguridad social) verificada del mes en curso.');
    }

    if (!transferRef || transferRef.trim().length === 0) {
      throw new Error('Validación de pago: Se requiere el número de comprobante o referencia de transferencia manual bancaria para conciliar.');
    }

    const grossTotal = entries.reduce((sum, e) => sum + e.amount_gross_cop, 0);
    const now = new Date().toISOString();
    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const payout: Payout = {
      id: payoutId,
      payee_uid: entries[0].payee_uid,
      ledger_entry_ids: entries.map(e => e.id),
      gross_cop: grossTotal,
      net_cop: grossTotal, // Se aplicarán las retenciones registradas en el perfil fiscal
      status: 'reconciled',
      approved_by: approverUid,
      transfer_reference: transferRef,
      reconciled_at: now,
      createdAt: now
    };

    const updatedEntries = entries.map(e => ({
      ...e,
      status: 'paid' as const,
      paid_at: now,
      payout_id: payoutId
    }));

    return { payout, updatedEntries };
  }

  // --- 8. processReversal: Asiento contrario enlazado (Nunca borrar ledger pagado) ---
  processReversal(
    originalEntry: LedgerEntry,
    reason: string,
    authorizerUid: string
  ): LedgerEntry {
    const now = new Date().toISOString();
    const reversalKey = `rev_${originalEntry.id}`;

    return {
      id: `ledg_${reversalKey}`,
      payee_uid: originalEntry.payee_uid,
      payee_type: originalEntry.payee_type,
      venue_id: originalEntry.venue_id,
      lead_id: originalEntry.lead_id,
      event_id: originalEntry.event_id,
      milestone: 'reversal',
      amount_gross_cop: -originalEntry.amount_gross_cop,
      status: 'paid',
      accrued_at: now,
      paid_at: now,
      policy_version: originalEntry.policy_version,
      idempotency_key: reversalKey,
      original_entry_id: originalEntry.id,
      approved_by: authorizerUid,
      reason: `Reverso auditado de ${originalEntry.id}: ${reason}`
    };
  }
}
