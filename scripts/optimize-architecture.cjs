const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');
const cssPath = path.join(rootDir, 'public', 'css', 'styles.css');

// 1. Leer index.html y styles.css
let indexHtml = fs.readFileSync(indexPath, 'utf8');
let currentCss = fs.readFileSync(cssPath, 'utf8');

// 2. Extraer el bloque <style>...</style>
const styleStartTag = '<style>';
const styleEndTag = '</style>';

const startIndex = indexHtml.indexOf(styleStartTag);
const endIndex = indexHtml.indexOf(styleEndTag);

if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
  console.error('No se pudo encontrar el bloque <style>...</style> en index.html');
  process.exit(1);
}

const embeddedCss = indexHtml.substring(startIndex + styleStartTag.length, endIndex).trim();

// 3. Estilos adicionales para PIN Unificado accesible y boosters de Waitlist
const additionalComponentStyles = `
/* ==========================================================================
   PIN Unificado Accesible (Teclado Móvil Transparente)
   ========================================================================== */
.pin-unified-container {
  position: relative;
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: center;
  margin-bottom: 14px;
}
.pin-unified-hidden-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  z-index: 10;
  cursor: pointer;
  background: transparent;
  border: none;
  color: transparent;
  font-size: 1px;
}
.pin-digit-box {
  width: 52px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
  background: rgba(22, 16, 27, 0.88);
  border: 1.5px solid var(--linea, rgba(243, 237, 226, 0.16));
  border-radius: 14px;
  color: var(--papel, #f3ede2);
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s, background 0.2s;
  user-select: none;
  pointer-events: none;
}
.pin-unified-container:focus-within .pin-digit-box.current {
  border-color: var(--luz, #F0A830);
  box-shadow: 0 0 16px rgba(240, 168, 48, 0.4);
  transform: translateY(-2px);
  background: rgba(22, 16, 27, 0.98);
}
.pin-digit-box.filled {
  border-color: rgba(240, 168, 48, 0.65);
  color: var(--luz, #F0A830);
}
.pin-digit-box.pin-success {
  border-color: #2E6B54 !important;
  box-shadow: 0 0 16px rgba(46, 107, 84, 0.5) !important;
  color: #79D3AC !important;
}
.pin-digit-box.pin-error {
  border-color: #ff5252 !important;
  box-shadow: 0 0 16px rgba(255, 82, 82, 0.4) !important;
}

/* ==========================================================================
   Booster Card de Lista de Espera (Prioridad VIP)
   ========================================================================== */
.waitlist-boost-card {
  background: rgba(22, 16, 27, 0.75);
  border: 1px dashed rgba(240, 168, 48, 0.4);
  border-radius: 12px;
  padding: 16px;
  text-align: left;
  margin-top: 16px;
  transition: all 0.3s ease;
}
`;

// 4. Escribir a styles.css
const updatedCss = `${currentCss}\n\n/* ==========================================================================\n   Componentes y Modales de RONDA Web App (Extraídos de index.html)\n   ========================================================================== */\n${embeddedCss}\n${additionalComponentStyles}`;

fs.writeFileSync(cssPath, updatedCss, 'utf8');
console.log('✅ public/css/styles.css actualizado con', embeddedCss.split('\n').length, 'líneas de CSS.');

// 5. Reemplazar <style>...</style> en index.html
const replacementTag = '  <!-- Estilos centralizados y cacheados en /css/styles.css y /assets/ronda-tokens.css -->';
indexHtml = indexHtml.substring(0, startIndex) + replacementTag + indexHtml.substring(endIndex + styleEndTag.length);

// 6. Optimizar Google Fonts
const oldFontUrl = 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap';
const newFontUrl = 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,700;1,6..96,400&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap';
indexHtml = indexHtml.replace(oldFontUrl, newFontUrl);

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('✅ index.html aligerado con éxito. <style> monolítico extraído.');
