#!/usr/bin/env node
/**
 * scripts/export-campaign-calendar.cjs
 * Genera archivos .ics (iCalendar universal) y .csv (Google Calendar)
 * con todo el cronograma del Día 0 (3 nov 2026) y los 10 días de la campaña
 * cinematográfica "9 HISTORIAS" de RONDA.
 *
 * Uso:
 *   node scripts/export-campaign-calendar.cjs
 *   node scripts/export-campaign-calendar.cjs --open
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'growth', 'estreno');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ICS_PATH = path.join(OUT_DIR, 'ronda-9-historias-calendario.ics');
const CSV_PATH = path.join(OUT_DIR, 'ronda-9-historias-calendario.csv');

// Zona horaria de Bogotá (UTC-5, sin horario de verano)
const TZ = 'America/Bogota';

/**
 * Bloques horarios del Día 0 (Martes 3 de Noviembre de 2026)
 * + Hitos diarios de la campaña (Días 1 a 10)
 */
const EVENTS = [
  // === DÍA 0: MARTES 3 NOV 2026 (HOY) ===
  {
    uid: 'ronda-9h-d0-01@ronda.uno',
    title: '🎬 [RONDA] Kickoff + Guiones Finales y Redirect /estreno',
    start: '2026-11-03T11:00:00',
    end: '2026-11-03T12:00:00',
    location: 'Antigravity IDE / Local Emulator',
    description:
      'Responsables: Antigravity + Cline + Perplexity.\\n' +
      '- Cerrar guion de VO del teaser (15 s) y 9 captions.\\n' +
      '- Configurar redirect /estreno con UTMs en firebase.json.\\n' +
      '- Validar datos de fatiga de scroll con Perplexity.'
  },
  {
    uid: 'ronda-9h-d0-02@ronda.uno',
    title: '🎥 [RONDA] Producción en Google Flow (Ingredientes + Escenas S1–S4)',
    start: '2026-11-03T12:00:00',
    end: '2026-11-03T14:00:00',
    location: 'Google Flow (labs.google/fx/es/tools/flow)',
    description:
      'Responsables: César + Prompts de Antigravity.\\n' +
      '1. Crear Character Ingredients (Rostro H y Rostro M fijos) y Environment Ingredient (Mesa de bar ámbar).\\n' +
      '2. Generar S1 (El scroll azul) -> S2 (Match cut: celular bocabajo a luz ámbar) -> S3 (La campana) -> S4 (El encuentro).\\n' +
      '3. Usar First-to-Last Frame / Extend para cero saltos abruptos.'
  },
  {
    uid: 'ronda-9h-d0-03@ronda.uno',
    title: '🎙️ [RONDA] Grabación de Voice-Over Real (3 tomas)',
    start: '2026-11-03T14:00:00',
    end: '2026-11-03T14:30:00',
    location: 'Nota de voz (Celular)',
    description:
      'Responsable: César.\\n' +
      'Grabar 3 tomas naturales del teaser (15 s):\\n' +
      '"¿Cuántas horas llevas haciendo scroll esta semana? ¿Y a cuántas personas conociste de verdad? Nueve historias. Seis minutos cada una. Cara a cara. Deja de hacer scroll. Empieza una historia."'
  },
  {
    uid: 'ronda-9h-d0-04@ronda.uno',
    title: '✂️ [RONDA] Montaje del Teaser 15s + 3 Piezas Acto I',
    start: '2026-11-03T14:30:00',
    end: '2026-11-03T16:00:00',
    location: 'Google Flow Scenebuilder / CapCut',
    description:
      'Responsable: César.\\n' +
      '- Unir clips S1-S4 con transiciones encadenadas + VO real.\\n' +
      '- Exportar teaser_v1.mp4 (9:16) y las 3 piezas del Acto I (4:5 con zona segura 3:4).'
  },
  {
    uid: 'ronda-9h-d0-05@ronda.uno',
    title: '🍸 [RONDA] Puesta a Punto del Perfil @rondapuntouno',
    start: '2026-11-03T16:00:00',
    end: '2026-11-03T17:00:00',
    location: 'Instagram (@rondapuntouno)',
    description:
      'Responsable: César.\\n' +
      '- Actualizar Nombre: "RONDA · Citas cara a cara en Bogotá".\\n' +
      '- Bio humana + link ronda.uno/estreno.\\n' +
      '- Portadas de Destacados y Canal de Difusión "Detrás de cámaras".'
  },
  {
    uid: 'ronda-9h-d0-06@ronda.uno',
    title: '🛡️ [RONDA] QA de Campaña (Checklist Final)',
    start: '2026-11-03T17:00:00',
    end: '2026-11-03T18:00:00',
    location: 'Antigravity IDE',
    description:
      'Responsable: Antigravity.\\n' +
      '- Cero palabras prohibidas (match, swipe, like, app de citas).\\n' +
      '- Etiqueta de IA de Meta lista.\\n' +
      '- Zona segura 3:4 verificada y UTMs funcionando.'
  },
  {
    uid: 'ronda-9h-d0-07@ronda.uno',
    title: '📲 [RONDA] Seeding Pre-Estreno (30 WhatsApps 1:1)',
    start: '2026-11-03T18:00:00',
    end: '2026-11-03T19:30:00',
    location: 'WhatsApp + Instagram Close Friends',
    description:
      'Responsables: César + ronda-voice-storyteller.\\n' +
      '- Enviar 30 mensajes 1:1 a primeros espectadores.\\n' +
      '- Seguir 50 cuentas ancla de Bogotá (Zona G / Chapinero Alto).'
  },
  {
    uid: 'ronda-9h-d0-08@ronda.uno',
    title: '🔴 [RONDA] LANZAMIENTO EN VIVO — Acto I + Teaser "9 HISTORIAS"',
    start: '2026-11-03T20:00:00',
    end: '2026-11-03T21:00:00',
    location: 'Instagram (@rondapuntouno)',
    description:
      '¡ESTRENO!\\n' +
      '1. Publicar las 3 piezas del Acto I en orden inverso.\\n' +
      '2. Publicar Reel Teaser "Deja de hacer scroll".\\n' +
      '3. Subir Story con cuenta regresiva + encuesta "¿Cuántas horas de scroll llevas hoy?".\\n' +
      '4. Hora dorada: responder comentarios/DMs en < 5 min.'
  },
  {
    uid: 'ronda-9h-d0-09@ronda.uno',
    title: '💼 [RONDA] Alistamiento de LinkedIn + Cierre Día 0',
    start: '2026-11-03T21:00:00',
    end: '2026-11-03T22:00:00',
    location: 'LinkedIn + docs/HISTORIAL_INTERACCIONES.md',
    description:
      'Responsables: César + Antigravity.\\n' +
      '- Dejar listo titular, banner y sección Destacado en LinkedIn.\\n' +
      '- Registrar métricas del Día 0.'
  },

  // === DÍAS 1 A 10 DE LA CAMPAÑA (19:30 - 20:30 HORA PICO BOGOTÁ) ===
  {
    uid: 'ronda-9h-d1@ronda.uno',
    title: '🎬 [RONDA Día 1] Carrusel: "6 min cara a cara vs 3 semanas de chat"',
    start: '2026-11-04T19:30:00',
    end: '2026-11-04T20:30:00',
    location: 'Instagram (@rondapuntouno)',
    description: 'Publicar carrusel de utilidad + compartir resultados reales de la encuesta de horas de scroll en Stories.'
  },
  {
    uid: 'ronda-9h-d2@ronda.uno',
    title: '🎬 [RONDA Día 2] Pósters 1–2 en IG + Post 1 en LinkedIn',
    start: '2026-11-05T19:30:00',
    end: '2026-11-05T20:30:00',
    location: 'Instagram + LinkedIn',
    description:
      '- IG: Publicar Pósters de personajes 1 y 2 con música de bar.\\n' +
      '- LinkedIn (Post 1): "Pasamos la vida haciendo scroll y nunca estuvimos tan solos. Por eso construí RONDA."'
  },
  {
    uid: 'ronda-9h-d3@ronda.uno',
    title: '📵 [RONDA Día 3] Pósters 3–5 + Reto UGC "Celular Bocabajo"',
    start: '2026-11-06T19:30:00',
    end: '2026-11-06T20:30:00',
    location: 'Instagram (@rondapuntouno)',
    description: 'Publicar Pósters 3–5 y activar en Stories el reto de viernes: foto del celular bocabajo en una mesa con amigos etiquetando a @rondapuntouno.'
  },
  {
    uid: 'ronda-9h-d4@ronda.uno',
    title: '🎥 [RONDA Día 4] Estreno del Tráiler Oficial 45s (Escenas S1–S6)',
    start: '2026-11-07T19:30:00',
    end: '2026-11-07T20:30:00',
    location: 'Instagram Reels',
    description: 'Publicar el Tráiler completo de 45s generado en Google Flow con tu voz real. Repostear reacciones en Stories.'
  },
  {
    uid: 'ronda-9h-d5@ronda.uno',
    title: '🎟️ [RONDA Día 5] Pósters 6–8 + Apertura Oficial de Casting',
    start: '2026-11-08T19:30:00',
    end: '2026-11-08T20:30:00',
    location: 'Instagram (@rondapuntouno)',
    description: 'Publicar Pósters 6–8 y sticker de enlace directo a ronda.uno/estreno en Stories.'
  },
  {
    uid: 'ronda-9h-d6@ronda.uno',
    title: '🌟 [RONDA Día 6] Póster 9 ("La novena historia es la tuya") + LinkedIn Post 2',
    start: '2026-11-09T19:30:00',
    end: '2026-11-09T20:30:00',
    location: 'Instagram + LinkedIn',
    description:
      '- IG: Publicar Póster 9 (completa el grid 3x3) + contador de inscritos en Stories.\\n' +
      '- LinkedIn (Post 2): Primeros números de tracción (Building in public).'
  },
  {
    uid: 'ronda-9h-d7@ronda.uno',
    title: '🍸 [RONDA Día 7] Carrusel "Cómo es una noche RONDA minuto a minuto" + Q&A',
    start: '2026-11-10T19:30:00',
    end: '2026-11-10T20:30:00',
    location: 'Instagram (@rondapuntouno)',
    description: 'Publicar carrusel de los 5 actos de la noche y abrir caja de preguntas del fundador en Stories.'
  },
  {
    uid: 'ronda-9h-d8@ronda.uno',
    title: '🛡️ [RONDA Día 8] Reel "Por qué todos llegan verificados" + Video LinkedIn',
    start: '2026-11-11T19:30:00',
    end: '2026-11-11T20:30:00',
    location: 'Instagram + LinkedIn',
    description: 'Publicar Reel de seguridad/verificación y video vertical de 60s del fundador en LinkedIn.'
  },
  {
    uid: 'ronda-9h-d9@ronda.uno',
    title: '🥂 [RONDA Día 9–10] GRAN ESTRENO: Acceso Prioritario al Casting + Post 3 LinkedIn',
    start: '2026-11-12T19:30:00',
    end: '2026-11-12T20:30:00',
    location: 'Instagram + LinkedIn',
    description: 'Anuncio de cierre de primera cohorte del casting / primera noche RONDA + Post 3 en LinkedIn con aprendizajes del lanzamiento.'
  }
];

