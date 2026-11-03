#!/usr/bin/env node
/**
 * check-html-integrity.cjs — Puerta de integridad para las páginas publicadas.
 *
 * Nace de dos incidentes reales en partners.html:
 *   1. Se pegó un informe en prosa ANTES del `<!DOCTYPE html>`: el navegador
 *      entraba en modo quirks y renderizaba el texto como banda visible.
 *   2. El HTML apuntaba a `/assets/img/tl-*.jpg`, imágenes que nunca se
 *      subieron: tarjetas del cronograma en negro (404 silencioso).
 *
 * Reglas que verifica:
 *   A. El primer token no-blanco de cada HTML es `<!DOCTYPE html>`.
 *   B. No hay texto suelto antes del doctype (prosa pegada).
 *   C. Toda referencia `/assets/...` o `/models/...` existe en `public/`.
 *   D. Hay exactamente un `<html>` y un `</html>`.
 *
 * Uso:
 *   node scripts/check-html-integrity.cjs          # modo gate (exit 1 si falla)
 *   node scripts/check-html-integrity.cjs --warn   # solo reporta (exit 0)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const WARN_ONLY = process.argv.includes('--warn');

/** Páginas publicadas: HTML de la raíz + test/face-verify.html */
function collectPages() {
  const pages = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(ROOT, f));
  const faceVerify = path.join(ROOT, 'test', 'face-verify.html');
  if (fs.existsSync(faceVerify)) pages.push(faceVerify);
  return pages;
}

function existsInPublic(ref) {
  const clean = ref.split('?')[0].split('#')[0];
  const rel = clean.replace(/^\//, '');
  return fs.existsSync(path.join(PUBLIC, rel));
}

function checkPage(file) {
  const problems = [];
  const html = fs.readFileSync(file, 'utf8');
  const name = path.relative(ROOT, file);

  // A + B — el archivo debe arrancar con el doctype.
  if (!/^\uFEFF?\s*<!DOCTYPE html>/i.test(html)) {
    const head = html.trimStart().slice(0, 80).replace(/\s+/g, ' ');
    problems.push(
      `no empieza con <!DOCTYPE html> (rompe el modo estándar del navegador). Inicio: "${head}..."`
    );
  } else {
    const before = html.slice(0, html.search(/<!DOCTYPE html>/i));
    if (before.replace(/^\uFEFF/, '').trim().length > 0) {
      problems.push('hay texto suelto antes del <!DOCTYPE html>');
    }
  }

  // D — estructura mínima. Se evalúa sobre el marcado, no sobre plantillas JS
  // (invest.html escribe un documento completo dentro de un template literal
  // para la ventana de impresión: eso no es un segundo <html> real).
  const markup = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const openHtml = (markup.match(/<html[\s>]/gi) || []).length;
  const closeHtml = (markup.match(/<\/html>/gi) || []).length;
  if (openHtml !== 1) problems.push(`<html> aparece ${openHtml} veces`);
  if (closeHtml !== 1) problems.push(`</html> aparece ${closeHtml} veces`);

  // C — assets locales existentes.
  const refs = new Set();
  const patterns = [
    /(?:src|href|poster)\s*=\s*["'](\/(?:assets|models)\/[^"']+)["']/gi,
    /url\(\s*["']?(\/(?:assets|models)\/[^"')\s]+)["']?\s*\)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) refs.add(m[1]);
  }
  for (const ref of refs) {
    if (!existsInPublic(ref)) problems.push(`falta el asset ${ref}`);
  }

  return { name, problems, assetCount: refs.size };
}

const pages = collectPages();
let failures = 0;
let totalAssets = 0;

console.log('── Integridad HTML ────────────────────────────────────────');
for (const page of pages) {
  const { name, problems, assetCount } = checkPage(page);
  totalAssets += assetCount;
  if (problems.length === 0) {
    console.log(`  OK    ${name}  (${assetCount} assets locales verificados)`);
    continue;
  }
  failures += 1;
  console.log(`  FALLA ${name}`);
  for (const p of problems) console.log(`        ✗ ${p}`);
}
console.log('───────────────────────────────────────────────────────────');

if (failures > 0) {
  console.log(
    `${failures} página(s) con problemas. ${WARN_ONLY ? 'Reporte informativo (--warn).' : 'Build abortado.'}`
  );
  if (!WARN_ONLY) process.exit(1);
} else {
  console.log(`Todo limpio: ${pages.length} páginas, ${totalAssets} assets locales.`);
}
