# RONDA NFT Integration Strategy
**Versión 1.0 | Bogotá 2026 | Implementación en 3 fases**

---

## RESUMEN EJECUTIVO

Integración NFT enfocada en **tickets de evento como certificados de asistencia**, minimizando complejidad técnica mientras maximiza valor para tres stakeholders:

- **Usuarios:** Coleccionen prueba verificable de asistencia, gamificación, acceso a networking exclusivo
- **Locales:** Dashboard de ocupación verificable on-chain, diferenciador competitivo
- **RONDA:** Nuevo revenue stream (venta de NFT + royalties), datos verificables de uso

**Impacto esperado:**
- +18% retención de usuarios (colección de eventos asistidos)
- +12% "bragging rights" en redes sociales (compartibilidad de NFTs)
- ROI positivo en mes 6 (costo deployment ≈ 80.000 COP, revenue NFT ≈ 150.000+ COP/mes mes 6)

---

## DECISIONES TÉCNICAS CLAVE

### 1. Blockchain Selection: **Polygon (Mumbai Testnet → Mainnet)**

| Criterio | Polygon | Ethereum | Solana | Arbitrum |
|----------|---------|----------|--------|----------|
| Gas Cost | **$0.01–0.05** | $2–15 | $0.00001 | $0.05–0.20 |
| TPS | 7.5K | 15 | 65K | 4.4K | 
| Finality | 2–3 min | 12 min | 400ms | 1.5 sec |
| Dev Ecosystem | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Colombia Adoption | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ |
| **Recomendación** | ✅ **ELEGIDA** | Alternativa | No | Alternativa |

**Por qué Polygon:**
- Gas ~0.02 USD = 76 COP por NFT (vs Ethereum 3.000+ COP) = margen 3.5x
- EVM-compatible: código Web3.js/ethers.js reutilizable en Ethereum después
- Mumbai testnet libre para development
- MATIC token líquido en Colombia (Ripio, Binance)

---

## ARQUITECTURA NFT: MODELO DE 3 CAPAS

### Capa 1: Smart Contract (Polygon)
```
RondaEventNFT.sol
├── mint(userAddress, eventId, timestamp, metadata)
├── tokenURI(tokenId) → IPFS hash
├── royalties(10%) → RONDA wallet
├── verification(tokenId) → onChainProof
└── transfer restrictions (no transferible en primeras 24h post-evento)
```

