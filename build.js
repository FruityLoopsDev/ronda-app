const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const outputFile = path.join(__dirname, 'ronda-artifact.html');

console.log('Construyendo artefacto demo de Ronda...');

try {
  let indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

  // En un build real, aquí concatenaríamos CSS y JS inline para generar un solo archivo HTML,
  // útil para compartir una versión demo sin servidor.
  // Por ahora, solo copiaremos el index.html
  
  fs.writeFileSync(outputFile, indexHtml);
  console.log(`Artefacto construido exitosamente en: ${outputFile}`);
} catch (error) {
  console.error('Error construyendo el artefacto:', error);
}
