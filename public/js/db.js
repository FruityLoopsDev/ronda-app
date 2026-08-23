// db.js: Interfaz de base de datos
// Dependiendo de window.RondaConfig.isDemo, usa el mock en memoria o Firebase real.

class DatabaseInterface {
  constructor() {
    this.isDemo = window.RondaConfig.isDemo;
    this.memoryDb = {
      users: {},
      venues: {},
      events: {},
      matches: {}
    };
  }

  // --- Usuarios ---
  async getUser(userId) {
    if (this.isDemo) {
      return this.memoryDb.users[userId] || null;
    }
    // TODO: Implementar lógica Firebase Real
    return null;
  }

  async saveUser(user) {
    if (this.isDemo) {
      this.memoryDb.users[user.uid] = user;
      return user;
    }
    // TODO: Implementar lógica Firebase Real
    return user;
  }

  // --- Eventos / Salas ---
  async getEvent(eventId) {
    if (this.isDemo) {
      return this.memoryDb.events[eventId] || null;
    }
    // TODO: Implementar lógica Firebase Real
    return null;
  }
  
  async saveEvent(event) {
    if (this.isDemo) {
      this.memoryDb.events[event.id] = event;
      return event;
    }
    return event;
  }

  // Finaliza el evento y emite los NFTs correspondientes
  async confirmarSala(eventId, usersConfirmed) {
    console.log(`[DB] Confirmando sala para el evento: ${eventId}...`);
    
    if (this.isDemo) {
      const event = this.memoryDb.events[eventId];
      if (!event) return null;
      
      event.status = 'finished';
      event.participants = usersConfirmed;
      
      // Emitir NFTs a cada usuario confirmado
      for (const userId of usersConfirmed) {
        const user = this.memoryDb.users[userId];
        if (user && user.wallet_address) {
          try {
            // 1. Simular subida a IPFS
            const eventInfoForNFT = {
              eventId: event.id,
              local: { nombre: 'Bar Central Bogotá', zona: 'Zona T' },
              fecha: new Date().toLocaleDateString(),
              matchesCount: event.activeMatches ? event.activeMatches.length : 0
            };
            
            const ipfsResult = await window.NFTUtils.uploadMetadataToPinata(eventInfoForNFT, user.role);
            
            if (ipfsResult.success) {
              // 2. Simular acuñación en Polygon
              const mintResult = await window.NFTUtils.mintNFT(user.wallet_address, event.id, ipfsResult.ipfsHash);
              
              if (mintResult.success) {
                // 3. Añadir el NFT al perfil de usuario
                if (!user.nfts) user.nfts = [];
                user.nfts.push({
                  token_id: mintResult.tokenId,
                  evento_nombre: `Ronda #${event.id} — Bar Central`,
                  zona: 'Zona T',
                  fecha: eventInfoForNFT.fecha,
                  image_url: 'https://gateway.pinata.cloud/ipfs/QmZ1Yx4xW3HnyK92Uptg9v1iL1p2y6z3w5V7y8e9rT5y3m', // Mock image
                  transactionHash: mintResult.transactionHash
                });
                
                await this.saveUser(user);
                console.log(`[DB] NFT guardado exitosamente para el usuario ${user.name}`);
              }
            }
          } catch (err) {
            console.error(`[DB] Error mintando NFT para ${user.name}:`, err);
          }
        }
      }
      
      await this.saveEvent(event);
      return event;
    }
    // TODO: Implementación real en Firebase Firestore
    return null;
  }

  // Permite escuchar cambios en tiempo real simulados
  subscribeToEvent(eventId, callback) {
    if (this.isDemo) {
      // Simula una suscripción en tiempo real devolviendo un mock event tras 1s
      setTimeout(() => {
        const event = this.memoryDb.events[eventId];
        if (event) callback(event);
      }, 1000);
      return () => { console.log('Unsubscribed'); };
    }
    // TODO: Firebase Real time (onSnapshot)
    return () => {};
  }
}

window.DB = new DatabaseInterface();