**Deployment:**
- Testnet: Mumbai (Polygon's free testnet)
- Mainnet: Polygon Mumbai → mainnet.polygon.com
- Costo deployment: ~1–2 USD (~4.000–7.600 COP)
- Costo por mint: ~0.002–0.01 USD (~7.6–38 COP)

### Capa 2: NFT Metadata (IPFS + Pinata)
```json
{
  "name": "RONDA Evento #42 — Zona G, 14 Sept 2026",
  "description": "Asistencia verificada a evento RONDA de speed dating",
  "image": "ipfs://QmXxxx/evento_42_barcode.png",
  "attributes": [
    { "trait_type": "Evento ID", "value": "42" },
    { "trait_type": "Local", "value": "Cantina Central" },
    { "trait_type": "Zona", "value": "Zona G" },
    { "trait_type": "Fecha", "value": "2026-09-14" },
    { "trait_type": "Hora Cierre", "value": "22:30" },
    { "trait_type": "Matches Realizados", "value": "6" },
    { "trait_type": "Rol Usuario", "value": "user_femenino" }
  ]
}
```

**Implementación:**
- Pinata.cloud API (free tier: 1 GB, $0/mes)
- Upload metadata JSON + evento_badge.png al confirmarSala()
- Retorna IPFS CID → se pasa a mint()

### Capa 3: Integración en RONDA App

```
Estado evento: abierto → casi_lleno → confirmado → en_curso → CERRADO
                                                              ↓
                                                         emit NFT
                                                         (confirmarSala)
                                                              ↓
                                                  user.nft_balance++
                                                  wallet_address asociada
```

---

## IMPLEMENTACIÓN TÉCNICA (FASES 1–3)

### FASE 1: Setup Blockchain + Smart Contract (Semanas 1–2)

#### 1.1 Wallet Setup
```javascript
// En js/nft-config.js (NUEVO ARCHIVO)
export const NFT_CONFIG = {
  POLYGON_RPC: 'https://polygon-rpc.com',
  POLYGON_MUMBAI_RPC: 'https://rpc-mumbai.maticvigil.com',
  RONDA_WALLET_ADDRESS: '0x7A...', // Treasury wallet para royalties
  RONDA_PRIVATE_KEY: process.env.RONDA_PRIVATE_KEY, // Cloud Secret Manager
  
  SMART_CONTRACT: {
    ADDRESS: '0x9C2...', // Se deploya en Mumbai primero
    ABI: [...], // Generado por Hardhat
    GAS_LIMIT: 150000,
    GAS_PRICE: ethers.utils.parseUnits('50', 'gwei'), // ~$0.02/mint
  },
  
  IPFS: {
    API_KEY: process.env.PINATA_API_KEY,
    SECRET: process.env.PINATA_SECRET,
    GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
  },
};
```

#### 1.2 Smart Contract (Solidity 0.8.20)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract RondaEventNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;
    
    uint256 public constant ROYALTY_PERCENT = 10; // 10% a RONDA
    address public royaltyRecipient;
    
    struct EventMetadata {
        uint256 eventId;
        address userAddress;
        uint256 mintTimestamp;
        string ipfsHash;
    }
    
    mapping(uint256 => EventMetadata) public tokenMetadata;
    mapping(uint256 => uint256) public eventTokenCount; // Eventos con NFTs emitidos
    
    event NFTMinted(address indexed user, uint256 indexed eventId, uint256 tokenId);
    event RoyaltyPaid(address indexed recipient, uint256 amount);
    
    constructor(address _royaltyRecipient) ERC721("RONDA Event NFT", "RONDA") {
        royaltyRecipient = _royaltyRecipient;
    }
    
    function mint(
        address _userAddress,
        uint256 _eventId,
        string memory _ipfsHash
    ) external onlyOwner {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(_userAddress, tokenId);
        
        tokenMetadata[tokenId] = EventMetadata(
            _eventId,
            _userAddress,
            block.timestamp,
            _ipfsHash
        );
        
        eventTokenCount[_eventId]++;
        emit NFTMinted(_userAddress, _eventId, tokenId);
    }
    
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        require(_ownerOf(tokenId) != address(0), "Token no existe");
        return string(abi.encodePacked(
            "ipfs://",
            tokenMetadata[tokenId].ipfsHash
        ));
    }
    
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
```

#### 1.3 Deployment con Hardhat
```bash
# scripts/deploy-nft.js
npx hardhat run scripts/deploy-nft.js --network mumbai
# Output:
# ✓ RondaEventNFT deployed at 0x9C2...
# ✓ Royalty recipient: 0x7A...
```

---

### FASE 2: IPFS Metadata Upload (Semanas 2–3)

#### 2.1 Función para uploadear a Pinata
```javascript
// En js/nft-utils.js (NUEVO ARCHIVO)
import axios from 'axios';

export async function uploadMetadataToPinata(eventData, userRole) {
  const { evento, userAddress } = eventData;
  
  // 1. Generar metadata JSON
  const metadata = {
    name: `RONDA Evento #${evento.id} — ${evento.local.nombre}, ${evento.fecha}`,
    description: `Asistencia verificada a evento RONDA de speed dating en ${evento.local.zona}`,
    image: `ipfs://QmXxxx/evento_${evento.id}_badge.png`, // Pre-hostear en Pinata
    attributes: [
      { trait_type: "Evento ID", value: evento.id },
      { trait_type: "Local", value: evento.local.nombre },
      { trait_type: "Zona", value: evento.local.zona },
      { trait_type: "Fecha", value: evento.fecha },
      { trait_type: "Hora Cierre", value: evento.hora_fin },
      { trait_type: "Matches Realizados", value: evento.matches.length },
      { trait_type: "Rol Usuario", value: userRole },
    ],
  };
  
  // 2. Upload a Pinata
  const { IPFS } = NFT_CONFIG;
  const formData = new FormData();
  formData.append('file', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('pinataMetadata', JSON.stringify({
    name: `evento_${evento.id}_metadata.json`,
  }));
  
  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          'pinata_api_key': IPFS.API_KEY,
          'pinata_secret_api_key': IPFS.SECRET,
        },
      }
    );
    
    const ipfsHash = response.data.IpfsHash;
    return {
      success: true,
      ipfsHash, // QmXxxx...
      gateway: `${IPFS.GATEWAY}${ipfsHash}`,
    };
  } catch (error) {
    console.error('Pinata upload failed:', error);
    return { success: false, error };
  }
}

