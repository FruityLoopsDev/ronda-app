# RONDA NFT - Quick Start Guide

**Objetivo:** Mintar tu primer NFT en Polygon Mumbai en 10 minutos

## Requisitos Previos

- Node.js 16+ instalado
- Una wallet Ethereum (MetaMask)
- ~0.1 MATIC en testnet (gratuito)

## Paso 1: Setup del Proyecto (2 min)

```bash
# Clonar o descargar este directorio
cd ronda-nft

# Instalar dependencias
npm install --legacy-peer-deps

# Compilar smart contract
npm run compile
```

## Paso 2: Obtener MATIC de Testnet (3 min)

1. **Abre** https://faucet.polygon.technology/
2. **Selecciona** Mumbai Testnet
3. **Pega tu wallet address** (desde MetaMask)
4. **Espera 5-10 minutos** (puedes seguir mientras tanto)

## Paso 3: Configurar Variables de Entorno (2 min)

```bash
# Copiar template
cp .env.template .env.local

# Editar .env.local:
# RONDA_PRIVATE_KEY=0x... (tu wallet privada)
# PINATA_API_KEY=... (opcional, puedo ayudarte a crear una)
# RONDA_TREASURY_WALLET=0x... (puede ser tu wallet también)
```

## Paso 4: Deployar Smart Contract (2 min)

```bash
npm run deploy:mumbai
```

**Esperado:**
```
🚀 Deploying RONDA Event NFT...
✅ RondaEventNFT deployed to: 0x9C2A...
✅ Test mint successful!
   Token ID: 0
   Tx: 0x7f...
```

## Paso 5: Ver tu NFT (1 min)

Abre en el navegador:
```
https://mumbai.polygonscan.com/address/0x9C2A...
```

Reemplaza `0x9C2A...` con el address del deployment.

¡Listo! Completaste el setup de NFT.

## 🎯 Próximos Pasos

### Para Integración con RONDA App:
1. Copiar `js/nft-config.js`, `js/nft-utils.js` a tu proyecto
2. Importar en `db.js`
3. Agregar lógica en `confirmarSala()` (ver `RONDA_NFT_Integration_Strategy.md`)

### Para Deploy a Mainnet:
1. Cambiar `NODE_ENV=production`
2. Recargar MATIC wallet (necesitas ~0.5 MATIC para ~100 mints)
3. Ejecutar `npm run deploy:polygon`

### Para Crear Colección en OpenSea:
1. Una vez que haya 1+ NFT en mainnet, OpenSea indexará automáticamente
2. Ve a https://opensea.io
3. Busca tu contract address: `0x...`
4. Customiza metadata de colección

---

## ❓ Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "Gas estimation failed" | Aumentar `GAS_LIMIT: 200000` en nft-config.js |
| "Invalid Pinata key" | Generar nueva API key en dashboard.pinata.cloud |
| "No MATIC balance" | Esperar a que faucet envíe (puede tardar 10 min) |
| "Contract not verified" | Ejecutar `npm run verify:mumbai` después de 6 bloques |

---

## 📚 Documentación Completa

- **Estrategia técnica:** `docs/RONDA_NFT_Integration_Strategy.md`
- **Guía detallada:** `NFT_README.md`
- **Tests:** `npm test`

¡Listo para integrar NFTs en RONDA! 🚀
