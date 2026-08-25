import { DB } from './db.js';
import { RondaConfig } from './firebase-config.js';

// seed.js: Poblar la base de datos en memoria para el modo DEMO

if (RondaConfig.isDemo) {
  console.log("Poblando base de datos en memoria (Modo Demo)...");

  const demoUsers = [
    { uid: 'u1', name: 'Juan Pérez', role: 'client', gender: 'M', orientation: 'F', age: 28, wallet_address: '0x111', nfts: [] },
    { uid: 'u2', name: 'María Gómez', role: 'client', gender: 'F', orientation: 'M', age: 26, wallet_address: '0x222', nfts: [] },
    { uid: 'u3', name: 'Carlos Díaz', role: 'client', gender: 'M', orientation: 'F', age: 30, wallet_address: '0x333', nfts: [] },
    { uid: 'u4', name: 'Ana Silva', role: 'client', gender: 'F', orientation: 'M', age: 27, wallet_address: '0x444', nfts: [] },
    { uid: 'u5', name: 'Luis Martínez', role: 'client', gender: 'M', orientation: 'F', age: 32, wallet_address: '0x555', nfts: [] },
    { uid: 'u6', name: 'Camila Rojas', role: 'client', gender: 'F', orientation: 'M', age: 25, wallet_address: '0x666', nfts: [] },
    { uid: 'u7', name: 'Javier Castro', role: 'client', gender: 'M', orientation: 'F', age: 29, wallet_address: '0x777', nfts: [] },
    { uid: 'u8', name: 'Valentina Soto', role: 'client', gender: 'F', orientation: 'M', age: 28, wallet_address: '0x888', nfts: [] },
    { uid: 'u9', name: 'Andrés López', role: 'client', gender: 'M', orientation: 'F', age: 31, wallet_address: '0x999', nfts: [] },
    { uid: 'u10', name: 'Sofía Vargas', role: 'client', gender: 'F', orientation: 'M', age: 26, wallet_address: '0xAAA', nfts: [] },
    { uid: 'u11', name: 'Diego Ríos', role: 'client', gender: 'M', orientation: 'F', age: 34, wallet_address: '0xBBB', nfts: [] },
    { uid: 'u12', name: 'Laura Medina', role: 'client', gender: 'F', orientation: 'M', age: 29, wallet_address: '0xCCC', nfts: [] },
    { uid: 'u13', name: 'Daniel Ortiz', role: 'client', gender: 'M', orientation: 'M', age: 28, wallet_address: '0xDDD', nfts: [] },
    { uid: 'u14', name: 'Martín Paredes', role: 'client', gender: 'M', orientation: 'M', age: 30, wallet_address: '0xEEE', nfts: [] },
    { uid: 'u15', name: 'Elena Torres', role: 'client', gender: 'F', orientation: 'F', age: 27, wallet_address: '0xFFF', nfts: [] },
    { uid: 'u16', name: 'Gabriela Ruiz', role: 'client', gender: 'F', orientation: 'F', age: 29, wallet_address: '0x1A1', nfts: [] },
    { uid: 'user_camila_demo', name: 'Camila (28) · Arquitecta', role: 'client', gender: 'F', orientation: 'M', age: 28, wallet_address: '0x1B1', nfts: [] },
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
    status: 'waiting',
    participants: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u13', 'u14', 'u15', 'u16', 'user_camila_demo'],
    tables: 8,
    currentRound: 0
  };

  // Guardar en DB simulada
  demoUsers.forEach(u => DB.saveUser(u));
  DB.memoryDb.venues['v1'] = demoVenue;
  DB.saveEvent(demoEvent);

  console.log("Base de datos poblada.", DB.memoryDb);
}