// 2.2 Función para mintar NFT en el smart contract
export async function mintNFT(userAddress, eventId, ipfsHash) {
  const { ethers } = await import('ethers');
  const { SMART_CONTRACT, POLYGON_RPC } = NFT_CONFIG;
  
  // Conectar con provider + signer (Cloud Secret Manager para private key)
  const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
  const signer = new ethers.Wallet(NFT_CONFIG.RONDA_PRIVATE_KEY, provider);
  
  // Instanciar contrato
  const contract = new ethers.Contract(
    SMART_CONTRACT.ADDRESS,
    SMART_CONTRACT.ABI,
    signer
  );
  
  try {
    const tx = await contract.mint(
      userAddress,
      eventId,
      ipfsHash,
      {
        gasLimit: SMART_CONTRACT.GAS_LIMIT,
        gasPrice: SMART_CONTRACT.GAS_PRICE,
      }
    );
    
    const receipt = await tx.wait(); // Esperar 1 confirmación
    return {
      success: true,
      transactionHash: receipt.transactionHash,
      tokenId: receipt.events[0].args.tokenId.toNumber(),
    };
  } catch (error) {
    console.error('NFT mint failed:', error);
    return { success: false, error };
  }
}
```

---

### FASE 3: Integración en flujo confirmarSala() (Semanas 3–4)

#### 3.1 Actualizar db.js: función confirmarSala()
```javascript
// En js/db.js → modificar función `confirmarSala()`

export async function confirmarSala(eventoId, usersConfirmed) {
  // [Lógica existente de confirmación de evento...]
  const evento = eventos[eventoId];
  evento.estado = 'confirmado';
  evento.asistentes = usersConfirmed;
  // ...
  
  // 🔥 NUEVA LÓGICA: Emitir NFTs
  if (!DEMO) { // Solo en producción con Firestore
    for (const userId of usersConfirmed) {
      const user = usuarios[userId];
      const userRole = user.rol; // 'cliente_masculino' | 'cliente_femenino'
      
      try {
        // 1. Upload metadata a IPFS
        const ipfsResult = await uploadMetadataToPinata(
          { evento, userAddress: user.wallet_address },
          userRole
        );
        
        if (!ipfsResult.success) {
          console.error(`IPFS upload failed para user ${userId}`);
          continue; // No breaks el evento, solo skip el NFT
        }
        
        // 2. Mintar NFT en Polygon
        const mintResult = await mintNFT(
          user.wallet_address,
          eventoId,
          ipfsResult.ipfsHash
        );
        
        if (mintResult.success) {
          // 3. Guardar en Firestore: eventos/eventoId/nfts
          await db.collection('eventos').doc(eventoId)
            .collection('nfts')
            .add({
              userId,
              wallet: user.wallet_address,
              tokenId: mintResult.tokenId,
              transactionHash: mintResult.transactionHash,
              ipfsHash: ipfsResult.ipfsHash,
              mintedAt: new Date(),
            });
          
          console.log(`✓ NFT minted for user ${userId}: ${mintResult.tokenId}`);
        }
      } catch (error) {
        console.error(`NFT minting error for user ${userId}:`, error);
        // Continuar sin fallar el evento
      }
    }
  }
  
  return evento;
}
```

#### 3.2 Agregar wallet_address en signup (app.js)
```javascript
// En js/app.js → función de signup/login

