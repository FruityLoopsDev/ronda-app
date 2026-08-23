# RONDA NFT Integration - Guía de Implementación

## 📋 Resumen Rápido

Este directorio contiene todo lo necesario para integrar **NFTs de asistencia a eventos** en RONDA:

- **Smart Contract** (Solidity): ERC-721 con royalties en Polygon
- **Configuración**: Polygon Mumbai testnet y Polygon mainnet
- **Almacenamiento**: IPFS vía Pinata
- **Seguridad**: Credenciales en Google Cloud Secret Manager

## 🎯 Objetivos

✅ Certificados verificables de asistencia  
✅ Coleccionables para usuarios  
✅ Royalties automáticas para RONDA  
✅ No transferibles las primeras 24h (evita dumping)  
✅ Integración sin romper lógica de eventos  

## 🚀 Setup Inicial (5 minutos)

### 1. Instalar dependencias
```bash
npm install --legacy-peer-deps
```

### 2. Configurar variables de entorno
```bash
cp .env.template .env.local
```

Completa estos valores:
```
RONDA_PRIVATE_KEY=0x...  # Wallet que mintea NFTs
RONDA_TREASURY_WALLET=0x...  # Recibe royalties
PINATA_API_KEY=...
PINATA_SECRET_KEY=...
ETHERSCAN_API_KEY=...  # Para verificación automática
```

### 3. Compilar smart contract
```bash
npm run compile
```

Debería generar `/artifacts/contracts/RondaEventNFT.sol/RondaEventNFT.json`

## 🧪 Deployment en Mumbai Testnet (Semana 1)

### Paso 1: Obtener MATIC de faucet
- Ve a https://faucet.polygon.technology/
- Pega tu wallet address (0x...)
- Espera 5-10 minutos

### Paso 2: Deployar contrato
```bash
npm run deploy:mumbai
```

Output esperado:
```
🚀 Deploying RONDA Event NFT...
📍 Network: mumbai
👤 Deployer: 0x1234...
💰 Balance: 10.5 MATIC

✅ RondaEventNFT deployed to: 0x9C2A...
📝 Deployment saved to: ./deployments/mumbai_deployment.json
🧪 Testing mint functionality...
✅ Test mint successful!
```

### Paso 3: Copiar address del contrato
```bash
# Abre ./deployments/mumbai_deployment.json
# Copia el valor de "RondaEventNFT"
# Pégalo en js/nft-config.js → SMART_CONTRACT.ADDRESS_MUMBAI
```

## ✅ Verificación Manual

Abre en el navegador:
```
https://mumbai.polygonscan.com/address/0x9C2A...
```

Deberías ver:
- Nombre: "RONDA Event NFT"
- Símbolo: "RONDA"
- Contract Creator address
- Transacción de deployment

## 🔄 Testing del Flujo Completo

### Estructura de pruebas
```
test/
  ├── RondaEventNFT.test.js      # Tests del contrato
  ├── nft-integration.test.js    # Tests del flujo completo
  └── nft-utils.test.js           # Tests de utilities
```

### Ejecutar tests
```bash
npm test
```

O con reporte de gas:
```bash
npm run test:gas
```

## 📦 Integración en db.js

Una vez que el contrato esté deployado, actualizar `confirmarSala()`:

```javascript
// Importar al inicio de db.js
import { uploadMetadataToPinata, mintNFT } from './nft-utils.js';

export async function confirmarSala(eventoId, usersConfirmed) {
  const evento = eventos[eventoId];
  evento.estado = 'confirmado';
  
  // ... lógica existente ...
  
  // 🔥 NUEVA: Emitir NFTs (no bloquea el evento si falla)
  if (!DEMO && evento.asistentes.length > 0) {
    for (const userId of evento.asistentes) {
      try {
        const user = usuarios[userId];
        
        // 1. Upload metadata a IPFS
        const ipfsResult = await uploadMetadataToPinata({
          evento,
          userAddress: user.wallet_address,
          userRole: user.rol,
        });
        
        if (!ipfsResult.success) continue;
        
        // 2. Mintar NFT
        const mintResult = await mintNFT(
          user.wallet_address,
          eventoId,
          ipfsResult.ipfsHash
        );
        
        if (mintResult.success) {
          // 3. Guardar en Firestore
          await db.collection('eventos').doc(eventoId)
            .collection('nfts').add({
              userId,
              tokenId: mintResult.tokenId,
              transactionHash: mintResult.transactionHash,
              ipfsHash: ipfsResult.ipfsHash,
              mintedAt: new Date(),
            });
        }
      } catch (error) {
        console.error(`NFT mint error for ${userId}:`, error);
        // Continuar sin romper el evento
      }
    }
  }
  
  return evento;
}
```

