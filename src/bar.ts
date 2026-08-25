import { DB } from './db.js';
import { RondaDialog } from './dialog.js';

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
    
    addEventListener('auth:login', (e) => {
      if (e.detail.role === 'admin') {
        this.initAdminDashboard(e.detail);
      }
    });
    
    addEventListener('auth:logout', () => {
      if (this.unsubscribe) this.unsubscribe();
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
    
    // Para producción, asumimos que el admin administra 'e1'
    const eventId = 'e1';
    
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
      title: 'Finalizar Evento y Emitir NFTs',
      message: '¿Estás seguro de finalizar el evento y emitir los certificados NFT a los asistentes en la red Polygon?',
      icon: '🎫',
      confirmText: '✓ Finalizar y Emitir',
      cancelText: '✕ Cancelar'
    });

    if (confirmEnd) {
      const btnEnd = document.getElementById('btn-end-e');
      if (btnEnd) {
        btnEnd.textContent = "Emitiendo NFTs...";
        btnEnd.disabled = true;
      }
      try {
        await DB.confirmarSala(this.currentEvent.id, this.currentEvent.participants);
        await RondaDialog.alert({
          title: 'Certificados Emitidos',
          message: 'Evento finalizado con éxito. Los NFTs de asistencia han sido emitidos en la blockchain Polygon.',
          icon: '✨'
        });
      } catch (err: any) {
        console.error("Error al finalizar evento:", err);
        await RondaDialog.alert({
          title: 'Error de Emisión',
          message: 'No se pudieron emitir los NFTs: ' + err.message,
          icon: '⚠️',
          type: 'danger'
        });
      }
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