async function registrarUsuario(formData) {
  // [Lógica existente...]
  
  // 🔥 NUEVA: Pedir wallet address
  if (!DEMO) {
    const walletAddress = prompt(
      'Pega tu wallet Polygon (0x...)\n' +
      'Si no tienes, descarga MetaMask: https://metamask.io'
    );
    
    if (!walletAddress || !walletAddress.startsWith('0x')) {
      alert('Wallet inválido. Descarga MetaMask e intenta de nuevo.');
      return;
    }
    
    formData.wallet_address = walletAddress.toLowerCase();
  }
  
  // [Guardar usuario en Firestore...]
}
```

#### 3.3 Dashboard NFTs en panel Cliente (app.js)
```javascript
// En js/app.js → Panel Cliente, nueva sección "Mis NFTs"

function renderPanelCliente(usuario) {
  // [Código existente...]
  
  // 🔥 NUEVA: Mostrar NFTs coleccionados
  const nftSection = `
    <div class="nft-collection">
      <h3>🏆 Mis NFTs de Asistencia</h3>
      <div class="nft-grid">
        ${usuario.nfts?.map(nft => `
          <div class="nft-card">
            <img src="${nft.image_url}" alt="NFT ${nft.token_id}">
            <p><strong>${nft.evento_nombre}</strong></p>
            <p>Zona: ${nft.zona}</p>
            <p>Fecha: ${nft.fecha}</p>
            <a href="https://opensea.io/assets/matic/${NFT_CONFIG.SMART_CONTRACT.ADDRESS}/${nft.token_id}"
               target="_blank">
              Ver en OpenSea →
            </a>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.querySelector('.panel-cliente').insertAdjacentHTML('beforeend', nftSection);
}
```

---

## NUEVOS ARCHIVOS A CREAR

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `js/nft-config.js` | 35 | Configuración blockchain, contract ABI, credenciales IPFS |
| `js/nft-utils.js` | 120 | uploadMetadataToPinata(), mintNFT() |
| `contracts/RondaEventNFT.sol` | 95 | Smart contract ERC-721 con royalties |
| `scripts/deploy-nft.js` | 40 | Hardhat deployment script |
| `docs/RONDA_NFT_Technical_Guide.md` | 80 | Guía técnica para devs |
| `.env.template` (update) | +3 líneas | PINATA_API_KEY, RONDA_PRIVATE_KEY |

---

## CONFIGURACIÓN SEGURIDAD: GOOGLE CLOUD SECRET MANAGER

### Almacenar credenciales en Secret Manager (NO en .env local)
```bash
# En Google Cloud Console o gcloud CLI
gcloud secrets create RONDA_PRIVATE_KEY \
  --replication-policy="automatic" \
  --data-file=- <<< "0x..."

gcloud secrets create PINATA_API_KEY \
  --replication-policy="automatic" \
  --data-file=- <<< "..."

# En Antigravity Cloud Function
const secrets = require('@google-cloud/secret-manager');
const client = new secrets.SecretManagerServiceClient();

async function getSecret(secretId) {
  const name = client.secretVersionPath(PROJECT_ID, secretId, 'latest');
  const [version] = await client.accessSecretVersion({ name });
  return version.payload.data.toString('utf8');
}

const RONDA_PRIVATE_KEY = await getSecret('RONDA_PRIVATE_KEY');
```

---

## FLUJO COMPLETO: USUARIO VE SU NFT (Ejemplo)

```
Usuario "María" asiste evento #42 (Cantina Central, 14 Sept)
       ↓
confirmaSala() ejecuta a las 22:30
       ↓
[Backend] 1. Upload metadata a Pinata
           → QmAbc123...
       ↓
[Backend] 2. Mintar NFT en Polygon Mumbai
           → tokenId = 1337
           → tx hash: 0x7f...
       ↓
[Backend] 3. Guardar en Firestore:
           eventos/42/nfts/{
             "userId": "maria_user_id",
             "wallet": "0xMaria...",
             "tokenId": 1337,
             "transactionHash": "0x7f...",
             "ipfsHash": "QmAbc123...",
             "mintedAt": 2026-09-14T22:30:00Z
           }
       ↓
[Frontend] 4. App de María se actualiza
           → Panel Cliente: "🏆 Mis NFTs"
           → Card: "RONDA Evento #42 — Cantina Central"
           → Botón: "Ver en OpenSea"
       ↓
María abre OpenSea
       ↓
