import { Auth } from './auth.js';
import { RondaServices } from './firebase-config.js';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { NFT_CONFIG } from './nft-config.js';

// nft-utils.js: Funcionalidades de simulación Web3 para el entorno DEMO

class NFTUtilsService {
  // Simular la subida de metadatos a Pinata (IPFS)
  async uploadMetadataToPinata(eventData, userRole) {
    console.log("[NFT Simulation] Generando metadatos para IPFS...");
    
    const { eventId, local, fecha, matchesCount } = eventData;
    
    // Retraso simulado de red
    await new Promise(resolve => setTimeout(resolve, 600));

    // Generar un hash IPFS realista
    const mockHash = "Qm" + Array.from({length: 44}, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(Math.floor(Math.random() * 62))).join('');
    
    console.log(`[NFT Simulation] Metadatos subidos a IPFS exitosamente. Hash: ${mockHash}`);
    
    return {
      success: true,
      ipfsHash: mockHash,
      gateway: `${NFT_CONFIG.IPFS.GATEWAY}${mockHash}`
    };
  }

  // Llamar a la API Serverless en Vercel para el minting real, con fallback a simulación
  async mintNFT(userAddress, eventId, ipfsHash) {
    // 1. Intentar delegar al backend (Vercel API) si está configurado
    if ((import.meta as any).env?.VITE_VERCEL_API_URL) {
      try {
        const { API } = await import('./api-client.js');
        if (API.isConfigured) {
          console.log(`[NFT] Ejecutando minting real via Vercel Serverless API para: ${userAddress}`);
          const result = await API.post<any>('/api/mint-nft', { 
            userAddress, 
            eventId, 
            ipfsHash 
          });
          console.log(`[NFT] ✓ NFT Minted exitosamente en servidor.`);
          return result;
        }
      } catch (err) {
        console.warn("[NFT] Falló llamada a Vercel API para minting, usando fallback simulado:", err);
      }
    }

    // 2. Fallback de simulación
    console.log(`[NFT] Simulando minting (API Serverless no configurada/falló) para: ${userAddress}`);
    
    // Retraso simulado
    await new Promise(resolve => setTimeout(resolve, 800));

    const mockTxHash = "0x" + Array.from({length: 64}, () => "abcdef0123456789".charAt(Math.floor(Math.random() * 16))).join('');
    const mockTokenId = Math.floor(Math.random() * 10000).toString();

    console.log(`[NFT] ✓ NFT Minted simulado exitosamente.`);
    
    return {
      success: true,
      tokenId: mockTokenId,
      transactionHash: mockTxHash
    };
  }
}

export const NFTUtils = new NFTUtilsService();
