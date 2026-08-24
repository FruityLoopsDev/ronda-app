import { Auth } from './auth.js';
import { RondaServices } from './firebase-config.js';

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

  // Llamar a la Cloud Function para el minting
  async mintNFT(userAddress, eventId, ipfsHash) {
    console.log(`[NFT] Llamando a Firebase Function 'mintAttendanceNFT' para: ${userAddress}`);
    
    try {
      if (!firebaseModules) throw new Error("Firebase no inicializado");
      
      // Asegurar que getFunctions y httpsCallable están disponibles (requiere importación en index.html)
      
      
      const functions = getFunctions(RondaServices.app);
      
      // Conectar al emulador si estamos en localhost
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        connectFunctionsEmulator(functions, "localhost", 5001);
      }
      
      const mintAttendanceNFT = httpsCallable(functions, 'mintAttendanceNFT');
      
      const result = await mintAttendanceNFT({
        eventId: eventId,
        targetUid: userAddress, // Asumiendo que enviamos el UID como targetUid
        walletAddress: Auth.currentUser.wallet_address || userAddress,
        ipfsHash: ipfsHash
      });
      
      console.log(`[NFT] ✓ NFT Minted exitosamente por la función:`, result.data);
      
      return {
        success: true,
        tokenId: result.data.tokenId,
        transactionHash: result.data.transactionHash
      };
    } catch (err) {
      console.error("[NFT] Error llamando a la función de minting:", err);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

export const NFTUtils = new NFTUtilsService();
