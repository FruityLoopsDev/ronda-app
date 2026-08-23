// bar.js: Lógica de la Consola del Anfitrión (Bar)

class HostConsole {
  constructor() {
    this.currentEvent = null;
    this.unsubscribe = null;
    
    // Escuchar el login para montar la vista
    window.addEventListener('auth:login', (e) => {
      if (e.detail.role === 'admin') {
        this.initAdminDashboard(e.detail);
      }
    });
    
    window.addEventListener('auth:logout', () => {
      if (this.unsubscribe) this.unsubscribe();
    });
  }

  async initAdminDashboard(adminUser) {
    console.log("Iniciando Dashboard de Anfitrión para:", adminUser.venueId);
    
    // Obtener evento activo
    const eventId = window.RondaConfig.isDemo ? 'e1' : adminUser.activeEventId;
    
    // Suscripción en tiempo real
    this.unsubscribe = window.DB.subscribeToEvent(eventId, (eventData) => {
      this.currentEvent = eventData;
      this.renderDashboard();
    });
  }

  // Simulación de escáner QR
  async simulateQRScan(userId) {
    if (!this.currentEvent) return;
    console.log(`[Escáner QR] Añadiendo usuario ${userId} a la sala...`);
    if (!this.currentEvent.participants.includes(userId)) {
      this.currentEvent.participants.push(userId);
      await window.DB.saveEvent(this.currentEvent);
      
      // Si no es demo o si el usuario existe, actualizar su activeEventId
      const user = await window.DB.getUser(userId);
      if (user) {
        user.activeEventId = this.currentEvent.id;
        await window.DB.saveUser(user);
        console.log(`[Escáner QR] activeEventId actualizado para el usuario: ${userId}`);
      }
    }
  }

  // Generar la próxima ronda usando MEM-RR
  generateNextRound() {
    if (!this.currentEvent) return;
    console.log("Generando nueva ronda...");
    
    // Para simplificar, obtenemos los objetos de usuario
    // En producción, esto se haría en una Cloud Function
    const participantsObjs = this.currentEvent.participants.map(uid => window.DB.memoryDb.users[uid]).filter(u => u);
    
    const matches = window.RondaEngine.generateNextRound(participantsObjs);
    
    this.currentEvent.currentRound += 1;
    this.currentEvent.activeMatches = matches;
    window.RondaEngine.recordRound(matches); // Guardar historial
    
    window.DB.saveEvent(this.currentEvent);
    this.renderDashboard();
    console.log(`Ronda ${this.currentEvent.currentRound} iniciada. Matches:`, matches);
  }

  // Finalizar evento y emitir NFTs
  async finalizarEvento() {
    if (!this.currentEvent) return;
    if (confirm("¿Estás seguro de que deseas finalizar la noche? Esto emitirá los NFTs de asistencia a todos los participantes.")) {
      console.log("[Host] Finalizando evento y emitiendo NFTs...");
      await window.DB.confirmarSala(this.currentEvent.id, this.currentEvent.participants);
      this.renderDashboard();
    }
  }

  renderDashboard() {
    const container = document.getElementById('admin-content');
    if (!container || !this.currentEvent) return;
    
    let html = `
      <div class="bg-white shadow p-4 rounded mb-4">
        <h3 class="text-lg font-bold">Estado de la Sala: ${this.currentEvent.status.toUpperCase()}</h3>
        <p>Asistentes: ${this.currentEvent.participants.length}</p>
        <p>Ronda Actual: ${this.currentEvent.currentRound}</p>
      </div>
      
      <div class="flex space-x-2 mb-4">
        <button id="btn-scan" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Scan QR Entrada (Simular)</button>
        <button id="btn-next-round" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Iniciar Próxima Ronda</button>
        <button id="btn-end-event" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Finalizar Noche (NFT)</button>
      </div>
      
      <div class="bg-gray-100 p-4 rounded">
        <h4 class="font-bold mb-2">Mesas Activas (Ronda ${this.currentEvent.currentRound})</h4>
        <ul id="active-tables-list" class="list-disc pl-5">
    `;

    if (this.currentEvent.activeMatches && this.currentEvent.activeMatches.length > 0) {
      this.currentEvent.activeMatches.forEach(m => {
        html += `<li>${m.tableId}: ${m.p1.name} ❤️ ${m.p2.name} (Afinidad: ${m.weight.toFixed(2)})</li>`;
      });
    } else {
      html += `<li>Esperando iniciar la ronda o evento finalizado.</li>`;
    }

    html += `</ul></div>`;
    
    container.innerHTML = html;
    
    // Asignar listeners
    document.getElementById('btn-scan').addEventListener('click', async () => {
      const clientUid = prompt("Ingresa el UID del cliente a registrar en la sala (deja vacío para simular uno aleatorio):");
      if (clientUid && clientUid.trim() !== "") {
        await this.simulateQRScan(clientUid.trim());
      } else {
        await this.simulateQRScan(`u${Math.floor(Math.random() * 100) + 5}`);
      }
    });
    
    document.getElementById('btn-next-round').addEventListener('click', () => {
      this.generateNextRound();
    });

    document.getElementById('btn-end-event').addEventListener('click', () => {
      this.finalizarEvento();
    });
  }
}

window.HostConsole = new HostConsole();
