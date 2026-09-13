const fs = require('fs');
const path = require('path');

const logPath = 'C:/Users/Cesar Dla Croix/.gemini/antigravity-ide/brain/ad21c011-e54d-4d24-80b5-4007b590e347/.system_generated/tasks/task-313.log';
const log = fs.readFileSync(logPath, 'utf8');
const lines = log.split(/\r?\n/);
let qrSets = [];
let current = [];
for (let line of lines) {
  if (line.includes('Open the WhatsApp app, go to Linked Devices, then scan this QR:')) {
    if (current.length > 0) qrSets.push(current);
    current = [];
  } else if (line.includes('▄') || line.includes('█') || line.includes('▀')) {
    current.push(line);
  }
}
if (current.length > 0) qrSets.push(current);
const lastQr = qrSets[qrSets.length - 1];

if (!lastQr || lastQr.length === 0) {
  console.error('No QR found');
  process.exit(1);
}

const heightChars = lastQr.length;
const widthChars = Math.max(...lastQr.map(l => l.length));

const grid = [];
for (let y = 0; y < heightChars; y++) {
  const line = lastQr[y];
  const rowTop = [];
  const rowBottom = [];
  for (let x = 0; x < widthChars; x++) {
    const ch = line[x] || ' ';
    rowTop.push((ch === '█' || ch === '▀') ? 1 : 0);
    rowBottom.push((ch === '█' || ch === '▄') ? 1 : 0);
  }
  grid.push(rowTop);
  grid.push(rowBottom);
}

const totalRows = grid.length;
const totalCols = widthChars;

const cellSize = 8;
const margin = 32;
const svgWidth = totalCols * cellSize + margin * 2;
const svgHeight = totalRows * cellSize + margin * 2;

let rects = [];
for (let y = 0; y < totalRows; y++) {
  for (let x = 0; x < totalCols; x++) {
    if (grid[y][x] === 1) {
      rects.push(`<rect x="${margin + x * cellSize}" y="${margin + y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`);
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="380" height="380" style="display:block;">
  <rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff" rx="16" />
  ${rects.join('\n  ')}
</svg>`;

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>WhatsApp Web QR — RONDA OpenClaw</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #030712 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f8fafc;
      padding: 24px;
    }
    .card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(16px);
      border-radius: 28px;
      padding: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      text-align: center;
      max-width: 480px;
      width: 100%;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(37, 211, 102, 0.12);
      color: #25d366;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 9999px;
      border: 1px solid rgba(37, 211, 102, 0.25);
      margin-bottom: 16px;
    }
    .badge::before {
      content: "";
      width: 8px;
      height: 8px;
      background: #25d366;
      border-radius: 50%;
      box-shadow: 0 0 10px #25d366;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0 0 24px 0;
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.5;
    }
    .qr-frame {
      padding: 16px;
      background: #ffffff;
      border-radius: 24px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
      margin-bottom: 24px;
    }
    .steps {
      text-align: left;
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 18px 22px;
      border-radius: 16px;
      width: 100%;
    }
    .steps ol {
      margin: 0;
      padding-left: 20px;
      color: #cbd5e1;
      font-size: 13px;
      line-height: 1.8;
    }
    .steps li b {
      color: #ffffff;
    }
    .footer-note {
      margin-top: 16px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">OpenClaw WhatsApp Concierge</div>
    <h1>Escanea el código QR</h1>
    <p>Vincula tu cuenta de WhatsApp para activar el agente VIP de RONDA.</p>
    <div class="qr-frame">
      ${svg}
    </div>
    <div class="steps">
      <ol>
        <li>Abre <b>WhatsApp</b> en tu celular.</li>
        <li>Ve a <b>Ajustes / Configuración</b> &gt; <b>Dispositivos vinculados</b>.</li>
        <li>Toca <b>Vincular un dispositivo</b> y apunta la cámara a la pantalla.</li>
      </ol>
    </div>
    <div class="footer-note">RONDA Eventos · FFF Round · OpenClaw 2026.9.2</div>
  </div>
</body>
</html>`;

const outPath = path.resolve('c:/Users/Cesar Dla Croix/Desktop/ronda-app/whatsapp-qr.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('SUCCESS: Generated ' + outPath);
