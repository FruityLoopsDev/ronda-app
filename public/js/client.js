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

    container.innerHTML = html;
    
    const safeWordBtn = document.getElementById('btn-safeword');
    if (safeWordBtn) {
      safeWordBtn.addEventListener('click', () => this.triggerSafeWord());
    }
  }
}

window.ClientApp = new ClientApp();
