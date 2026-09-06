import { DB, RondaEvent } from './db.js';
import { Auth } from './auth.js';
import notifications from './notifications.js';
import { RondaDialog } from './dialog.js';
import { buildNightPlan } from './mem-rr-v2/engine.ts';
import type { Participant as RRParticipant } from './mem-rr-v2/types.ts';
import { pairKey } from './mem-rr-v2/weights.ts';
import { RRHistory } from './mem-rr-history.js';

// bar.js: Motor de Rotación y Consola del Anfitrión (Producción)

class HostConsoleService {
  currentEvent: any = null;
  unsubscribe: any = null;
  participantProfiles: any = {};
  m: number = 0;
  A: any[] = [];
  B: any[] = [];
  offsets: any[] = [];
  prior: any[] = [];
  met: any[] = [];
  barTable: number = -1;
  hasBar: boolean = false;
  // --- Motor v2 (MEM-RR WMM) ---
  motorVersion: string = 'v2';
  nightPlan: any = null;
  nightPlanFor: string = '';
  nightPlanStartRound: number = 0;
  playedPairs: string[] = [];
  currentMetrics: any = null;
  qrScanner: any = null;
  qrScanning: boolean = false;
  constructor() {
    this.currentEvent = null;
    this.unsubscribe = null;
    this.participantProfiles = {};
    
    // Estado del motor (como en ronda-motor-rotacion.html)
    this.m = 0; // Número de mesas (o n + 1 si hay silla de barra)
    this.A = [];
    this.B = [];
    this.offsets = [];
    this.prior = [];
    this.met = [];
    this.barTable = -1;
    this.hasBar = false;
    
    addEventListener('auth:login', (e: any) => {
      if (e.detail && e.detail.role === 'admin') {
        this.initAdminDashboard(e.detail);
      }
    });
    
    addEventListener('auth:logout', () => {
      if (this.unsubscribe) this.unsubscribe();
      RRHistory.reset();
    });
  }

