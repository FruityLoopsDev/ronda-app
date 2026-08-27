# mem-rr-v2 — Motor de rotación con memoria (WMM)

Módulo puro (sin DOM ni Firebase) del motor MEM-RR v2. Ejecutable en Node y en el navegador.

## Ejecutar la suite de validación y benchmark

```bash
node src/mem-rr-v2/bench.ts
```

La suite valida los solvers contra fuerza bruta y compara v1 vs v2 (recencia, afinidad,
restricciones duras, re-optimización dinámica y rendimiento).

## API

```ts
import { buildNightPlan } from './engine.ts';

const plan = buildNightPlan({
  sideA, sideB,          // Participant[] — lados A (fijo) y B (rota)
  rounds: 9,
  history,               // History — matriz de encuentros persistida (ver abajo)
  config: { alpha: 1, beta: 1, gamma: 1, delta: 0, lambda: Math.LN2 / 30, restWeight: 0 },
  room,                  // RoomGraph (opcional) — grafo de distancias del local
  general: false         // true = todos contra todos (noches temáticas)
});

plan.mode;    // 'offsets' | 'constrained' | 'general'
plan.rounds;  // RoundResult[] — mesas por ronda, descansos, tiempos
plan.metrics; // freshness, repeticiones, cobertura, Gini de descansos, distancia
```

## Módulos

| Archivo | Rol |
|---|---|
| `types.ts` | Tipos (Participant, History, EngineConfig, NightPlan...) |
| `weights.ts` | Modelo `w = α·A + β·F − γ·R − δ·D` + restricciones duras |
| `flow.ts` | Min-Cost Max-Flow — emparejamiento bipartito **exacto** (formato estándar) |
| `exact.ts` | DP por subconjuntos — emparejamiento general **exacto** (n ≤ 18) |
| `general.ts` | Búsqueda local multi-arranque — emparejamiento general casi-óptimo (n > 18) |
| `engine.ts` | Orquestador: modos offsets / constrained / general + métricas |

## Integración con la app

**Hecho (M2–M5):**
- `src/mem-rr-history.ts` — adaptador `History` con siembra demo determinista y lectura/escritura
  Firestore (`users/{uid}/encounters/{otherUid}`) para producción.
- `src/bar.ts` (`HostConsole`) — `generateNextRound` usa `buildNightPlan` (motor v2) por defecto
  (`motorVersion = 'v2'`), con **fallback al motor v1** si algo falla. Re-planificación intra-noche
  cuando cambia la composición de la sala: `alreadyMet` = pares ya jugados (campo `playedPairs` del
  evento), y `nightPlanStartRound` alinea las rondas restantes. Panel de métricas del plan (M5).
- `src/client.ts` — **suscripción en vivo** al evento del cliente (M3) vía `DB.subscribeToEvent`:
  recibe `activeMatches`/`currentRound` que el anfitrión escribe desde el motor v2 y re-renderiza.
- **M4** — `buildNightPlan` admite `tableSize: 4` (mesas 2+2 por bloques) y `room` (grafo del local,
  término `δ·D`); ambos validados en `bench.ts` (§7).

**Nota M3 (check-in QR):** el anfitrión escanea el QR del cliente con `html5-qrcode` (import dinámico,
chunk aparte `esm-*.js`); el cliente muestra un QR real `CHECKIN:<uid>` (generado con `qrcode-generator`).
El escaneo registra asistencia (añade a `event.participants`) → dispara la re-planificación del motor v2.
Hay un input manual como respaldo cuando no hay cámara.
