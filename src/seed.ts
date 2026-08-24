import { DB } from './db.js';
import { RondaConfig } from './firebase-config.js';

// seed.js: Poblar la base de datos en memoria para el modo DEMO

if (RondaConfig.isDemo) {
  console.log("Poblando base de datos en memoria (Modo Demo)...");

  const demoUsers = [
    { uid: 'u1', name: 'Juan Pérez', role: 'client', gender: 'M', orientation: 'F', age: 28, wallet_address: '0x1111111111111111111111111111111111111111', nfts: [] },
    { uid: 'u2', name: 'María Gómez', role: 'client', gender: 'F', orientation: 'M', age: 26, wallet_address: '0x2222222222222222222222222222222222222222', nfts: [] },
    { uid: 'u3', name: 'Carlos Díaz', role: 'client', gender: 'M', orientation: 'F', age: 30, wallet_address: '0x3333333333333333333333333333333333333333', nfts: [] },
    { uid: 'u4', name: 'Ana Silva', role: 'client', gender: 'F', orientation: 'M', age: 27, wallet_address: '0x4444444444444444444444444444444444444444', nfts: [] },
    { uid: 'admin1', name: 'Admin Bar Central', role: 'admin', venueId: 'v1' }
  ];

  const demoVenue = {
    id: 'v1',
    name: 'Bar Central Bogotá',
    address: 'Zona T',
    capacity: 50
  };

  const demoEvent = {
    id: 'e1',
    venueId: 'v1',
    status: 'waiting', // waiting, active, finished
    participants: ['u1', 'u2', 'u3', 'u4'],
    tables: 2,
    currentRound: 0
  };

  // Guardar en DB simulada
  demoUsers.forEach(u => DB.saveUser(u));
  DB.memoryDb.venues['v1'] = demoVenue;
  DB.saveEvent(demoEvent);

  console.log("Base de datos poblada.", DB.memoryDb);
}
