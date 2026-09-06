# Plan: migrar Cloud Functions de Firebase → Vercel (sin plan Blaze)

> **Objetivo:** recuperar la lógica serverless (`wompiWebhook`, `mintAttendanceNFT`,
> `processEventMatches`) sin pagar plan Blaze, usando **Vercel Hobby ($0)**.
> **Estado:** 📦 Código portado listo en `functions-vercel/` — pendiente de
> crear cuenta Vercel y desplegar (requiere tu acción).

---

## 1. Por qué funciona sin Blaze

- Blaze solo es obligatorio para **Cloud Functions de Google**. Firestore en free
  tier (Spark) permite lecturas/escrituras desde cualquier cliente con service
  account — incluido un serverless de Vercel vía `firebase-admin`.
- El código portado escribe en Firestore exactamente como lo hacían las funciones,
  y las reglas (`firestore.rules`) no aplican al Admin SDK.
- Costo: **$0/mes** (Vercel Hobby: 100 GB transferencia, ~100 GB-h cómputo, 10 s/función).

## 2. Arquitectura resultante

```
Cliente (Firebase Hosting, ronda-uno.web.app)  ← sin cambios hoy
        │
        ├─ (futuro) mint real / matches server-side → fetch POST a Vercel con idToken
        │
Wompi (dashboard) ── POST transaction.updated ──► https://<proyecto>.vercel.app/api/wompi-webhook
                                                     │ firebase-admin (service account)
                                                     ▼
                                              Firestore ronda-uno (free tier)
```

## 3. Qué se portó (`functions-vercel/`)

| Archivo | Equivalente original | Cambios |
|---|---|---|
| `api/wompi-webhook.js` | `exports.wompiWebhook` | Sin cambios de lógica (validación SHA256 + secret); se añadió `paymentMethod:'wompi'`/`paymentPending:false` al aprobar |
| `api/mint-nft.js` | `exports.mintAttendanceNFT` (onCall) | `onCall` → verificación manual de `Authorization: Bearer <idToken>` + rol `admin`; opción `NO_WAIT_TX=true` |
| `api/process-matches.js` | `exports.processEventMatches` (onCall) | Ídem conversión callable |
| `api/_lib.js` | — | `firebase-admin` init desde env `FIREBASE_SERVICE_ACCOUNT`, helpers auth/CORS/errores |
| `vercel.json`, `package.json`, `README.md` | — | Config y docs |

Se eliminó la dependencia `firebase-functions` (propia de Cloud Functions). Se
conservan `firebase-admin` y `ethers@5` (misma API v5 del código original).

## 4. Pasos de despliegue (cuando tengas cuenta Vercel)

1. **Crear proyecto en Vercel** apuntando a `functions-vercel/` como *Root
   Directory* (proyecto independiente — NO desplegar todo el repo, el sitio sigue
   en Firebase Hosting).
2. **Configurar env vars** (Vercel → Settings → Environment Variables):
   - `FIREBASE_SERVICE_ACCOUNT` = JSON de la service account de `ronda-uno`
     (la misma del secret de GitHub `FIREBASE_SERVICE_ACCOUNT_RONDA_UNO`)
   - `WOMPI_EVENTS_SECRET` (para el webhook; sin él, rechaza — fail-closed)
   - `POLYGON_RPC`, `RELAYER_PRIVATE_KEY`, `NFT_CONTRACT_ADDRESS` (solo mint)
   - `NO_WAIT_TX` = `true` si el mint se pasa de 10 s
3. **Desplegar:** `vercel --prod` (o Git integration).
4. **Probar** (ver `functions-vercel/README.md`): webhook rechaza sin firma;
   callables con idToken real.
5. **Wompi (cuando haya cuenta de producción):** registrar
   `https://<proyecto>.vercel.app/api/wompi-webhook` como Events URL + mismo secret.

## 5. Pruebas (Fase QA)

- [ ] `node --check` de los 3 archivos API (ya validado)
- [ ] `vercel dev` local + `curl` al webhook → 401 sin firma (fail-closed)
- [ ] `process-matches` con idToken de `cesar@ronda.uno` y un evento de prueba
- [ ] Flujo Wompi end-to-end cuando exista cuenta prod (pago de prueba → hasTicket)
- [ ] (Opcional) mint de prueba en Polygon Mumbai/Amoy con la wallet relayer

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Límite 10 s (Hobby) en `mint-nft` (`tx.wait()`) | Polygon confirma en 2-5 s normalmente; si excede: `NO_WAIT_TX=true` o subir a Pro ($20/mes) solo si hace falta |
| Service account en env var de Vercel | Se almacena cifrada; usar la SA mínima de ronda-uno existente; rotar si se filtra |
| Latencia Colombia → región | Región por defecto Vercel (iad1/us-east) cercana a Firestore nam5 (US); suficiente para webhooks |
| Sin CORS mal configurado en callables | `_lib.js` ya responde OPTIONS + `Access-Control-Allow-*` |

## 7. Decisiones del dueño

1. ¿Crear cuenta Vercel con el email `cesar@ronda.uno` (o cuál)?
2. ¿Conectar por CLI (`vercel login`) o Git integration a un repo? Si Git: ¿repo
   aparte o *Root Directory* `functions-vercel/` del repo actual?
3. ¿La service account de Vercel será la misma `FIREBASE_SERVICE_ACCOUNT_RONDA_UNO`
   (conviene crear una dedicada solo-API con permisos Firestore)?
