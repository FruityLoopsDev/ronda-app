/**
 * RONDA NFT Utilities
 * Funciones para minting NFTs, upload a IPFS, y interacción con blockchain
 */

import NFT_CONFIG, { validateNFTConfig } from './nft-config.js';

/**
 * Subir metadata JSON a Pinata/IPFS
 * @param {Object} eventData - { evento, userAddress, userRole }
 * @returns {Promise<{success: bool, ipfsHash: string, gateway: string, error?: Error}>}
 */
export async function uploadMetadataToPinata(eventData) {
  const { evento, userAddress, userRole } = eventData;

  if (!NFT_CONFIG.IPFS.PINATA_API_KEY) {
    console.error('❌ Pinata API key not configured');
    return { success: false, error: new Error('Pinata not configured') };
  }

  try {
    // 1. Construir metadata JSON
    const metadata = {
      name: `RONDA Evento #${evento.id} — ${evento.local.nombre}`,
      description: `Asistencia verificada a evento RONDA de speed dating en ${evento.local.zona}. Fecha: ${evento.fecha}`,
      image: NFT_CONFIG.METADATA.IMAGE_PLACEHOLDER,
      external_url: `https://ronda.app/evento/${evento.id}`,
      attributes: [
        { trait_type: 'Evento ID', value: String(evento.id) },
        { trait_type: 'Local', value: evento.local.nombre },
        { trait_type: 'Zona', value: evento.local.zona },
        { trait_type: 'Fecha', value: evento.fecha },
        { trait_type: 'Hora Cierre', value: evento.hora_fin },
        { trait_type: 'Matches Realizados', value: String(evento.matches?.length || 0) },
        { trait_type: 'Rol Usuario', value: userRole },
        { trait_type: 'Verificado', value: 'true' },
      ],
    };

    // 2. Convertir metadata a Blob
    const metadataBlob = new Blob([JSON.stringify(metadata)], {
      type: 'application/json',
    });

    // 3. Crear FormData para upload
    const formData = new FormData();
    formData.append('file', metadataBlob, `evento_${evento.id}_metadata.json`);
    formData.append(
      'pinataMetadata',
      JSON.stringify({
        name: `evento_${evento.id}_metadata.json`,
        keyvalues: {
          event_id: evento.id,
          user_address: userAddress,
        },
      })
    );

    // 4. Upload a Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: NFT_CONFIG.IPFS.PINATA_API_KEY,
        pinata_secret_api_key: NFT_CONFIG.IPFS.PINATA_SECRET_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Pinata API error: ${response.statusText}`);
    }

    const data = await response.json();
    const ipfsHash = data.IpfsHash;

    if (NFT_CONFIG.DEBUG) {
      console.log(`✓ Metadata uploaded to IPFS: ${ipfsHash}`);
    }

    return {
      success: true,
      ipfsHash,
      gateway: `${NFT_CONFIG.IPFS.GATEWAY}${ipfsHash}`,
    };
  } catch (error) {
    console.error('❌ Pinata upload failed:', error);
    return { success: false, error };
  }
}

/**
 * Mintar NFT en smart contract (Polygon)
 * @param {string} userAddress - Ethereum address del usuario (0x...)
 * @param {number} eventId - ID del evento en Firestore
 * @param {string} ipfsHash - Hash IPFS de metadata
 * @returns {Promise<{success: bool, transactionHash: string, tokenId: number, error?: Error}>}
 */
export async function mintNFT(userAddress, eventId, ipfsHash) {
  if (!validateNFTConfig()) {
    console.error('❌ NFT Config is invalid');
    return {
      success: false,
      error: new Error('NFT Config incomplete'),
    };
  }

  try {
    // Importar ethers en runtime (evitar bundling issues)
    const { ethers } = await import('ethers');

    // Crear provider y signer con credenciales seguras
    const provider = new ethers.providers.JsonRpcProvider(NFT_CONFIG.POLYGON_RPC);
    const signer = new ethers.Wallet(NFT_CONFIG.RONDA_PRIVATE_KEY, provider);

    // Cargar ABI (importar desde build artifact)
    // const RondaEventNFTABI = (await import('../contracts/RondaEventNFT.json')).default;
    // Para esta versión, usar ABI inline:
    const ABI = getRondaEventNFTABI();

    // Instanciar contrato
    const contract = new ethers.Contract(
      NFT_CONFIG.SMART_CONTRACT.ADDRESS,
      ABI,
      signer
    );

    // Transacción: mint(userAddress, eventId, ipfsHash)
    const tx = await contract.mint(userAddress, eventId, ipfsHash, {
      gasLimit: NFT_CONFIG.SMART_CONTRACT.GAS_LIMIT,
      gasPrice: ethers.utils.parseUnits(NFT_CONFIG.SMART_CONTRACT.GAS_PRICE_GWEI, 'gwei'),
    });

    // Esperar confirmación
    const receipt = await tx.wait(1); // 1 bloque de confirmación

    if (NFT_CONFIG.DEBUG) {
      console.log(`✓ NFT minted successfully`);
      console.log(`  Transaction: ${receipt.transactionHash}`);
    }

    return {
      success: true,
      transactionHash: receipt.transactionHash,
      tokenId: receipt.events[0]?.args?.tokenId?.toNumber() || 0,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('❌ NFT mint failed:', error);
    return { success: false, error };
  }
}

/**
 * Validar que una dirección Ethereum es válida
 * @param {string} address - Dirección a validar
 * @returns {boolean}
 */
export function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Construir URL de OpenSea para ver el NFT
 * @param {number} tokenId - Token ID del NFT
 * @returns {string} URL de OpenSea
 */
export function getOpenSeaURL(tokenId) {
  const baseURL = NFT_CONFIG.OPENSEA.BASE_URL;
  return `${baseURL}/assets/matic/${NFT_CONFIG.SMART_CONTRACT.ADDRESS}/${tokenId}`;
}

/**
 * Construir URL de Polygonscan para ver la transacción
 * @param {string} transactionHash - Hash de transacción
 * @returns {string} URL de Polygonscan
 */
export function getPolygonscanURL(transactionHash) {
  const isMainnet = NFT_CONFIG.ENVIRONMENT === 'production';
  const baseURL = isMainnet
    ? 'https://polygonscan.com'
    : 'https://mumbai.polygonscan.com';
  return `${baseURL}/tx/${transactionHash}`;
}

/**
 * ABI de RondaEventNFT (ERC-721)
 * Esto es una versión minimal; la versión completa viene del build artifact
 */
function getRondaEventNFTABI() {
  return [
    {
      inputs: [
        { internalType: 'address', name: '_userAddress', type: 'address' },
        { internalType: 'uint256', name: '_eventId', type: 'uint256' },
        { internalType: 'string', name: '_ipfsHash', type: 'string' },
      ],
      name: 'mint',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
      name: 'tokenURI',
      outputs: [{ internalType: 'string', name: '', type: 'string' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: 'address', name: 'user', type: 'address' },
        { indexed: true, internalType: 'uint256', name: 'eventId', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      ],
      name: 'NFTMinted',
      type: 'event',
    },
  ];
}

/**
 * Retry logic para operaciones blockchain (gas fluctuations)
 */
export async function retryMintWithBackoff(userAddress, eventId, ipfsHash, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await mintNFT(userAddress, eventId, ipfsHash);
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      // Esperar 5s × intento antes de reintentar
      const delayMs = NFT_CONFIG.NFT_RETRY_DELAY_MS * attempt;
      console.warn(`⚠️  Mint attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

export default {
  uploadMetadataToPinata,
  mintNFT,
  retryMintWithBackoff,
  isValidEthereumAddress,
  getOpenSeaURL,
  getPolygonscanURL,
};
