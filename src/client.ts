import { DB } from './db.js';
import { Auth } from './auth.js';
import { RondaServices } from './firebase-config.js';
import { OfflineSync } from './offline-sync.js';

// client.js: Lógica del Cliente en la App (Participante de RONDA - Producción)

class ClientAppService {
  constructor() {
    this.currentEvent = null;
    this.unsubscribe = null;
    this.timerInterval = null;
    
    // Escuchar el login para montar la vista
    addEventListener('auth:login', (e: any) => {
      if (e.detail.role === 'client') {
        this.initClientDashboard(e.detail);
      }
    });
    
    addEventListener('auth:logout', () => {
      if (this.unsubscribe) this.unsubscribe();
      this.stopTimer();
    });
  }

  async initClientDashboard(user: any) {
    console.log("Iniciando Dashboard Cliente...");
    
    // Configurar interfaz inicial
    const eventCode = (document.getElementById('event-code') as HTMLInputElement);
    if (eventCode) eventCode.value = user.activeEventId || '';

    // If the user doesn't have an active event, render the discovery feed
    if (!user.activeEventId) {
      this.renderDiscoveryFeed();
      return;
    }
    
    // Validar si tiene evento activo
    const eventId = user.activeEventId;
    if (eventId) {
      if (this.unsubscribe) this.unsubscribe();
      this.unsubscribe = DB.subscribeToEvent(eventId, (eventData) => {
        this.currentEvent = eventData;
        this.renderClientView();
      });
    }
  }

  // Verifica si el cliente actual está en alguna mesa activa
  getMyCurrentMatch() {
    if (!this.currentEvent || !this.currentEvent.activeMatches) return null;
    const myUid = Auth.currentUser.uid;
    return this.currentEvent.activeMatches.find(m => m.p1.uid === myUid || m.p2.uid === myUid);
  }

  triggerSafeWord() {
    console.warn("¡Safe-word activado! Notificando a seguridad y bloqueando al usuario...");
    alert("Hemos notificado discretamente a la seguridad del bar. Quédate donde estás, alguien se acercará pronto.");
  }