## 🔐 Seguridad: Google Cloud Secret Manager

**NUNCA commits credenciales a Git.** Usa Secret Manager:

```bash
# Setup en Google Cloud
gcloud secrets create RONDA_PRIVATE_KEY --data-file=- <<< "0x..."
gcloud secrets create PINATA_API_KEY --data-file=- <<< "..."

# En Cloud Function (Antigravity):
const secretManager = require('@google-cloud/secret-manager');
const getSecret = async (name) => {
  const [version] = await secretManager.accessSecretVersion({
    name: `projects/PROJECT_ID/secrets/${name}/versions/latest`
  });
  return version.payload.data.toString('utf-8');
};

const RONDA_PRIVATE_KEY = await getSecret('RONDA_PRIVATE_KEY');
```

## 📊 Monitoreo en Producción

### Dashboards útiles

1. **Polygonscan** (explorador)
   ```
   https://polygonscan.com/token/0x9C2A...
   ```

2. **OpenSea** (colección)
   ```
   https://opensea.io/collection/ronda-event-nfts
   ```

3. **Dune Analytics** (dashboard custom)
   - Queryable: `polygon.nft_transfers` where contract_address = 0x...
   - Métricas: holders, floor price, volumen

### Alarmas recomendadas

- ⚠️ Gas price > 100 gwei (aumentar retry delay)
- ⚠️ IPFS upload fails (fallback a Arweave?)
- ⚠️ Saldo del deployer < 0.1 MATIC (recargar)

## 🚀 Deploy a Mainnet (Semana 5)

### Checklist pre-mainnet

- [ ] 54/54 tests pasando
- [ ] Audit de seguridad completado
- [ ] RONDA treasury wallet financiada (~1 MATIC)
- [ ] Royalty recipient configurado
- [ ] IPFS metadata verificada en testnet
- [ ] QA con 100+ NFTs en mumbai

### Deploy a mainnet
```bash
npm run deploy:polygon
```

### Post-deployment

1. **Verificar en Polygonscan**
   ```
   https://polygonscan.com/address/0x9C2A...
   ```

2. **Crear colección en OpenSea**
   - Ve a https://opensea.io
   - Busca tu contract address
   - La colección se crea automáticamente al primer mint

3. **Configurar royalties**
   - OpenSea Creator Dashboard
   - Setear 10% royalty a RONDA treasury wallet
   - Verificar "Lazy Minting" está disabled

## 📈 Métricas de Éxito

**Mes 1-3:**
- 10+ eventos con NFTs emitidos
- 50+ usuarios con colecciones
- 0 fallos de mint (< 0.1%)

**Mes 4-6:**
- 50+ NFTs vendidos en secondary market
- 5.000+ COP en royalties acumuladas
- 18%+ bump en user retention

**Mes 6+:**
- +150.000 COP/mes en revenue NFT
- 2-3 nuevas use cases (SaaS licenses, etc.)
- Preparar Series A pitch con datos verificables on-chain

## 🐛 Troubleshooting

### "Gas estimation failed"
```javascript
// Aumentar gas limit manualmente
{
  gasLimit: 200000,  // aumentar si falla
  gasPrice: ethers.utils.parseUnits('60', 'gwei')
}
```

### "Pinata API key invalid"
```bash
# Verificar en Pinata dashboard
# API → Access Token → Copy
# Pegar en .env.local como PINATA_API_KEY
```

### "Token locked for 24 hours"
Esto es INTENCIONADO. Los NFTs no se pueden vender en las primeras 24h post-evento.

Para testear con tiempo:
```javascript
// En test: usar hardhat time manipulation
await ethers.provider.send('evm_increaseTime', [24 * 60 * 60 + 1]);
```

## 📚 Referencias

- [Polygon Docs](https://polygon.technology/developers)
- [Pinata Docs](https://docs.pinata.cloud/)
- [OpenZeppelin ERC-721](https://docs.openzeppelin.com/contracts/4.x/erc721)
- [Hardhat Guide](https://hardhat.org/guides)
- [OpenSea API](https://docs.opensea.io/)

## 📞 Support

Para preguntas técnicas:
1. Revisar `docs/RONDA_NFT_Integration_Strategy.md`
2. Checkear logs de deployment en `/deployments/*.json`
3. Consultar con equipo backend de Antigravity

---

**Status**: ✅ Listo para implementación  
**Última actualización**: 2026-08-23  
**Versión**: 1.0  
**Confidencial: Uso interno RONDA**
