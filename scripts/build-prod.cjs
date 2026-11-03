#!/usr/bin/env node
/**
 * build-prod.cjs — Build de producción RONDA.
 *
 * Fuerza VITE_IS_DEMO=false (R1: el modo demo es el default del código; un
 * build sin la variable correría con BD en memoria y checkout simulado).
 *
 * Uso: npm run build:prod
 */
const { spawnSync } = require('child_process');

// Puerta de integridad: aborta el publish si una página quedó con prosa pegada
// antes del doctype (modo quirks) o apunta a assets inexistentes.
// Nace del incidente partners.html (informe pegado sobre el HTML).
const gate = spawnSync('node scripts/check-html-integrity.cjs', {
  stdio: 'inherit',
  shell: true,
});
if (gate.status !== 0) {
  console.error('\n✗ Build abortado: integridad HTML.');
  process.exit(gate.status ?? 1);
}

// shell:true con comando en string: resuelve npx(.cmd) vía PATH en ambas plataformas.
const r = spawnSync('npx vite build', {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_IS_DEMO: 'false' },
});
process.exit(r.status ?? 1);
