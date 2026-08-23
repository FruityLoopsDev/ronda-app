// config.js agrupa la carga de dependencias para el MVP en Vanilla JS sin bundler

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initConfig() {
  await loadScript('/js/firebase-config.js');
  await loadScript('/js/db.js');
  await loadScript('/js/seed.js');
  await loadScript('/js/auth.js');
  await loadScript('/js/verification.js');
  await loadScript('/js/ronda-core.js');
  await loadScript('/js/bar.js');
  await loadScript('/js/client.js');
  await loadScript('/js/matches.js');
  await loadScript('/js/nft-config.js');
  await loadScript('/js/nft-utils.js');
  console.log("Configuración inicial cargada.");
}

// Inicia la carga
initConfig();
