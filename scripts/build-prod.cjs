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

// shell:true con comando en string: resuelve npx(.cmd) vía PATH en ambas plataformas.
const r = spawnSync('npx vite build', {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_IS_DEMO: 'false' },
});
process.exit(r.status ?? 1);
