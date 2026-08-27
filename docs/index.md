# RONDA — Índice del proyecto (mapa de archivos)

> Léelo PRIMERO en cada sesión. Evita leer los archivos grandes (L/XL) salvo necesidad.
> Coste de tokens por lectura: S < 1k · M ~1–3k · L ~5–10k · XL > 15k.

## Stack
Vanilla TS + Vite (SPA multi-vista) · Firebase (Auth/Firestore/Hosting/Functions) · Web3 (ERC-721/Polygon) · Wompi · localforage.

## Entradas
- `index.html` (XL, 2.2k líneas) — SPA: vistas auth/lobby/profile/client/admin. **No leer entero**.
- `landing.html` (M) — landing de marketing (entrada secundaria).
- `src/app.ts` (M) — orquestador y eventos de vista. **Inicio recomendado**: conexión login/registro → vistas → check-in.

## Módulos clave `src/` (S = pequeño, M = medio)
| Archivo | Rol | Coste |
|---|---|---|
| `firebase-config.ts` | init Firebase, `isDemo` | S |
| `db.ts` | abstracción Firestore/memoria demo | M |
| `auth.ts` | Firebase Auth + perfil | S |
| `ronda-core.ts` | motor v1 teórico (afinidad+colisión) | S |
| `bar.ts` | consola anfitrión + motor v1/v2 | M |
| `client.ts` | dashboard cliente (feed, reservas, chat 72h) | **XL** |
| `profile.ts` | vista perfil | M |
| `verification.ts` | KYC (geo + OCR + biometría) | S |
| `matches.ts` | likes/matches post-evento | S |
| `offline-sync.ts` | cola offline de votos | S |
| `seed.ts` | datos demo | S |
| `utils.ts`, `dialog.ts`, `nft-utils.ts`, `nft-config.ts` | utilidades | S |

## Motor de rotación `src/mem-rr-v2/` (módulo puro, testable en Node)
- `types.ts`, `weights.ts` (modelo `α·A+β·F−γ·R−δ·D`), `flow.ts` (bipartito exacto), `exact.ts` (DP n≤18), `general.ts` (búsqueda local), `engine.ts` (orquestador), `bench.ts` (validación v1 vs v2).
- `src/mem-rr-history.ts` — adaptador de historial (demo + Firestore).
- **Bench**: `node src/mem-rr-v2/bench.ts`.

## Funciones Firebase `functions/index.js` (M)
`wompiWebhook` · `mintAttendanceNFT` · `processEventMatches`. Contiene secreto hardcodeado (ver docs de IP).

## Web3 / Prueba de existencia (reserva)
- `contracts/RondaEventNFT.sol` (ERC-721 asistencia) · `contracts/ProvenanceRegistry.sol` (timestamp proof-of-existence, **no publicado**).
- `scripts/register-proof.cjs` — imprime keccak256 de un archivo; modo **reserva** (sin on-chain salvo credenciales+gas).
- `scripts/deploy-nft.js` (Hardhat; requiere toolchain en `ronda-files`).

## Documentación (leer antes que el código)
- `docs/index.md` (este archivo) · `docs/algorithm-v2-spec.md` (motor v2) · `docs/ip-patent-strategy.md` · `docs/invention-disclosure-mem-rr-v2.md` · `docs/provisional-us-mem-rr-v2.md` · `docs/architecture.md`
- **Evidencia técnica:** `docs/bench-results/bench-*.md` (resultados del motor con fecha).
- **Inventario de divulgaciones:** `docs/divulgaciones-inventario.md`.

## Reglas para no quemar tokens
1. **Nunca** glob/grep en `node_modules`, `dist/`, `.firebase/`.
2. **grep antes que read**: localiza símbolos con `grep` y lee solo el rango.
3. No leer `client.ts` ni `index.html` completos; leer por sección o con grep.
4. Agrupar lecturas/consultas independientes en paralelo.
5. Respuestas concisas; tablas compactas.