  startTimer(durationSeconds) {
    this.stopTimer();
    let timeLeft = durationSeconds;
    const el = document.getElementById('match-timer');
    
    this.timerInterval = setInterval(() => {
      if (timeLeft <= 0) {
        this.stopTimer();
        if (el) {
          if (!navigator.onLine) {
            el.innerText = "Esperando conexión para tu próxima mesa...";
            el.style.fontSize = "16px";
            el.style.color = "var(--ambar)";
          } else {
            el.innerText = "¡Ronda finalizada!";
          }
        }
        console.log("DING! Cambio de mesa.");
      } else {
        if(el) {
          const mins = Math.floor(timeLeft / 60);
          const secs = timeLeft % 60;
          el.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
          // Alerta roja de vino si queda menos de un minuto
          if (timeLeft < 60) {
            el.style.color = "var(--vino)";
            el.classList.add("fin");
          } else {
            el.style.color = "var(--luz)";
            el.classList.remove("fin");
          }
        }
        timeLeft--;
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  async handleVote(targetUid, isYes) {
    console.log(`Votaste ${isYes ? 'SÍ' : 'NO'} por el usuario ${targetUid}`);
    alert(`¡Preferencia guardada! ${isYes ? 'Esperemos que sea mutuo 😉' : 'Anotado.'}`);
    
    const myUid = Auth.currentUser.uid;
    const eventId = this.currentEvent.id;
    
    try {
      const result = await OfflineSync.pushVote(myUid, targetUid, isYes, eventId);
      console.log("[Client] Resultado de voto:", result.status);

      // Deshabilitar botones
      const btnYes = document.getElementById('btn-vote-yes');
      const btnNo = document.getElementById('btn-vote-no');
      if (btnYes) btnYes.disabled = true;
      if (btnNo) btnNo.disabled = true;
    } catch (e) {
      console.error("Error crítico guardando voto:", e);
      alert("Error inesperado guardando tu voto. Se intentará de nuevo.");
    }
  }

  // Mostrar NFTs en el panel del cliente
  renderNFTsSection() {
    const user = Auth.currentUser;
    if (!user) return '';
    
    let nftHtml = `
      <div class="noche-card mt-6" style="margin-top:20px;">
        <h4 style="margin-bottom: 15px;">🏆 Mis Certificados NFT</h4>
    `;
    
    if (user.wallet_address) {
      nftHtml += `<p style="font-size: 11px; color: var(--humo); margin-bottom: 15px;">Wallet: <code style="color: var(--luz);">${user.wallet_address.substring(0,6)}...${user.wallet_address.substring(user.wallet_address.length-4)}</code></p>`;
    } else {
      nftHtml += `
        <div style="background: rgba(240,168,48,0.1); border: 1px solid var(--luz); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <p style="font-size: 12px; color: var(--luz); margin-bottom: 10px;">⚠️ No tienes una Wallet vinculada para recibir tus NFTs de asistencia.</p>
          <button id="btn-link-wallet" class="btn si" style="width: 100%; font-size: 11px; padding: 8px;">Vincular Wallet</button>
        </div>
      `;
    }
    
    if (user.nfts && user.nfts.length > 0) {
      nftHtml += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">`;
      user.nfts.forEach(nft => {
        nftHtml += `
          <div style="background: var(--barra); border: 1px solid var(--linea); border-radius: 8px; padding: 10px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 5px;">🎫</div>
            <p style="font-weight: bold; font-size: 12px; color: var(--papel);">${nft.evento_nombre}</p>
            <p style="font-size: 9px; color: var(--humo);">${nft.fecha}</p>
          </div>
        `;
      });
      nftHtml += `</div>`;
    } else {
      nftHtml += `<p style="font-size: 11px; color: var(--humo); text-align: center;">Aún no tienes ningún NFT. ¡Participa en un evento para recibir el tuyo!</p>`;
    }
    
    nftHtml += `</div>`;
    return nftHtml;
  }

  renderDiscoveryFeed() {
    const feed = document.getElementById('discovery-feed');
    if (!feed) return;

    feed.innerHTML = `
      <article class="noche-card escaso" style="cursor: pointer;">
        <div class="dia">Martes 25 · 20:00</div>
        <div class="local">CARONTE Cocktail Bar</div>
        <div class="detalle">9 rondas de 6 min · acaba a las 21:45</div>
        <div class="barra-balance">
          <i style="width:62%;background:var(--luz)"></i>
          <i style="width:38%;background:rgba(243,237,226,.22)"></i>
        </div>
        <div class="leyenda">
          <span>12 apuntadas</span>
          <span>faltan 3 · Lado B</span>
        </div>
        <div class="linea-precio">
          <div class="precio">
            $45.000
            <small>Sube a $55.000 al equilibrarse</small>
          </div>
          <span class="chip ambar">Tu lado va escaso</span>
        </div>
      </article>

      <article class="noche-card ok" style="cursor: pointer;">
        <div class="dia">Miércoles 26 · 20:00</div>
        <div class="local">La María Quinta Camacho · gastrobar</div>
        <div class="detalle">Noche de vinos · 35–49 años</div>
        <div class="linea-precio">
          <div class="precio">
            $55.000
            <small>Incluye 1er Cóctel de Autor</small>
          </div>
          <span class="chip verde">Confirmado 12/12</span>
        </div>
      </article>

      <article class="noche-card lleno" style="cursor: pointer;">
        <div class="dia">Jueves 27 · 20:30</div>
        <div class="local">Patio Poca Prisa</div>
        <div class="detalle">Temática: cine · 28–38 años</div>
        <div class="linea-precio">
          <div class="precio">
            $65.000
            <small>Jueves, tarifa alta</small>
          </div>
          <span class="chip gris">Lista de espera</span>
        </div>
      </article>
    `;
  }

  renderClientView() {
    const container = document.getElementById('client-content');
    if (!container || !this.currentEvent) return;
    
    let html = "";
    const match = this.getMyCurrentMatch();
    const isWaiting = this.currentEvent.currentRound === 0;

    if (isWaiting) {
      // Mostrar ticket de ingreso (Check-In completado exitosamente)
      html += `
        <div class="lobby-box">
          <svg class="icon-svg" style="color: var(--luz); margin-bottom: 10px; width: 32px; height: 32px;"><use href="#icon-reserva"></use></svg>
          <p style="font-family: var(--font-display); font-size: 22px; font-weight: 800; margin: 0 0 4px;">RONDA</p>
          <p style="font-size: 12px; color: var(--humo); text-transform: uppercase; letter-spacing: 0.1em;">Ingresaste al Bar Correctamente</p>
          
          <div class="reserva" style="margin-top: 15px; text-align: left; background: var(--papel); color: var(--tinta);">
            <p class="res-tit">RONDA</p>
            <p class="res-sub">Sala #${this.currentEvent.id.toUpperCase()}</p>
            <div class="kv"><span>Usuario</span><b>${Auth.currentUser.name}</b></div>
            <div class="kv"><span>Lobby Estado</span><b>Confirmado y Esperando</b></div>
            <div class="rule"></div>
            <p class="res-pie" style="margin-top: 5px;">El anfitrión arrancará la primera ronda pronto.</p>
          </div>
        </div>
      `;
    } else if (match) {
      const partner = match.p1.uid === Auth.currentUser.uid ? match.p2 : match.p1;
      html += `
        <div class="noche-card ok">
          <div class="ronda-head" style="margin-bottom: 15px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg class="icon-svg" style="color: var(--luz);"><use href="#icon-mesa"></use></svg>
              <span class="ronda-n">Ronda ${this.currentEvent.currentRound}</span>
            </div>
            <span class="chip ambar">Cita Activa</span>
          </div>
          
          <div class="frente" style="margin: 10px 0;">
            <h4 style="font-family: var(--font-display); font-size: 28px; margin: 0 0 4px;">${partner.name}</h4>
            <p style="margin: 0; color: var(--humo); font-size: 13px;">Te espera en la <b>MESA ${match.tableId}</b></p>
          </div>
          
          <div style="margin: 20px 0; text-align: center;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 5px;">
              <svg class="icon-svg" style="color: var(--luz);"><use href="#icon-cronometro"></use></svg>
              <span style="font-size: 11px; text-transform: uppercase; color: var(--humo); letter-spacing: 0.1em;">Tiempo restante</span>
            </div>
            <h1 id="match-timer" style="font-family: var(--font-mono); font-size: 48px; color: var(--luz); margin: 0; font-variant-numeric: tabular-nums;">05:00</h1>
          </div>
          
          <div class="acciones" style="flex-direction: column;">
            <div style="display: flex; gap: 10px; margin-bottom: 10px; width: 100%;">
              <button id="btn-vote-no" class="btn" style="flex: 1; border-color: var(--vino); color: var(--vino);" data-target="${partner.uid}">No</button>
              <button id="btn-vote-yes" class="btn si" style="flex: 1;" data-target="${partner.uid}">Sí</button>
            </div>
            <button id="btn-safeword" class="btn" style="border-color: var(--vino); color: var(--vino); width: 100%; font-weight: 700; font-size: 11px;">⚠️ Solicitar Asistencia Discreta</button>
          </div>
        </div>
      `;
      // Iniciar timer
      setTimeout(() => this.startTimer(300), 100);
    } else {
      this.stopTimer();
      // Descanso en Barra (Mesa fantasma)
      html += `
        <div class="noche-card escaso" style="text-align: center; padding: 25px 15px;">
          <svg class="icon-svg" style="color: var(--luz); width: 36px; height: 36px; margin-bottom: 12px;"><use href="#icon-chip"></use></svg>
          <h3 style="font-family: var(--font-display); font-size: 22px; margin-bottom: 6px;">Ronda de Descanso</h3>
          <p style="color: var(--humo); font-size: 13px; max-width: 250px; margin: 0 auto 15px;">
            Te toca descansar esta ronda. Pide una bebida en la barra y recarga energías.
          </p>
          <div class="aviso" style="margin: 0;">
            <b>Mesa de Espera:</b> Ve a la barra. Te reincorporas la próxima ronda.
          </div>
        </div>
      `;
    }

    // Inyectar sección de NFTs
    html += this.renderNFTsSection();
    container.innerHTML = html;
    
    const safeWordBtn = document.getElementById('btn-safeword');
    if (safeWordBtn) {
      safeWordBtn.addEventListener('click', () => this.triggerSafeWord());
    }

    const btnVoteYes = document.getElementById('btn-vote-yes');
    const btnVoteNo = document.getElementById('btn-vote-no');
    if (btnVoteYes && btnVoteNo) {
      btnVoteYes.addEventListener('click', () => this.handleVote(btnVoteYes.getAttribute('data-target'), true));
      btnVoteNo.addEventListener('click', () => this.handleVote(btnVoteNo.getAttribute('data-target'), false));
    }

    const linkWalletBtn = document.getElementById('btn-link-wallet');
    if (linkWalletBtn) {
      linkWalletBtn.addEventListener('click', async () => {
        const wallet = prompt("Ingresa tu dirección de Wallet Polygon (0x...):");
        if (wallet && wallet.startsWith("0x") && wallet.length === 42) {
          Auth.currentUser.wallet_address = wallet;
          await DB.saveUser(Auth.currentUser);
          this.renderClientView();
          alert("✓ Wallet vinculada exitosamente.");
        } else if (wallet) {
          alert("Dirección de Wallet inválida. Debe comenzar con 0x y tener 42 caracteres.");
        }
      });
    }
  }
}

export const ClientApp = new ClientAppService();
