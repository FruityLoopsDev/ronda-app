// scripts/register-proof.js — Registro de prueba de existencia (RESERVA)
//
// Propósito: generar keccak256 del invention disclosure (o cualquier archivo) y,
// SOLO si se configuran credenciales/gas/contrato, registrarlo on-chain en
// ProvenanceRegistry (Polygon). Por defecto está EN RESERVA: solo imprime el hash
// y la fecha, sin desplegar ni publicar nada.
//
// Uso:
//   node scripts/register-proof.cjs                                   # modo reserva (hash)
//   RONDA_PRIVATE_KEY=0x... POLYGON_RPC=https://polygon-rpc.com \
//   REGISTRY_ADDRESS=0x... node scripts/register-proof.cjs           # registrar on-chain

const fs = require('fs');
const path = require('path');
const { keccak256 } = require('js-sha3');

const file = process.argv[2] || path.join(__dirname, '..', 'docs', 'invention-disclosure-mem-rr-v2.md');
const label = process.argv[3] || path.basename(file);

const content = fs.readFileSync(file, 'utf8');
const hash = '0x' + keccak256(content);

console.log('=== Prueba de existencia (RESERVA) ===');
console.log('Archivo   :', file);
console.log('Etiqueta  :', label);
console.log('Hash      :', hash);
console.log('Fecha     :', new Date().toISOString());

const PRIVATE_KEY = process.env.RONDA_PRIVATE_KEY;
const RPC = process.env.POLYGON_RPC;
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS;

if (!PRIVATE_KEY || !RPC || !REGISTRY_ADDRESS) {
  console.log('\n[Reserva] No se registró on-chain. El hash queda solo como evidencia local.');
  console.log('Para activar el registro en Polygon:');
  console.log('  RONDA_PRIVATE_KEY=0x... POLYGON_RPC=https://polygon-rpc.com REGISTRY_ADDRESS=0x... node scripts/register-proof.cjs');
  process.exit(0);
}

// --- Ruta on-chain (opcional, requiere ethers instalado y contrato desplegado) ---
(async () => {
  let ethers;
  try {
    ethers = require('ethers');
  } catch (e) {
    console.error('Error: ethers no está instalado. `npm i ethers` para registrar on-chain.');
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const abi = ['function record(bytes32 _hash, string calldata _label) external returns (uint256 id)'];
  const registry = new ethers.Contract(REGISTRY_ADDRESS, abi, wallet);

  const tx = await registry.record(hash, label);
  console.log('\nRegistrando en', REGISTRY_ADDRESS, '· tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('✓ Confirmado en bloque', receipt.blockNumber, '· timestamp', new Date().toISOString());
  process.exit(0);
})().catch((e) => {
  console.error('Error registrando on-chain:', e.message || e);
  process.exit(1);
});
