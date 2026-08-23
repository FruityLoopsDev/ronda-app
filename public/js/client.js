// client.js: Lógica del Cliente en la App (Participante de RONDA)

class ClientApp {
  constructor() {
    this.currentEvent = null;
    this.unsubscribe = null;
    this.timerInterval = null;
    
    // Escuchar el login para montar la vista
    window.addEventListener('auth:login', (e) => {
      if (e.detail.role === 'client') {
        this.initClientDashboard(e.detail);
      }
    });
    
    window.addEventListener('auth:logout', () => {
      if (this.unsubscribe) this.unsubscribe();
      this.stopTimer();
    });
  }

  async initClientDashboard(clientUser) {
    console.log("Iniciando Dashboard de Cliente para:", clientUser.name);
    
    // Para el MVP asumimos que el usuario está en el evento 'e1' si es demo
    const eventId = window.RondaConfig.isDemo ? 'e1' : clientUser.activeEventId;
    
    if (eventId) {
      this.unsubscribe = window.DB.subscribeToEvent(eventId, (eventData) => {
        this.currentEvent = eventData;
        this.renderClientView();
      });
    } else {
      document.getElementById('client-content').innerHTML = "<p>No estás registrado en ningún evento activo. ¡Usa el escáner del anfitrión en la entrada del bar!</p>";
    }
  }

  // Verifica si el cliente actual está en alguna mesa activa
  getMyCurrentMatch() {
    if (!this.currentEvent || !this.currentEvent.activeMatches) return null;
    const myUid = window.Auth.currentUser.uid;
    return this.currentEvent.activeMatches.find(m => m.p1.uid === myUid || m.p2.uid === myUid);
  }

  triggerSafeWord() {
    console.warn("¡Safe-word activado! Notificando a seguridad y bloqueando al usuario...");
    alert("Hemos notificado discretamente a la seguridad del bar. Quédate donde estás, alguien se acercará pronto.");
    // TODO: En producción, escribir en un nodo de Firestore "alerts"
  }

