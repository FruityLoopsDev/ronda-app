// nft-utils.js: Funcionalidades de simulación Web3 para el entorno DEMO

class NFTUtils {
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
      gateway: `${window.NFT_CONFIG.IPFS.GATEWAY}${mockHash}`
    };
  }

  // Simular la acuñación (minting) en el smart contract de Polygon
  async mintNFT(userAddress, eventId, ipfsHash) {
    console.log(`[NFT Simulation] Iniciando mint en smart contract para: ${userAddress}`);
    
    // Retraso de minado del bloque (0.8 segundos)
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockTokenId = Math.floor(Math.random() * 90000) + 10000;
    const mockTxHash = "0x" + Array.from({length: 64}, () => "0123456789abcdef".charAt(Math.floor(Math.random() * 16))).join('');
    
    console.log(`[NFT Simulation] ✓ NFT Minted! TokenID: ${mockTokenId}. TxHash: ${mockTxHash}`);
    
    return {
      success: true,
      tokenId: mockTokenId,
      transactionHash: mockTxHash
    };
  }
}

window.NFTUtils = new NFTUtils();