function toIcsDate(isoLocal) {
  // '2026-11-03T11:00:00' -> '20261103T110000'
  return isoLocal.replace(/[-:]/g, '');
}

function buildIcs(events) {
  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RONDA//Campana 9 Historias//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:RONDA · Lanzamiento 9 HISTORIAS',
    `X-WR-TIMEZONE:${TZ}`,
    'BEGIN:VTIMEZONE',
    `TZID:${TZ}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0500',
    'TZNAME:COT',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART;TZID=${TZ}:${toIcsDate(ev.start)}`,
      `DTEND;TZID=${TZ}:${toIcsDate(ev.end)}`,
      `SUMMARY:${ev.title}`,
      `LOCATION:${ev.location}`,
      `DESCRIPTION:${ev.description}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Recordatorio RONDA 9 HISTORIAS (10 min)',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function csvEscape(str) {
  const clean = String(str).replace(/\\n/g, '\n').replace(/"/g, '""');
  return `"${clean}"`;
}

function buildGoogleCsv(events) {
  const headers = [
    'Subject',
    'Start Date',
    'Start Time',
    'End Date',
    'End Time',
    'All Day Event',
    'Description',
    'Location',
    'Private'
  ];
  const rows = [headers.join(',')];

  for (const ev of events) {
    const [sDate, sTime] = ev.start.split('T');
    const [eDate, eTime] = ev.end.split('T');
    const [sY, sM, sD] = sDate.split('-');
    const [eY, eM, eD] = eDate.split('-');
    rows.push(
      [
        csvEscape(ev.title),
        `${sM}/${sD}/${sY}`,
        sTime.slice(0, 5),
        `${eM}/${eD}/${eY}`,
        eTime.slice(0, 5),
        'False',
        csvEscape(ev.description),
        csvEscape(ev.location),
        'True'
      ].join(',')
    );
  }
  return rows.join('\r\n') + '\r\n';
}

fs.writeFileSync(ICS_PATH, buildIcs(EVENTS), 'utf8');
fs.writeFileSync(CSV_PATH, buildGoogleCsv(EVENTS), 'utf8');

console.log('=== CALENDARIO "9 HISTORIAS" GENERADO ===');
console.log(`  ✅ Archivo iCal (.ics) : ${ICS_PATH}`);
console.log(`  ✅ Archivo GCal (.csv) : ${CSV_PATH}`);
console.log(`  📅 Total de eventos    : ${EVENTS.length} (9 bloques de HOY + 9 hitos de Días 1–10)`);

if (process.argv.includes('--open')) {
  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${ICS_PATH}"`);
    }
  } catch (e) {
    console.warn('No se pudo abrir automáticamente el archivo .ics:', e.message);
  }
}

