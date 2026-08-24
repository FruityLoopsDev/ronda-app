import { DB } from './db.js';
import { RondaDialog } from './dialog.js';

// bar.js: Motor de Rotación y Consola del Anfitrión (Producción)

class HostConsoleService {
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
    const container = document.getElementById('admin-content');
    if (!container || !this.currentEvent) return;
    
    const totalParticipants = this.currentEvent.participants ? this.currentEvent.participants.length : 0;
    
    let html = `
      <div class="panel-local">
        <div class="pl-head">
          <div>
            <h3>Consola del Anfitrión</h3>
            <p>Estado de la Sala: ${this.currentEvent.status.toUpperCase()}</p>
          </div>
          <span class="chip verde">${totalParticipants} Asistentes Confirmados</span>
        </div>

        <div class="pl-body">
          <div class="pl-col" style="border-right: 1px solid var(--linea);">
            <p class="pl-tit">Control de Evento</p>
            <div class="prox">
              <p class="meta">Próxima acción</p>
              <h4>Ronda ${this.currentEvent.currentRound} de 9</h4>
              <ul class="lista" style="margin-bottom: 20px;">
                <li><span>Matches Activos</span><b>${this.currentEvent.activeMatches?.length || 0}</b></li>
                <li><span>Asistentes Mínimos</span><b>10</b></li>
              </ul>
              
              <div class="acciones-local flex-col gap-2">
                <button id="btn-add-p" class="btn" style="width: 100%; margin-bottom:10px; border-color: var(--luz); color: var(--luz);">Mostrar Código de Registro</button>
                <button id="btn-next-r" class="btn si" style="width: 100%; margin-bottom:10px;">${this.currentEvent.currentRound === 0 ? 'Arrancar Motor (Ronda 1)' : 'Campana (Siguiente Ronda)'}</button>
                <button id="btn-end-e" class="btn" style="width: 100%; border-color: var(--vino); color: var(--vino); font-weight: 700;">Finalizar y Emitir NFTs</button>
              </div>
            </div>
          </div>
          
          <div class="pl-col">
    `;

    if (this.currentEvent.currentRound === 0) {
      // Mostrar lista de participantes que se han unido en tiempo real
      let participantsHtml = "";
      if (this.currentEvent.participants && this.currentEvent.participants.length > 0) {
        this.currentEvent.participants.forEach(uid => {
          const profile = this.participantProfiles[uid] || { name: 'Cargando...', age: '', gender: '' };
          participantsHtml += `
            <li style="padding: 10px 0;">
              <div>
                <b>${profile.name || 'Usuario Nuevo'}</b>
                <span style="font-size: 11px; color: var(--humo); display: block;">Género: ${profile.gender || '?'}, Orientación: ${profile.orientation || '?'}</span>
              </div>
              <span class="chip gris">${profile.age ? profile.age + ' años' : '---'}</span>
            </li>
          `;
        });
      } else {
        participantsHtml = `<li style="text-align: center; color: var(--humo); padding: 20px 0;">Esperando a que los usuarios ingresen con el código...</li>`;
      }

      html += `
            <p class="pl-tit">Clientes Registrados en Sala</p>
            <ul class="lista" style="max-height: 350px; overflow-y: auto;">
              ${participantsHtml}
            </ul>
      `;
    } else {
      // Mostrar planta de mesas en vivo
      html += `
            <p class="pl-tit">Planta de Mesas en Vivo</p>
            <div class="mapa" id="admin-mapa" style="grid-template-columns: repeat(2, 1fr); gap: 10px;">
      `;

      if (this.currentEvent.activeMatches && this.currentEvent.activeMatches.length > 0) {
        html += `<div class="planta">`;
        this.currentEvent.activeMatches.forEach(m => {
          const repeatBadge = m.isRepeat ? `<span class="repite">repite</span>` : '';
          const activeClass = 'activa';
          html += `
            <div class="mesa ${activeClass}">
              ${repeatBadge}
              <span class="num">MESA ${m.tableId}</span>
              <div class="ficha a">${m.p1.name.substring(0,2).toUpperCase()}</div>
              <span class="union">▲ ▼</span>
              <div class="ficha b">${m.p2.name.substring(0,2).toUpperCase()}</div>
            </div>
          `;
        });
        html += `</div>
          <div class="leyenda-planta" style="margin-top: 15px; font-family: var(--font-mono); font-size: 10px; color: var(--humo);">
            <span><i style="display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:-1px;background:rgba(46,107,84,.5);"></i>Lado A · fijo</span>
            <span><i style="display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:-1px;background:rgba(240,168,48,.5);"></i>Lado B · rota</span>
          </div>
        `;
      } else {
        html += `<div class="aviso">No hay matches activos en esta ronda.</div>`;
      }

      html += `</div>`;
    }

    html += `
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // Bindear event listeners
    const btnAdd = document.getElementById('btn-add-p');
    if (btnAdd) btnAdd.addEventListener('click', () => this.showScannerInstruction());
    
    const btnNext = document.getElementById('btn-next-r');
    if (btnNext) btnNext.addEventListener('click', () => this.generateNextRound());

    const btnEnd = document.getElementById('btn-end-e');
    if (btnEnd) btnEnd.addEventListener('click', () => this.endEventAndMint());
  }
}

export const HostConsole = new HostConsoleService();
