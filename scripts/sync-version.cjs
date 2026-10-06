#!/usr/bin/env node
/**
 * scripts/sync-version.cjs
 * Sincroniza automáticamente la versión de package.json hacia src/version.ts
 * Se ejecuta automáticamente en "prebuild" o mediante "npm run bump".
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const versionTsPath = path.join(rootDir, 'src', 'version.ts');

if (!fs.existsSync(pkgPath)) {
  console.error('❌ No se encontró package.json en:', pkgPath);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version || '2.3.0';
const year = new Date().getFullYear();

const tsContent = `/**
 * src/version.ts
 * Archivo autogenerado por scripts/sync-version.cjs a partir de package.json.
 * NO EDITAR MANUALMENTE.
 */
export const APP_VERSION = 'v${version}-prod';
export const APP_VERSION_RAW = '${version}';
export const APP_RELEASE_YEAR = ${year};
export const APP_COPYRIGHT = 'RONDA System © ${year}';
export const APP_MADE_IN = 'Hecho por amor ❤️ a Colombia';
`;

fs.writeFileSync(versionTsPath, tsContent, 'utf8');
console.log(`✅ [sync-version] Sincronizado src/version.ts con versión v${version}-prod (${year})`);
