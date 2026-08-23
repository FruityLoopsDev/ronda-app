/**
 * RONDA NFT Configuration
 * Blockchain: Polygon (Mumbai Testnet → Mainnet)
 * Token Standard: ERC-721 (OpenZeppelin)
 * IPFS Provider: Pinata
 */

export const NFT_CONFIG = {
  // ============ NETWORK CONFIGURATION ============
  ENVIRONMENT: process.env.NODE_ENV || 'development',

  // Mumbai Testnet (desarrollo)
  POLYGON_MUMBAI_RPC: 'https://rpc-mumbai.maticvigil.com',
  POLYGON_MUMBAI_CHAINID: 80001,

  // Polygon Mainnet (producción)
  POLYGON_MAINNET_RPC: 'https://polygon-rpc.com',
  POLYGON_MAINNET_CHAINID: 137,

  // Seleccionar RPC según ambiente
  get POLYGON_RPC() {
    return this.ENVIRONMENT === 'production'
      ? this.POLYGON_MAINNET_RPC
      : this.POLYGON_MUMBAI_RPC;
  },

  get CHAIN_ID() {
    return this.ENVIRONMENT === 'production'
      ? this.POLYGON_MAINNET_CHAINID
      : this.POLYGON_MUMBAI_CHAINID;
  },

  // ============ SMART CONTRACT ============
  SMART_CONTRACT: {
    // Mumbai Testnet (reemplazar con dirección actual después de deploy)
    ADDRESS_MUMBAI: '0x...',
    // Polygon Mainnet
    ADDRESS_MAINNET: '0x...',

    get ADDRESS() {
      return process.env.NODE_ENV === 'production'
        ? this.ADDRESS_MAINNET
        : this.ADDRESS_MUMBAI;
    },

    // ABI será importada de build artifact
    // import RondaEventNFTABI from '../contracts/RondaEventNFT.json';

    GAS_LIMIT: 150000,
    GAS_PRICE_GWEI: '50', // Polygon es barato: ~$0.02 por mint
  },

  // ============ RONDA WALLETS ============
  // Guardar en Google Cloud Secret Manager, NO en código
  RONDA_TREASURY_WALLET: process.env.RONDA_TREASURY_WALLET || '0x7A...',
  RONDA_PRIVATE_KEY: process.env.RONDA_PRIVATE_KEY, // ⚠️ SECRETO

  // ============ IPFS / PINATA ============
  IPFS: {
    PROVIDER: 'pinata',
    // Credenciales en Secret Manager
    PINATA_API_KEY: process.env.PINATA_API_KEY,
    PINATA_SECRET_KEY: process.env.PINATA_SECRET_KEY,
    // Gateway pública para leer
    GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
    // Fallback gateway
    GATEWAY_FALLBACK: 'https://ipfs.io/ipfs/',
  },

  // ============ OPENSEA ============
  OPENSEA: {
    // Colección será creada automáticamente después de primer mint
    COLLECTION_NAME: 'RONDA Event NFTs',
    COLLECTION_SLUG: 'ronda-event-nfts',
    TESTNET_URL: 'https://testnets.opensea.io',
    MAINNET_URL: 'https://opensea.io',

    get BASE_URL() {
      return process.env.NODE_ENV === 'production'
        ? this.MAINNET_URL
        : this.TESTNET_URL;
    },
  },

  // ============ NFT PRICING & ECONOMICS ============
  NFT_ECONOMICS: {
    ROYALTY_PERCENT: 10, // 10% de ventas secundarias van a RONDA
    // Precios en USD (convertir a COP cuando sea necesario)
    GAS_COST_USD: 0.02, // Costo promedio por mint en Polygon
    GAS_COST_COP: 76, // 0.02 USD × 3800 COP

    // Revenue share
    MINT_PROFIT_MARGIN_PCT: 85, // 85% de lo que el usuario pague es margen
  },

  // ============ METADATA DEFAULTS ============
  METADATA: {
    IMAGE_PLACEHOLDER: 'ipfs://QmPlaceholder/evento_default_badge.png',
    // Atributos estándar en todos los NFTs
    STANDARD_ATTRIBUTES: [
      'Evento ID',
      'Local',
      'Zona',
      'Fecha',
      'Hora Cierre',
      'Matches Realizados',
      'Rol Usuario',
    ],
  },

  // ============ ERROR HANDLING ============
  // Si NFT falla, no debe romper el evento
  NFT_FAILURE_MODE: 'silent', // 'silent' | 'retry' | 'alert'
  NFT_RETRY_ATTEMPTS: 3,
  NFT_RETRY_DELAY_MS: 5000,

  // ============ LOGGING ============
  DEBUG: process.env.DEBUG === 'true',
  LOG_NFT_TRANSACTIONS: true,
};

/**
 * Validar configuración en startup
 */
export function validateNFTConfig() {
  const required = [
    'POLYGON_RPC',
    'SMART_CONTRACT.ADDRESS',
    'RONDA_TREASURY_WALLET',
  ];

  const missing = required.filter(key => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], NFT_CONFIG);
    return !value || value.startsWith('0x...');
  });

  if (missing.length > 0) {
    console.warn(`⚠️  NFT Config incomplete: ${missing.join(', ')}`);
    console.warn('NFT minting will be disabled until all config is set.');
    return false;
  }

  if (NFT_CONFIG.DEBUG) {
    console.log('✓ NFT Config validated');
    console.log(`  Environment: ${NFT_CONFIG.ENVIRONMENT}`);
    console.log(`  Chain: Polygon ${NFT_CONFIG.CHAIN_ID === 137 ? 'Mainnet' : 'Mumbai'}`);
  }

  return true;
}

export default NFT_CONFIG;
