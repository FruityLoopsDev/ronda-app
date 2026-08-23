// seed.js: Poblar la base de datos en memoria para el modo DEMO

if (window.RondaConfig.isDemo) {
  console.log("Poblando base de datos en memoria (Modo Demo)...");

  const demoUsers = [
    { uid: 'u1', name: 'Juan Pérez', role: 'client', gender: 'M', orientation: 'F', age: 28 },
    { uid: 'u2', name: 'María Gómez', role: 'client', gender: 'F', orientation: 'M', age: 26 },
    { uid: 'u3', name: 'Carlos Díaz', role: 'client', gender: 'M', orientation: 'F', age: 30 },
    { uid: 'u4', name: 'Ana Silva', role: 'client', gender: 'F', orientation: 'M', age: 27 },
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
  demoUsers.forEach(u => window.DB.saveUser(u));
  window.DB.memoryDb.venues['v1'] = demoVenue;
  window.DB.saveEvent(demoEvent);

  console.log("Base de datos poblada.", window.DB.memoryDb);
}
