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
