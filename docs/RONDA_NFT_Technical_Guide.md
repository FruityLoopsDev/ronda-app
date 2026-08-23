# Guía Técnica de Integración de NFTs en RONDA

## 1. Contrato Inteligente
El contrato inteligente `RondaEventNFT.sol` está diseñado bajo el estándar **ERC-721** de OpenZeppelin. 
Se encuentra ubicado en `/contracts/RondaEventNFT.sol`.

### Funcionalidades Clave:
- **`mint(address _userAddress, uint256 _eventId, string memory _ipfsHash)`**: Acuña un nuevo NFT de asistencia para la dirección wallet indicada, asignando el URI que apunta a los metadatos de IPFS.
- **Regalías (Royalties)**: Configurado para cobrar un `10%` en transacciones secundarias en OpenSea a favor de la wallet de la tesorería de RONDA.

## 2. Despliegue en Polygon
Para desplegar el contrato real en la red de pruebas **Mumbai** de Polygon o en la red principal **Polygon Mainnet**, sigue estos pasos con Hardhat:

1. Configura tus llaves privadas y endpoints de RPC en el archivo `.env`.
2. Ejecuta el script de despliegue:
   ```bash
   npx hardhat run scripts/deploy-nft.js --network mumbai
   ```
3. Copia la dirección del contrato generado y actualízala en `public/js/nft-config.js` dentro del objeto `SMART_CONTRACT.ADDRESS`.

## 3. Modo de Simulación (Demo)
Dado que el proyecto se encuentra en modo DEMO (`DEMO_MODE = true` en `firebase-config.js`), las transacciones blockchain y la subida de archivos a IPFS se ejecutan de manera **totalmente simulada** a través del módulo `/public/js/nft-utils.js`.

Esto permite probar el comportamiento completo de la plataforma localmente sin consumir MATIC real y sin necesidad de credenciales reales de Pinata.
Cuando se finalice el evento desde el panel del anfitrión:
1. Se generará un hash mock de IPFS.
2. Se generará una transacción de Polygon simulada con su hash correspondiente.
3. El NFT se inyectará en el perfil del usuario activo para que pueda visualizar su badge.