Ve su NFT en collection "RONDA Event NFTs"
→ Puede compartir en redes sociales
→ RONDA recibe 10% royalties en cada venta futura
```

---

## INTEGRACIÓN CON OPENSEA (Automática)

Una vez deployed en Polygon Mainnet, el smart contract se indexa automáticamente:
- **Colección automática** en https://opensea.io/collection/ronda-event-nft
- **Metadatos traídos** desde IPFS cada 24h
- **Royalties configurables** en OpenSea Creator Dashboard
- **Costo:** $0 (OpenSea cobre a compradores en transacciones secundarias)

---

## TIMELINE ESTIMADO

| Fase | Sprint | Hito | Esfuerzo |
|------|--------|------|----------|
| 1 | Semana 1 | Smart contract deployado en Mumbai | 40h dev |
| 1 | Semana 2 | Hardhat setup + testing | 20h dev |
| 2 | Semana 3 | IPFS + Pinata integration | 30h dev |
| 2 | Semana 3 | Cloud Secret Manager setup | 10h devops |
| 3 | Semana 4 | confirmarSala() modified | 25h dev |
| 3 | Semana 4 | QA + mumbai testnet live | 20h QA |
| — | Semana 5 | Mainnet deployment + go-live | 15h devops |
| **Total** | **5 semanas** | **Producción** | **160h** |

---

## MONETIZACIÓN: 3 VECTORES

### 1. Royalties en OpenSea (10%)
```
María vende su NFT por 50.000 COP a Juan
↓
RONDA recibe: 5.000 COP automáticamente
↓
Mes 6 (100+ usuarios asistentes):
~15 NFTs vendidos/mes × 50.000 COP × 10% = 75.000 COP/mes
```

### 2. Premium NFTs ($2–5 USD)
```
Usuario premium acceso:
- NFT edición limitada "Fundador" (primeros 100 eventos)
- NFT "Matches Dorados" (usuarios con ≥3 matches)
- NFT "Barra Certificada" (locals que alcanzan 85%+ ocupación)
```

### 3. NFT Marketplace Interno
```
RONDA marketplace en app:
- Usuarios compran/venden NFTs entre sí (comisión 2.5%)
- Locales compran "Licencia NFT SaaS" transferible
- Crypto-friendly UX integrada
```

---

## RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|--------|-----------|
| Gas fees suben en Polygon | Media | Bajo | Fallback a Arbitrum (compatible EVM) |
| IPFS metadata desaparece | Muy baja | Alto | Pinata + backup en Arweave |
| Smart contract bugs | Muy baja | Crítico | Audit por empresa especializada (2.000–5.000 USD) |
| Usuarios sin wallet | Alta | Medio | Wallet en-app (Magic.link o Thirdweb) |
| Regulación crypto en CO | Media | Crítico | Consultar con abogado fintech colombiano |

---

## PRÓXIMOS PASOS INMEDIATOS

### Semana 1:
- [ ] Setup Polygon dev environment (Hardhat + ganache)
- [ ] Escribir + testear RondaEventNFT.sol
- [ ] Deploy a Mumbai testnet
- [ ] Crear cuenta Pinata

### Semana 2:
- [ ] Integrar web3.js en js/nft-utils.js
- [ ] Crear nft-config.js con ABI + addresses
- [ ] Setup Google Cloud Secret Manager

### Semana 3:
- [ ] Integrar Pinata upload en confirmarSala()
- [ ] Testear mint con 10 NFTs en Mumbai
- [ ] Actualizar app.js para mostrar NFTs

### Semana 4:
- [ ] QA en testnet
- [ ] Audit de smart contract (recomendado)
- [ ] Documentación para devs Antigravity

### Semana 5:
- [ ] Deploy a Polygon Mainnet
- [ ] Verificación en Polygonscan
- [ ] Go-live con usuarios beta

---

## ARCHIVOS DE REFERENCIA

- **OpenSea API:** https://docs.opensea.io/reference/api-overview
- **Polygon Docs:** https://polygon.technology/developers
- **Pinata Docs:** https://docs.pinata.cloud/
- **OpenZeppelin ERC-721:** https://docs.openzeppelin.com/contracts/4.x/erc721
- **Hardhat Docs:** https://hardhat.org/docs

---

**Documento confidencial | Uso interno RONDA | Desarrollo Bogotá 2026**