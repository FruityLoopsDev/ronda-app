#!/usr/bin/env node
/**
 * scripts/git-lean-commit.cjs
 * Ejecución de commits ultraligeros con CERO consumo innecesario de tokens / contexto LLM.
 *
 * Características:
 * 1. Blindaje de seguridad: Bloquea archivos confidenciales (.env, secrets, logs, binarios > 5MB).
 * 2. Cero volcado de diffs: Emite solo métricas compactas (--stat).
 * 3. Inferencia de Conventional Commits: Si no se pasa mensaje, deduce type y scope según rutas modificadas.
 * 4. Salida determinista de 2 líneas: Ideal para agentes y CLI.
 *
 * Uso:
 *   node scripts/git-lean-commit.cjs "feat(admin): soporte de QR"
 *   node scripts/git-lean-commit.cjs --all "fix(auth): manejo de token"
 *   node scripts/git-lean-commit.cjs --dry-run
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

// 1. Parseo de argumentos
const args = process.argv.slice(2);
let isDryRun = false;
let stageAll = false;
let customMessage = '';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--dry-run') {
    isDryRun = true;
  } else if (arg === '-a' || arg === '--all') {
    stageAll = true;
  } else if (!arg.startsWith('-') && !customMessage) {
    customMessage = arg.trim();
  }
}

// 2. Comprobar estado de Git de forma compacta (sin volcar diffs)
function run(cmd, silent = false) {
  try {
    return execSync(cmd, { cwd: rootDir, stdio: ['ignore', 'pipe', silent ? 'ignore' : 'pipe'] }).toString().trim();
  } catch (err) {
    if (silent) return null;
    throw err;
  }
}

// 3. Verificación de seguridad de archivos
const BLOCKED_PATTERNS = [
  /^\.env/i,
  /\.env\..+/i,
  /id_rsa/i,
  /\.pem$/i,
  /\.key$/i,
  /serviceAccount.*\.json$/i,
  /firebase.*secret.*\.json$/i,
  /\.log$/i
];

const statusOutput = run('git status --porcelain');
if (!statusOutput) {
  console.log('ℹ️ [commit-lean] Nada que commitear (árbol de trabajo limpio).');
  process.exit(0);
}

const statusLines = statusOutput.split('\n').filter(Boolean);
const filesToStage = [];
const blockedFiles = [];

for (const line of statusLines) {
  const status = line.substring(0, 2);
  const file = line.substring(3).trim();

  // Comprobar patrones de seguridad
  const isBlocked = BLOCKED_PATTERNS.some(rx => rx.test(path.basename(file)));
  if (isBlocked) {
    blockedFiles.push(file);
    continue;
  }

  // Filtrar archivos de tamaño excesivo (> 5MB, excepto artefactos de conocimiento como graphify-out)
  const fullPath = path.join(rootDir, file);
  try {
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      const isAllowedLarge = file.startsWith('graphify-out');
      if (!isAllowedLarge && stat.isFile() && stat.size > 5 * 1024 * 1024) {
        blockedFiles.push(`${file} (>5MB)`);
        continue;
      }
    }
  } catch (_) {}

  filesToStage.push({ status, file });
}

if (blockedFiles.length > 0) {
  console.error('❌ [commit-lean] ALERTA DE SEGURIDAD: Archivos sensibles o pesados detectados:');
  blockedFiles.forEach(f => console.error(`   - ${f}`));
  console.error('Abortando commit para evitar fugas en el repositorio.');
  process.exit(1);
}

// 4. Inferencia automática de Conventional Commit si no hay mensaje
function inferCommitMessage(files) {
  const paths = files.map(f => f.file);
  
  const hasEngine = paths.some(p => p.includes('src/mem-rr-v2'));
  const hasAdmin = paths.some(p => p.includes('admin') || p.includes('entry-admin') || p.includes('host-admin'));
  const hasSuperAdmin = paths.some(p => p.includes('superadmin'));
  const hasClient = paths.some(p => p.includes('client') || p.includes('profile') || p.includes('dialog'));
  const hasDocs = paths.every(p => p.startsWith('docs/') || p.endsWith('.md'));
  const hasScripts = paths.every(p => p.startsWith('scripts/') || p.startsWith('test/'));
  const hasSecurity = paths.some(p => p.includes('firestore.rules') || p.includes('security'));

  let type = 'chore';
  let scope = 'app';
  let desc = 'actualización operativa';

  if (hasDocs) {
    type = 'docs';
    scope = 'docs';
    desc = 'actualizar documentación técnica y bitácora';
  } else if (hasEngine) {
    type = 'refactor';
    scope = 'engine';
    desc = 'optimización del motor de rotación MEM-RR v2';
  } else if (hasAdmin) {
    type = 'feat';
    scope = 'admin';
    desc = 'mejoras en la consola del anfitrión y paneles';
  } else if (hasSuperAdmin) {
    type = 'feat';
    scope = 'superadmin';
    desc = 'actualizaciones en el panel de supervisión global';
  } else if (hasSecurity) {
    type = 'fix';
    scope = 'security';
    desc = 'ajustes de reglas y control de acceso';
  } else if (hasScripts) {
    type = 'chore';
    scope = 'scripts';
    desc = 'herramientas internas y pruebas de validación';
  } else if (hasClient) {
    type = 'feat';
    scope = 'client';
    desc = 'mejoras de experiencia de usuario y flujos cliente';
  }

  return `${type}(${scope}): ${desc}`;
}

const finalMessage = customMessage || inferCommitMessage(filesToStage);

// 5. Ejecutar Stage
if (isDryRun) {
  console.log(`🔍 [commit-lean] DRY-RUN:`);
  console.log(`   Mensaje propuesto: "${finalMessage}"`);
  console.log(`   Archivos candidatos (${filesToStage.length}):`);
  filesToStage.slice(0, 10).forEach(f => console.log(`   ${f.status} ${f.file}`));
  if (filesToStage.length > 10) console.log(`   ... y ${filesToStage.length - 10} más`);
  process.exit(0);
}

// Hacer stage inteligente
if (stageAll) {
  run('git add -A');
} else {
  // Stage de los archivos validados
  run('git add -u');
  // Agregar también los untracked que no estén bloqueados (siempre respetando límites)
  for (const item of filesToStage) {
    if (item.status.includes('?')) {
      run(`git add "${item.file}"`);
    }
  }
}

// 6. Ejecutar Commit
try {
  run(`git commit -m "${finalMessage.replace(/"/g, '\\"')}"`);
  const lastCommitHash = run('git rev-parse --short HEAD');
  const statSummary = run('git diff --stat HEAD~1 HEAD').split('\n').pop().trim();

  console.log(`✅ [commit-lean] ${lastCommitHash}: ${finalMessage}`);
  console.log(`   ${statSummary}`);
} catch (err) {
  const errMsg = err.stderr ? err.stderr.toString().trim() : err.message;
  console.error(`❌ [commit-lean] Error al ejecutar commit:`, errMsg);
  process.exit(1);
}

