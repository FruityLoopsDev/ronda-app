import { DB, Venue } from './db.js';
import { Auth } from './auth.js';
import { RondaConfig } from './firebase-config.js';

export function seedDatabase() {
  if (!RondaConfig.isDemo) return;
  console.log("Poblando Base de Datos...");

  const demoUsers = [
    { uid: 'u1', name: 'Santiago Gómez', role: 'client', gender: 'M', orientation: 'F', age: 29, wallet_address: '0x111', nfts: [] },
    { uid: 'u2', name: 'Mariana Silva', role: 'client', gender: 'F', orientation: 'M', age: 27, wallet_address: '0x222', nfts: [] },
    { uid: 'u3', name: 'Mateo Cardona', role: 'client', gender: 'M', orientation: 'F', age: 31, wallet_address: '0x333', nfts: [] },
    { uid: 'u4', name: 'Valeria Restrepo', role: 'client', gender: 'F', orientation: 'M', age: 26, wallet_address: '0x444', nfts: [] },
    { uid: 'u5', name: 'Nicolás Ruiz', role: 'client', gender: 'M', orientation: 'F', age: 30, wallet_address: '0x555', nfts: [] },
    { uid: 'u6', name: 'Daniela Meza', role: 'client', gender: 'F', orientation: 'M', age: 28, wallet_address: '0x666', nfts: [] },
    { uid: 'u7', name: 'Sebastián Marín', role: 'client', gender: 'M', orientation: 'F', age: 33, wallet_address: '0x777', nfts: [] },
    { uid: 'u8', name: 'Camila Ochoa', role: 'client', gender: 'F', orientation: 'M', age: 25, wallet_address: '0x888', nfts: [] },
    { uid: 'u9', name: 'Alejandro Castro', role: 'client', gender: 'M', orientation: 'F', age: 32, wallet_address: '0x999', nfts: [] },
    { uid: 'u10', name: 'Sofía Herrera', role: 'client', gender: 'F', orientation: 'M', age: 28, wallet_address: '0xAAA', nfts: [] },
    { uid: 'u11', name: 'Diego Ríos', role: 'client', gender: 'M', orientation: 'F', age: 34, wallet_address: '0xBBB', nfts: [] },
    { uid: 'u12', name: 'Laura Medina', role: 'client', gender: 'F', orientation: 'M', age: 29, wallet_address: '0xCCC', nfts: [] },
    { uid: 'u13', name: 'Daniel Ortiz', role: 'client', gender: 'M', orientation: 'M', age: 28, wallet_address: '0xDDD', nfts: [] },
    { uid: 'u14', name: 'Martín Paredes', role: 'client', gender: 'M', orientation: 'M', age: 30, wallet_address: '0xEEE', nfts: [] },
    { uid: 'u15', name: 'Elena Torres', role: 'client', gender: 'F', orientation: 'F', age: 27, wallet_address: '0xFFF', nfts: [] },
    { uid: 'u16', name: 'Gabriela Ruiz', role: 'client', gender: 'F', orientation: 'F', age: 29, wallet_address: '0x1A1', nfts: [] },
    { uid: 'user_camila_demo', name: 'Camila (28) · Arquitecta', role: 'client', gender: 'F', orientation: 'M', age: 28, wallet_address: '0x1B1', nfts: [] },
    { uid: 'admin1', name: 'Admin Bar Central', role: 'admin', venueId: 'v1' }
  ];

  const demoVenue: Venue = {
    id: 'v1',
    name: 'Bar Central Bogotá',
    address: 'Calle 82 # 12-35',
    zone: 'Zona T',
    lat: 4.6664,
    lng: -74.0536,
    status: 'active'
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

seedDatabase();
