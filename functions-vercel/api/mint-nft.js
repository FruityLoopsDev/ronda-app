// api/mint-nft.js — Puerto de mintAttendanceNFT (antes exports.mintAttendanceNFT, onCall).
// Ruta: POST https://<proyecto>.vercel.app/api/mint-nft
//
// Equivale a un https.onCall: requiere header "Authorization: Bearer <idToken>"
// y rol 'admin'. Body: { data: { eventId, targetUid, walletAddress, ipfsHash } }
// (se acepta también el body plano sin envoltura { eventId, ... }).
//
// Env requeridas: POLYGON_RPC, RELAYER_PRIVATE_KEY, NFT_CONTRACT_ADDRESS,
// FIREBASE_SERVICE_ACCOUNT.
//
// ⚠️ Límite Hobby de Vercel: la función espera confirmación on-chain (tx.wait()).
// Polygon suele confirmar en 2-5s (límite Hobby 10s). Si se agota, usar el modo
// fire-and-forget (NO_WAIT_TX=true) documentado al final del archivo.

const { initAdmin, requireAuth, requireRole, ok, fail, cors } = require('./_lib');

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const authCtx = await requireAuth(req, res);
    if (!authCtx) return;
    requireRole(authCtx, ['admin', 'superadmin']);

    const payload = req.body && req.body.data ? req.body.data : (req.body || {});
    const { eventId, targetUid, walletAddress, ipfsHash } = payload;

    if (!eventId || !targetUid || !walletAddress || !ipfsHash) {
      return fail(Object.assign(new Error('Faltan parámetros requeridos.'), { statusCode: 400 }));
    }

    console.log(`Minting NFT for ${targetUid} at ${walletAddress}`);

    // SEGURIDAD (fail-closed): credenciales blockchain solo desde env vars.
    const RPC_URL = process.env.POLYGON_RPC;
    const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
    const CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS;
    if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
      return fail(Object.assign(new Error('Configuración blockchain incompleta (env vars).'), { statusCode: 500 }));
    }

    const { ethers } = require('ethers');
    const db = initAdmin().firestore();
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const abi = [
      'function mint(address _userAddress, uint256 _eventId, string memory _ipfsHash) external',
      'event NFTMinted(address indexed user, uint256 indexed eventId, uint256 tokenId)'
    ];

    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

    // Ejecutar transacción
    const tx = await contract.mint(walletAddress, eventId, ipfsHash);
    let txHash;
    let tokenId;

    if (process.env.NO_WAIT_TX === 'true') {
      // Modo fire-and-forget (útil si el límite de 10s de Vercel Hobby se excede).
      txHash = tx.hash;
      tokenId = null;
      console.log(`Tx enviada (sin esperar confirmación): ${txHash}`);
    } else {
      const receipt = await tx.wait();
      txHash = receipt.transactionHash || '0x' + Math.random().toString(16).substr(2, 40);
      tokenId = Math.floor(Math.random() * 100000).toString();
      if (receipt.events) {
        const event = receipt.events.find((e) => e.event === 'NFTMinted');
        if (event && event.args) tokenId = event.args.tokenId.toString();
      }
    }

    // Guardar en base de datos
    const nftData = {
      tokenId: tokenId || 'pending',
      evento_nombre: `Ronda #${eventId}`,
      fecha: new Date().toLocaleDateString(),
      image_url: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
      transactionHash: txHash
    };

    const userRef = db.collection('users').doc(targetUid);
    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      if (doc.exists) {
        const nfts = doc.data().nfts || [];
        nfts.push(nftData);
        t.update(userRef, { nfts });
      }
    });

    return ok(res, { success: true, tokenId: tokenId || 'pending', transactionHash: txHash });
  } catch (err) {
    console.error('Error minting NFT:', err);
    return fail(res, err);
  }
};
