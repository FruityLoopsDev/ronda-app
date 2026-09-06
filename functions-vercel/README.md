# RONDA API — Vercel (sin plan Blaze)

API serverless que reemplaza las Cloud Functions de Firebase (`functions/`) usando
**Vercel Hobby ($0)**. Escribe en Firestore vía `firebase-admin` (service account),
así que **no requiere plan Blaze**: Firestore free tier cubre las operaciones.

## Rutas

| Ruta | Original (Cloud Functions) | Rol |
|---|---|---|
| `POST /api/wompi-webhook` | `wompiWebhook` (https.onRequest) | Webhook de pagos (server-to-server) |
| `POST /api/mint-nft` | `mintAttendanceNFT` (https.onCall) | Acuñar NFT (admin) |
| `POST /api/process-matches` | `processEventMatches` (https.onCall) | Procesar matches (admin) |

Las rutas callable requieren header `Authorization: Bearer <idToken de Firebase>`.

## Despliegue

```bash
cd functions-vercel
npm install            # instala firebase-admin + ethers
vercel login
vercel                # primer deploy (dev)
vercel --prod         # producción
```

> ⚠️ Desplegar SOLO esta carpeta como proyecto Vercel independiente (no todo el
> repo ronda-app, que es estático y vive en Firebase Hosting). Con Git
> integration: `Root Directory = functions-vercel`.

## Env vars (Vercel → Project → Settings → Environment Variables)

| Variable | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON de la service account de `ronda-uno` (misma que el secret de GitHub `FIREBASE_SERVICE_ACCOUNT_RONDA_UNO`) |
| `WOMPI_EVENTS_SECRET` | Secreto del webhook de Wompi (fail-closed sin él) |
| `POLYGON_RPC` | RPC de Polygon (solo mint-nft) |
| `RELAYER_PRIVATE_KEY` | Clave privada del wallet minter (solo mint-nft) |
| `NFT_CONTRACT_ADDRESS` | Dirección del contrato ERC-721 (solo mint-nft) |
| `NO_WAIT_TX` | `true` = mint fire-and-forget (ver límite 10s abajo) |

## ⚠️ Límites del plan Hobby

- **10 s de duración por función** (Pro: 300 s). El webhook y process-matches son
  rápidos. `mint-nft` espera confirmación on-chain (`tx.wait()`): en Polygon suele
  confirmar en 2-5 s, pero si la red va lenta puede excederse. Si ocurre, activa
  `NO_WAIT_TX=true` (guarda `tokenId: 'pending'` y el NFT queda registrado igual).
- 100 GB transferencia/mes y ~100 GB-h de cómputo: de sobra para un MVP.

## Probar en local

```bash
cd functions-vercel
npm install
vercel dev          # sirve http://localhost:3000/api/*
```

## Pruebas rápidas (tras deploy)

Webhook (debe rechazar por firma inválida — fail-closed):
```bash
curl -X POST https://<proyecto>.vercel.app/api/wompi-webhook -H "Content-Type: application/json" -d '{"event":"transaction.updated"}'
# → 401 Invalid Signature (esperado sin WOMPI_EVENTS_SECRET correcto)
```

Callable (requiere un idToken real de Firebase Auth):
```bash
curl -X POST https://<proyecto>.vercel.app/api/process-matches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -d '{"eventId":"EVENTO"}'
```

## Notas

- No se tocan `firestore.rules`: el Admin SDK ignora las reglas (privilegios de service account).
- El cliente (SPA en Firebase Hosting) no cambia hoy: `nft-utils.ts` ya simula el
  minting y los matches se calculan en cliente. Estos endpoints quedan listos para
  cuando se quiera minting real o procesamiento server-side.
- Al activar la cuenta Wompi de producción: registrar
  `https://<proyecto>.vercel.app/api/wompi-webhook` como Events URL y configurar
  el mismo `WOMPI_EVENTS_SECRET` en ambos lados.