  startTimer(durationSeconds) {
    this.stopTimer();
    let timeLeft = durationSeconds;
    const el = document.getElementById('match-timer');
    
    this.timerInterval = setInterval(() => {
      if (timeLeft <= 0) {
        this.stopTimer();
        if(el) el.innerText = "¡Tiempo terminado! Espera indicaciones.";
        // Campana simulada
        console.log("DING! Cambio de mesa.");
      } else {
        if(el) {
          const mins = Math.floor(timeLeft / 60);
          const secs = timeLeft % 60;
          el.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Mostrar NFTs en el panel del cliente
  renderNFTsSection() {
    const user = window.Auth.currentUser;
    if (!user) return '';
    
    let nftHtml = `
      <div class="mt-6 bg-white shadow p-4 rounded-lg">
        <h4 class="font-bold text-lg mb-3">🏆 Mis Certificados NFT (Asistencia)</h4>
    `;
    
    if (user.wallet_address) {
      nftHtml += `<p class="text-xs text-gray-500 mb-4">Wallet vinculada: <code class="bg-gray-100 p-1 rounded text-purple-700 font-mono">${user.wallet_address.substring(0,6)}...${user.wallet_address.substring(user.wallet_address.length-4)}</code></p>`;
    } else {
      nftHtml += `
        <div class="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded">
          <p class="text-xs text-yellow-700 mb-2">⚠️ No tienes una Wallet de Polygon vinculada para recibir tus NFTs de asistencia.</p>
          <button id="btn-link-wallet" class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1.5 rounded font-bold transition">Vincular Wallet</button>
        </div>
      `;
    }
    
    if (user.nfts && user.nfts.length > 0) {
      nftHtml += `<div class="grid grid-cols-2 gap-3 mt-2">`;
      user.nfts.forEach(nft => {
        nftHtml += `
          <div class="border border-purple-100 rounded-lg p-3 text-center bg-purple-50/30 shadow-sm">
            <div class="w-full h-20 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-md mb-2 flex items-center justify-center text-3xl shadow">🎫</div>
            <p class="font-bold text-xs truncate text-purple-900">${nft.evento_nombre}</p>
            <p class="text-[9px] text-gray-400 mt-0.5">${nft.fecha} - ${nft.zona}</p>
            <a href="https://opensea.io/assets/matic/${window.NFT_CONFIG.SMART_CONTRACT.ADDRESS}/${nft.token_id}" target="_blank" class="text-[10px] text-purple-600 hover:text-purple-800 hover:underline block mt-2 font-bold">Ver en OpenSea →</a>
          </div>
        `;
      });
      nftHtml += `</div>`;
    } else {
      nftHtml += `<p class="text-xs text-gray-400 text-center py-4">Aún no tienes ningún NFT de asistencia. ¡Participa en un evento para recibir el tuyo!</p>`;
    }
    
    nftHtml += `</div>`;
    return nftHtml;
  }

  renderClientView() {
    const container = document.getElementById('client-content');
    if (!container || !this.currentEvent) return;
    
    let html = `
      <div class="bg-white shadow p-4 rounded mb-4">
        <h3 class="text-lg font-bold">Evento Activo: Ronda ${this.currentEvent.currentRound}</h3>
      </div>
    `;

    const match = this.getMyCurrentMatch();
    
    if (match) {
      const partner = match.p1.uid === window.Auth.currentUser.uid ? match.p2 : match.p1;
      html += `
        <div class="bg-purple-100 border-l-4 border-purple-500 p-4 rounded mb-4">
          <h4 class="font-bold text-purple-800 text-xl text-center">¡Estás en cita!</h4>
          <p class="text-center mt-2 text-lg">Dirígete a la <strong>${match.tableId}</strong></p>
          <p class="text-center mt-1">Conocerás a: <strong>${partner.name}</strong></p>
          <div class="text-center mt-4 text-3xl font-mono" id="match-timer">05:00</div>
        </div>
        
        <button id="btn-safeword" class="w-full bg-red-600 text-white font-bold py-3 rounded mt-4 hover:bg-red-700">⚠️ Necesito Ayuda Discreta</button>
      `;
      // Iniciamos cronómetro visual de 5 minutos
      setTimeout(() => this.startTimer(300), 100); 
    } else {
      this.stopTimer();
      if (this.currentEvent.currentRound > 0) {
        html += `<div class="bg-yellow-100 p-4 rounded text-center">Descansa esta ronda. Toma un trago en la barra y prepárate para la próxima.</div>`;
      } else {
        html += `<div class="bg-gray-100 p-4 rounded text-center">Esperando a que el anfitrión inicie la ronda 1...</div>`;
      }
    }

    // Inyectar sección de NFTs en el Dashboard del cliente
    html += this.renderNFTsSection();

    container.innerHTML = html;
    
    const safeWordBtn = document.getElementById('btn-safeword');
    if (safeWordBtn) {
      safeWordBtn.addEventListener('click', () => this.triggerSafeWord());
    }

    // Listener para vincular Wallet Polygon
    const linkWalletBtn = document.getElementById('btn-link-wallet');
    if (linkWalletBtn) {
      linkWalletBtn.addEventListener('click', async () => {
        const wallet = prompt("Ingresa tu dirección de Wallet Polygon (0x...):");
        if (wallet && wallet.startsWith("0x") && wallet.length === 42) {
          window.Auth.currentUser.wallet_address = wallet;
          await window.DB.saveUser(window.Auth.currentUser);
          this.renderClientView();
          alert("✓ Wallet vinculada exitosamente.");
        } else if (wallet) {
          alert("Dirección de Wallet inválida. Debe comenzar con 0x y tener 42 caracteres.");
        }
      });
    }
  }
}

window.ClientApp = new ClientApp();