  /* PRNG determinista para simular "historial de noches previas" si Firestore no lo provee */
  mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }

  async initAdminDashboard(adminUser) {
    console.log("Iniciando Dashboard de Anfitrión (Producción) para:", adminUser.venueId);
    
    // Solicitar el ID del evento al anfitrión
    let eventId = prompt("Ingresa el ID del evento que vas a gestionar:", "rnd-caronte-mar-25");
    if (!eventId) {
      console.warning("No se ingresó ID de evento. Cancelando inicialización del dashboard.");
      return;
    }
    
    let eventData = await DB.getEvent(eventId);
    if (!eventData) {
      const create = confirm(`El evento ${eventId} no existe. ¿Deseas crearlo ahora?`);
      if (create) {
        const venueName = prompt("Nombre del Bar / Local:", "Nuevo Evento");
        const tablesStr = prompt("Número de mesas:", "8");
        const tables = parseInt(tablesStr || '8', 10);
        
        eventData = {
          id: eventId,
          venueName: venueName || 'Bar',
          status: 'waiting',
          participants: [],
          tables: tables,
          currentRound: 0,
          price: 45000,
          priceFormatted: '$45.000',
          dayDate: 'Hoy · 20:00'
        } as RondaEvent;
        
        await DB.saveEvent(eventData);
        console.log("Evento creado exitosamente:", eventData);
      } else {
        return;
      }
    }
    
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = DB.subscribeToEvent(eventId, async (eventData) => {
      this.currentEvent = eventData;
      
      // Cargar perfiles de nuevos participantes en tiempo real
      if (eventData.participants) {
        for (const uid of eventData.participants) {
          if (!this.participantProfiles[uid]) {
            const profile = await DB.getUser(uid);
            if (profile) {
              this.participantProfiles[uid] = profile;
            }
          }
        }
      }
      
      // Motor v2: invalidar el plan si cambió la composición de la sala
      const snapshot = (eventData.participants || []).slice().sort().join(',');
      if (this.nightPlanFor !== snapshot) {
        this.nightPlan = null;
      }
      if (Array.isArray(eventData.playedPairs)) {
        this.playedPairs = [...eventData.playedPairs];
      }

      if(this.currentEvent.currentRound === 0 && this.A.length === 0) {
        // Inicializar estado del motor la primera vez que carga si no hay ronda iniciada
        this.syncMotorState();
      }
      this.renderDashboard();
    });
  }

  syncMotorState() {
    if (!this.currentEvent || !this.currentEvent.participants || this.currentEvent.participants.length < 2) return;

    // Distribuir participantes
    const p = this.currentEvent.participants;
    const n = Math.floor(p.length / 2);
    this.hasBar = p.length % 2 !== 0;
    this.m = this.hasBar ? n + 1 : n;
    this.barTable = this.hasBar ? this.m - 1 : -1;
    
    this.A = [];
    this.B = [];
    
    // Dividir en lados A (Fijos) y B (Rotan)
    for(let i=0; i<this.m; i++) {
      if (i === this.barTable) {
        this.A.push({id: 'barra', ghost: true, uid: null});
      } else {
        this.A.push({id: 'A'+(i+1), ghost: false, uid: p[i]});
      }
      
      if (i + n < p.length) {
        this.B.push({id: 'B'+(i+1), uid: p[i+n]});
      } else {
        this.B.push({id: 'B'+(i+1), uid: 'ghost_b'});
      }
    }

    // Inicializar matriz de prior (memoria)
    const rnd = this.mulberry32(1234 + n * 7);
    this.prior = Array.from({length: this.m}, () => Array(this.m).fill(false));
    
    // Simulación determinista de relaciones previas
    for(let a=0; a<this.m; a++) {
      for(let b=0; b<this.m; b++) {
        if(!this.A[a].ghost && rnd() < 0.35) this.prior[a][b] = true;
      }
    }

    // Calcular Offsets
    const colisiones = [];
    for(let d=0; d<this.m; d++) {
      let c=0;
      for(let a=0; a<this.m; a++) { 
        if(!this.A[a].ghost && this.prior[a][(a-d+this.m)%this.m]) c++; 
      }
      colisiones.push({d, c});
    }
    
    this.offsets = colisiones.slice().sort((x,y) => x.c - y.c || x.d - y.d).map(o => o.d);
    this.met = Array.from({length: this.m}, () => Array(this.m).fill(0));
  }

  async generateNextRound() {
    if (!this.currentEvent || !this.currentEvent.participants || this.currentEvent.participants.length < 2) {
      alert("No hay suficientes participantes registrados aún. Por favor espera a que se unan.");
      return;
    }

    // Motor v2 (MEM-RR WMM): memoria real + restricciones duras + fairness.
    // Si falla (perfiles sin cargar, error), cae al motor v1 como respaldo.
    if (this.motorVersion === 'v2') {
      const ok = await this.generateNextRoundV2();
      if (ok) return;
      console.warning("[Motor] Plan v2 no disponible; usando motor v1 de respaldo.");
    }

    if (this.currentEvent.currentRound === 0) {
      this.syncMotorState();
    }

    this.currentEvent.currentRound += 1;
    const r = this.currentEvent.currentRound;
    
    // Aplicar ronda (Round-robin con memoria)
    const d = this.offsets[(r - 1 + this.offsets.length) % this.offsets.length];
    const activeMatches = [];

    for(let i=0; i<this.m; i++) {
      const b = (i - d + this.m) % this.m;
      if (this.A[i].ghost) continue; // Es la barra
      
      this.met[i][b] = this.prior[i][b] ? 2 : 1;
      
      // Obtener perfiles reales de BD
      const p1 = this.participantProfiles[this.A[i].uid];
      const p2 = this.participantProfiles[this.B[b].uid];
      
      if (p1 && p2) {
        activeMatches.push({
          tableId: (i+1).toString().padStart(2, '0'),
          p1: {uid: p1.uid, name: p1.name},
          p2: {uid: p2.uid, name: p2.name},
          isRepeat: this.prior[i][b]
        });
      }
    }

    this.currentEvent.activeMatches = activeMatches;
    await DB.saveEvent(this.currentEvent);
    console.log(`[Motor] Ronda ${r} generada en Firestore.`);
  }

  async showScannerInstruction() {
    await RondaDialog.alert({
      title: 'Código de Sala',
      message: `Pide a los asistentes ingresar el código del evento en sus teléfonos:\n\nCÓDIGO: ${this.currentEvent.id.toUpperCase()}`,
      icon: '📱'
    });
  }

  async endEventAndMint() {
    if (!this.currentEvent) return;
    if (this.currentEvent.status === 'finished') {
      await RondaDialog.alert({
        title: 'Evento Finalizado',
        message: 'Este evento ya ha finalizado previamente.',
        icon: 'ℹ️'
      });
      return;
    }

    const confirmEnd = await RondaDialog.confirm({
      title: 'Finalizar Evento y Emitir Certificados',
      message: '¿Estás seguro de finalizar el evento, procesar los matches mutuos y emitir los certificados Proof-of-Attendance a los asistentes?',
      icon: '🍸',
      confirmText: '✓ Finalizar y Procesar',
      cancelText: '✕ Cancelar'
    });

    if (confirmEnd) {
      const btnEnd = document.getElementById('btn-end-e') as HTMLButtonElement;
      if (btnEnd) {
        btnEnd.textContent = "Procesando...";
        btnEnd.disabled = true;
      }
      try {
        const result = await DB.confirmarSala(this.currentEvent.id, this.currentEvent.participants);
        const matchesCount = result?.matchesCount ?? 0;
        await RondaDialog.alert({
          title: 'Evento Finalizado con Éxito',
          message: `Evento cerrado correctamente. Se calcularon ${matchesCount} parejas con match mutuo y se emitieron los certificados digitales de asistencia ($0 sin Cloud Functions).`,
          icon: '✨'
        });
      } catch (err: any) {
        console.error("Error al finalizar evento:", err);
        await RondaDialog.alert({
          title: 'Error al Finalizar',
          message: 'Ocurrió un error al procesar el cierre: ' + err.message,
          icon: '⚠️',
          type: 'danger'
        });
      } finally {
        if (btnEnd) {
          btnEnd.textContent = "✓ Evento Finalizado";
        }
      }
    }
  }

  /* =====================================================================
   * Motor v2 (MEM-RR WMM) — see docs/algorithm-v2-spec.md
   * ===================================================================== */

  private toRRProfile(p: any): RRParticipant {
    const orientations = ['M', 'F', 'NB', 'A'] as const;
    return {
      uid: p.uid,
      name: p.name || p.uid,
      gender: p.gender === 'M' || p.gender === 'F' || p.gender === 'NB' ? p.gender : 'NB',
      orientation: orientations.includes(p.orientation) ? p.orientation : 'A',
      age: typeof p.age === 'number' ? p.age : 30,
      interests: Array.isArray(p.interests) ? p.interests : [],
      verified: !!p.isVerified,
      blocked: Array.isArray(p.blockedUids) ? p.blockedUids : []
    };
  }

  /**
   * Construye (o reutiliza) el plan de noche v2 para la sala actual.
   * Se invalida solo si cambia la composición de participantes (re-planificación
   * intra-noche con alreadyMet = pares ya jugados).
   */
  async buildV2Plan(force = false): Promise<any> {
    if (!this.currentEvent?.participants || this.currentEvent.participants.length < 2) return null;

    const uids = this.currentEvent.participants.slice().sort().join(',');
    if (!force && this.nightPlan && this.nightPlanFor === uids) return this.nightPlan;

    const profiles = this.currentEvent.participants
      .map((uid: string) => this.participantProfiles[uid])
      .filter((p: any) => p && p.uid);

    if (profiles.length < 2) {
      console.warning("[Motor v2] Perfiles insuficientes cargados todavía.");
      return null;
    }

    await RRHistory.loadFor(profiles);

    const n = Math.floor(profiles.length / 2);
    const sideA = profiles.slice(0, n).map((p: any) => this.toRRProfile(p));
    const sideB = profiles.slice(n).map((p: any) => this.toRRProfile(p));

    // Re-planificación intra-noche: plan para las rondas restantes
    const startRound = this.currentEvent.currentRound || 0;
    const remaining = Math.max(1, 9 - startRound);
    const alreadyMet = new Set(this.playedPairs);

    this.nightPlan = buildNightPlan({
      sideA,
      sideB,
      rounds: remaining,
      history: RRHistory,
      alreadyMet,
      config: { delta: 0 }
    });
    this.nightPlanFor = uids;
    this.nightPlanStartRound = startRound;
    this.currentMetrics = this.nightPlan.metrics;
    console.log(`[Motor v2] Plan construido: modo=${this.nightPlan.mode} · ${this.nightPlan.rounds.length} rondas · memoria=${RRHistory.size} encuentros · ya conocidos esta noche=${alreadyMet.size} pares.`);
    return this.nightPlan;
  }

  /** Genera la siguiente ronda con el plan v2. Devuelve false si no fue posible. */
  private async generateNextRoundV2(): Promise<boolean> {
    try {
      const plan = await this.buildV2Plan();
      if (!plan || plan.rounds.length === 0) return false;

      this.currentEvent.currentRound = (this.currentEvent.currentRound || 0) + 1;
      const r = this.currentEvent.currentRound;
      const idx = r - 1 - this.nightPlanStartRound;
      const roundResult = plan.rounds[idx];

      if (!roundResult) {
        // El plan no alcanzó esta ronda (noche no factible por restricciones duras)
        this.currentEvent.currentRound = r - 1;
        await RondaDialog.alert({
          title: 'Noche Completada',
          message: `El motor alcanzó el máximo de rondas factibles (${idx} de 9) respetando las restricciones de la sala (bloqueos, compatibilidad).`,
          icon: '🔔'
        });
        return true;
      }

      const activeMatches: any[] = [];
      const recordedPairs: { a: RRParticipant; b: RRParticipant }[] = [];
      const resting: { uid: string; name: string }[] = [];

      for (const t of roundResult.tables) {
        if (t.a && t.b) {
          const isRepeat = RRHistory.get(t.a.uid, t.b.uid) !== null;
          activeMatches.push({
            tableId: t.tableId.toString().padStart(2, '0'),
            p1: { uid: t.a.uid, name: t.a.name || t.a.uid },
            p2: { uid: t.b.uid, name: t.b.name || t.b.uid },
            isRepeat
          });
          recordedPairs.push({ a: t.a, b: t.b });
          this.playedPairs.push(pairKey(t.a.uid, t.b.uid));
        } else {
          const restingPerson = t.a || t.b;
          if (restingPerson) resting.push({ uid: restingPerson.uid, name: restingPerson.name || restingPerson.uid });
        }
      }

      this.currentEvent.activeMatches = activeMatches;
      this.currentEvent.resting = resting;
      this.currentEvent.playedPairs = this.playedPairs;
      await DB.saveEvent(this.currentEvent);
      await RRHistory.recordPairs(recordedPairs);
      console.log(`[Motor v2] Ronda ${r} generada · ${activeMatches.length} mesas · ${resting.length} en barra · ${recordedPairs.length} encuentros registrados.`);
      return true;
    } catch (err) {
      console.error("[Motor v2] Error generando ronda:", err);
      return false;
    }
  }

  renderDashboard() {
    const container = document.getElementById('view-admin');
    if (!container || !this.currentEvent) return;
    
    const totalParticipants = this.currentEvent.participants ? this.currentEvent.participants.length : 0;
    
    // Próxima Noche / Evento Actual
    const elConfirmed = document.getElementById('nn-confirmed');
    if (elConfirmed) {
      elConfirmed.textContent = `${totalParticipants} (${Math.floor(totalParticipants/2)} + ${Math.ceil(totalParticipants/2)})`;
    }
    
    const elTables = document.getElementById('nn-tables');
    if (elTables) {
      elTables.textContent = `${Math.ceil(totalParticipants / 2)} de 2 plazas`;
    }

    const elDrinks = document.getElementById('nn-drinks');
    if (elDrinks) {
      elDrinks.textContent = `${totalParticipants * 2} mínimo`;
    }

    const elRevenue = document.getElementById('nn-revenue');
    if (elRevenue) {
      // Assuming a base consumption of $22,000 COP per included drink * 2 = 44,000 per person
      const totalRev = totalParticipants * 44000;
      elRevenue.textContent = `$${totalRev.toLocaleString('es-CO')}`;
    }

    // Botones de acción del evento
    const btnStart = document.getElementById('btn-admin-start-event');
    const btnEnd = document.getElementById('btn-admin-end-event');
    
    if (btnStart) {
      if (this.currentEvent.currentRound === 0) {
        btnStart.textContent = 'Arrancar Noche (Motor)';
        btnStart.className = 'btn ambar';
      } else {
        btnStart.textContent = `Campana (Ronda ${this.currentEvent.currentRound} de 9)`;
        btnStart.className = 'btn si';
      }
      // Limpiar listeners anteriores (clonando)
      const newBtnStart = btnStart.cloneNode(true);
      btnStart.parentNode?.replaceChild(newBtnStart, btnStart);
      newBtnStart.addEventListener('click', () => this.generateNextRound());
    }

    if (btnEnd) {
      if (this.currentEvent.currentRound > 0) {
        btnEnd.style.display = 'block';
        const newBtnEnd = btnEnd.cloneNode(true);
        btnEnd.parentNode?.replaceChild(newBtnEnd, btnEnd);
        newBtnEnd.addEventListener('click', () => this.endEventAndMint());
      } else {
        btnEnd.style.display = 'none';
      }
    }

    // Chart mock con datos aleatorios pero estables
    this.renderChart(totalParticipants);

    // Panel de métricas del motor v2 (M5-lite)
    this.renderMetricsPanel();

    // Herramientas de check-in por QR (M3)
    this.renderQrTools();
  }

  /* =====================================================================
   * Check-in por QR (M3) — escáner del anfitrión mediante html5-qrcode
   * ===================================================================== */

  /** Crea (una sola vez) los controles de escaneo en el dashboard del anfitrión. */
  renderQrTools() {
    const container = document.getElementById('view-admin');
    if (!container || document.getElementById('admin-qr-tools')) return;
    const sec = document.createElement('section');
    sec.id = 'admin-qr-tools';
    sec.style.cssText = 'background: rgba(34,24,38,.8); border: 1px solid rgba(243,237,226,.14); border-radius: 14px; padding: 14px 16px; margin-top: 16px;';
    sec.innerHTML = `
      <div style="font-family:var(--font-mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--luz); margin-bottom:10px;">Check-in por QR · registrar asistencia</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <button id="btn-admin-scan-qr" class="btn ambar" style="font-size:12px; font-weight:700; padding:10px 16px; border-radius:10px;">📷 Escanear QR</button>
        <input id="admin-qr-manual" placeholder="o ingresa el uid/código" style="flex:1; min-width:160px; padding:9px 12px; border-radius:8px; border:1px solid rgba(243,237,226,.14); background:rgba(243,237,226,.06); color:var(--papel); font-size:12px;">
        <button id="btn-admin-checkin-manual" class="btn" style="font-size:12px; padding:10px 14px; border-radius:10px;">Registrar</button>
      </div>
      <div id="qr-scanner-region" style="display:none; margin-top:12px; max-width:280px;"></div>
    `;
    container.appendChild(sec);
    document.getElementById('btn-admin-scan-qr')?.addEventListener('click', () => this.startQrScan());
    document.getElementById('btn-admin-checkin-manual')?.addEventListener('click', () => {
      const inp = (document.getElementById('admin-qr-manual') as HTMLInputElement)?.value.trim() ?? '';
      if (!inp) { this.showToastQR('⚠️ Ingresa un uid/código'); return; }
      this.handleQrDecode(inp);
    });
  }

  async startQrScan() {
    if (this.qrScanning) { await this.stopQrScan(); return; }
    try {
      // Import dinámico: html5-qrcode se descarga solo al escanear (code-split).
      const { Html5Qrcode } = await import('html5-qrcode');
      const region = document.getElementById('qr-scanner-region');
      if (!region) return;
      this.qrScanning = true;
      this.qrScanner = new Html5Qrcode('qr-scanner-region');
      await this.qrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decoded: string) => this.handleQrDecode(decoded),
        () => {}
      );
      region.style.display = 'block';
      this.showToastQR('📷 Escáner activo. Apunta al QR del asistente.');
    } catch (err) {
      this.qrScanning = false;
      console.error('[QR] error iniciando escáner:', err);
      this.showToastQR('⚠️ No se pudo activar la cámara. Usa la entrada manual.');
    }
  }

  async stopQrScan() {
    try { if (this.qrScanner) await this.qrScanner.stop(); } catch (err) { /* ignorar */ }
    this.qrScanner = null;
    this.qrScanning = false;
    const region = document.getElementById('qr-scanner-region');
    if (region) region.style.display = 'none';
  }

  /** Registra la asistencia del uid escaneado → dispara la re-planificación del motor v2. */
  async handleQrDecode(text: string) {
    const m = /^CHECKIN:(.+)$/.exec(text.trim());
    if (!m) { this.showToastQR('QR no reconocido'); return; }
    const uid = m[1];
    await this.stopQrScan();
    if (!this.currentEvent) { this.showToastQR('Sin evento activo'); return; }

    const user = await DB.getUser(uid);
    if (!user) {
      this.showToastQR('⚠️ Usuario no registrado en la plataforma');
      return;
    }

    // Validación de pago en puerta si tiene pago pendiente o no tiene ticket confirmado
    if (user.paymentPending || !user.hasTicket) {
      const confirmed = await RondaDialog.confirm({
        title: '⚠️ Pago Pendiente en Puerta',
        message: `El asistente <b>${user.name || uid}</b> figura con pago pendiente o sin boleta confirmada.<br><br>¿Confirmar que el pago (Nequi / Efectivo) fue recibido para autorizar su ingreso?`,
        icon: '💵',
        confirmText: '✓ Confirmar Pago y Entrada',
        cancelText: '✕ Denegar Ingreso',
        type: 'confirm'
      });

      if (!confirmed) {
        this.showToastQR(`❌ Ingreso denegado para ${user.name || uid}`);
        return;
      }

      user.hasTicket = true;
      user.paymentPending = false;
    }

    const parts = this.currentEvent.participants || [];
    if (!parts.includes(uid)) {
      parts.push(uid);
      this.currentEvent.participants = parts;
      await DB.saveEvent(this.currentEvent); // la suscripción invalida nightPlan → re-planifica
    }

    user.checkedIn = true;
    await DB.saveUser(user);

    this.showToastQR(`✅ ${user.name || uid} registrado`);
    this.renderDashboard();
  }

  showToastQR(msg: string) {
    notifications.showLegacyToast(msg);
  }

  /** Renderiza las métricas auditables del plan v2 en el dashboard del anfitrión. */
  renderMetricsPanel() {
    const container = document.getElementById('view-admin');
    const m = this.currentMetrics;
    if (!container || !m) return;

    let el = document.getElementById('admin-metrics-v2');
    if (!el) {
      el = document.createElement('section');
      el.id = 'admin-metrics-v2';
      el.style.cssText = 'background: rgba(34,24,38,.8); border: 1px solid rgba(243,237,226,.14); border-radius: 14px; padding: 14px 16px; margin-top: 16px;';
      container.appendChild(el);
    }
    const card = (label: string, value: string, color = 'var(--luz)') =>
      `<div style="border:1px solid rgba(243,237,226,.12); border-radius:11px; padding:10px;">
         <div style="font-family:var(--font-mono); font-size:20px; font-weight:700; color:${color};">${value}</div>
         <div style="font-size:10px; color:var(--humo); margin-top:2px;">${label}</div>
       </div>`;

    el.innerHTML = `
      <div style="font-family:var(--font-mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--luz); margin-bottom:8px;">Motor v2 · métricas del plan</div>
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
        ${card('Cobertura', m.coveragePct + '%', 'var(--botella)')}
        ${card('Caras nuevas', m.freshFaces)}
        ${card('Repeticiones', m.historyRepeats, 'var(--vino)')}
        ${card('Gini descansos', m.restGini.toFixed(2))}
      </div>
      <div style="font-size:10px; color:var(--humo); margin-top:8px; font-family:var(--font-mono);">repet. máx/persona: ${m.historyRepeatsMax} · distancia: ${m.totalDistance.toFixed(2)}</div>
    `;
  }

  renderChart(totalParticipants) {
    const chart = document.getElementById('admin-chart');
    if (!chart) return;
    
    const days = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
    const pcts = [22, 82, 76, 88, 94, 97, 40]; // Base from design
    
    // Slight variation based on current participants to make it feel alive
    const variation = totalParticipants % 5;
    
    chart.innerHTML = '';
    days.forEach((day, index) => {
      let pct = pcts[index] + (index === 1 ? variation : 0);
      if (pct > 100) pct = 100;
      
      const isActive = index >= 1 && index <= 3; // Mar, Mié, Jue
      
      const col = document.createElement('div');
      col.className = 'bar-col';
      col.innerHTML = `
        <div class="bar ${isActive ? 'active' : ''}" style="height: ${pct}%;">
          ${isActive ? `<span class="bar-pct">${pct}%</span>` : ''}
        </div>
        <div class="bar-label">${day}</div>
      `;
      chart.appendChild(col);
    });
  }

  init() {
    const user = (window as any).Auth?.currentUser || { venueId: 'v1' };
    this.initAdminDashboard(user);
  }
}

export const HostConsole = new HostConsoleService();
export const Admin = HostConsole;
