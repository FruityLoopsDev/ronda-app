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

  // Helper para obtener referencias a los servicios de Firebase de forma tardía
  _getFirestore() {
    return window.RondaServices.db;
  }

  // --- Usuarios ---
  async getUser(userId) {
    if (this.isDemo) {
      return this.memoryDb.users[userId] || null;
    }
    const { doc, getDoc } = window.firebaseModules;
    const docRef = doc(this._getFirestore(), 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  async saveUser(user) {
    if (this.isDemo) {
      this.memoryDb.users[user.uid] = user;
      return user;
    }
    const { doc, setDoc } = window.firebaseModules;
    const docRef = doc(this._getFirestore(), 'users', user.uid);
    await setDoc(docRef, user, { merge: true });
    return user;
  }

  // --- Eventos / Salas ---
  async getEvent(eventId) {
    if (this.isDemo) {
      return this.memoryDb.events[eventId] || null;
    }
    const { doc, getDoc } = window.firebaseModules;
    const docRef = doc(this._getFirestore(), 'events', eventId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }
  
  async saveEvent(event) {
    if (this.isDemo) {
      this.memoryDb.events[event.id] = event;
      return event;
    }
    const { doc, setDoc } = window.firebaseModules;
    const docRef = doc(this._getFirestore(), 'events', event.id);
    await setDoc(docRef, event, { merge: true });
    return event;
  }

  // Finaliza el evento y emite los NFTs correspondientes
  async confirmarSala(eventId, usersConfirmed) {
    console.log(`[DB] Confirmando sala para el evento: ${eventId}...`);
    
    let event;
    if (this.isDemo) {
      event = this.memoryDb.events[eventId];
    } else {
      event = await this.getEvent(eventId);
    }
    
    if (!event) return null;
    
    event.status = 'finished';
    event.participants = usersConfirmed;
    
    // Emitir NFTs a cada usuario confirmado
    for (const userId of usersConfirmed) {
      const user = await this.getUser(userId);
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
              
              // Si no es demo, persistir también la colección secundaria en Firestore
              if (!this.isDemo) {
                const { collection, addDoc } = window.firebaseModules;
                const dbInstance = this._getFirestore();
                await addDoc(collection(dbInstance, 'events', eventId, 'nfts'), {
                  userId,
                  wallet: user.wallet_address,
                  tokenId: mintResult.tokenId,
                  transactionHash: mintResult.transactionHash,
                  ipfsHash: ipfsResult.ipfsHash,
                  mintedAt: new Date()
                });
              }
              
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

  // Permite escuchar cambios en tiempo real
  subscribeToEvent(eventId, callback) {
    if (this.isDemo) {
      // Simula una suscripción en tiempo real devolviendo un mock event tras 1s
      setTimeout(() => {
        const event = this.memoryDb.events[eventId];
        if (event) callback(event);
      }, 1000);
      return () => { console.log('Unsubscribed'); };
    }
    
    const { doc, onSnapshot } = window.firebaseModules;
    const docRef = doc(this._getFirestore(), 'events', eventId);
    
    // Suscripción real de Firestore
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      }
    }, (error) => {
      console.error("Error en suscripción de Firestore:", error);
    });
    
    return unsubscribe;
  }
}

window.DB = new DatabaseInterface();
