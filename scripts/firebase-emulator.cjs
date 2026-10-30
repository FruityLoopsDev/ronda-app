#!/usr/bin/env node
/**
 * scripts/firebase-emulator.cjs
 * Helper ligero para gestión y verificación del Firebase Local Emulator Suite.
 * Diseñado para cero desperdicio de tokens y ejecución rápida en Node.js.
 */

const net = require('net');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORTS = [
  { name: 'Firestore', port: 8081, required: true },
  { name: 'Auth', port: 9099, required: true },
  { name: 'Hosting', port: 5002, altPort: 5001, required: false },
  { name: 'Emulator UI', port: 4000, required: false }
];

function checkPort(port, host = '127.0.0.1', timeout = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeout);
    socket.once('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function getStatus() {
  const results = [];
  for (const item of PORTS) {
    let active = await checkPort(item.port);
    let activePort = item.port;
    if (!active && item.altPort) {
      const altActive = await checkPort(item.altPort);
      if (altActive) {
        active = true;
        activePort = item.altPort;
      }
    }
    results.push({ name: item.name, port: activePort, status: active ? 'ONLINE' : 'OFFLINE' });
  }
  return results;
}

async function printStatus() {
  const results = await getStatus();
  console.log('=== FIREBASE LOCAL EMULATOR STATUS ===');
  let allUp = true;
  for (const r of results) {
    const symbol = r.status === 'ONLINE' ? '✅' : '❌';
    console.log(`  ${symbol} ${r.name.padEnd(14)} : Port ${r.port} [${r.status}]`);
    if (r.status !== 'ONLINE' && (r.name === 'Firestore' || r.name === 'Auth')) {
      allUp = false;
    }
  }
  if (allUp) {
    console.log('🚀 Suite lista: UI en http://127.0.0.1:4000');
  } else {
    console.log('⚠️ Algunos servicios requeridos están offline.');
  }
}

async function stopEmulators() {
  console.log('Deteniendo emuladores de Firebase en puertos 8081, 9099, 5002, 5001, 4000...');
  try {
    if (process.platform === 'win32') {
      execSync('powershell -Command "Get-NetTCPConnection -LocalPort 8081, 9099, 5002, 5001, 4000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"', { stdio: 'ignore' });
    } else {
      execSync('lsof -ti:8081,9099,5002,5001,4000 | xargs kill -9 2>/dev/null || true', { stdio: 'ignore' });
    }
    console.log('✅ Emuladores detenidos.');
  } catch (err) {
    console.warn('Aviso al detener procesos:', err.message);
  }
}

async function main() {
  const arg = process.argv[2] || 'status';

  if (arg === 'status') {
    await printStatus();
  } else if (arg === 'stop') {
    await stopEmulators();
    await printStatus();
  } else if (arg === 'check-json') {
    const results = await getStatus();
    console.log(JSON.stringify(results));
  } else {
    console.log(`Uso: node scripts/firebase-emulator.cjs [status|stop|check-json]`);
  }
}

main().catch(console.error);

