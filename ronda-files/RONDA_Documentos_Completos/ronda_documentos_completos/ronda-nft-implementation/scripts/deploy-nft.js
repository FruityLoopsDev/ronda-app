/**
 * Hardhat Deployment Script para RondaEventNFT
 *
 * Uso:
 *   npx hardhat run scripts/deploy-nft.js --network mumbai
 *   npx hardhat run scripts/deploy-nft.js --network polygon
 *
 * Requiere:
 *   - .env.local con RONDA_PRIVATE_KEY
 *   - Accounts[0] debe tener ~0.1 MATIC para gas
 */

const hre = require('hardhat');

async function main() {
  console.log('🚀 Deploying RONDA Event NFT...');

  // Obtener signer (deployer)
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log(`📍 Network: ${network}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  // Dirección que recibe royalties (RONDA treasury)
  // En producción, esto viene de environment variables
  const royaltyRecipient = process.env.RONDA_TREASURY_WALLET || deployer.address;

  console.log(`\n📋 Deploying RondaEventNFT:`);
  console.log(`  - Royalty recipient: ${royaltyRecipient}`);
  console.log(`  - Royalty percent: 10%`);

  // Deploy
  const RondaEventNFT = await hre.ethers.getContractFactory('RondaEventNFT');
  const nft = await RondaEventNFT.deploy(royaltyRecipient);
  await nft.deployed();

  console.log(`\n✅ RondaEventNFT deployed to: ${nft.address}`);

  // Guardar address en archivo de configuración
  const addresses = {
    RondaEventNFT: nft.address,
    network: network,
    deployer: deployer.address,
    royaltyRecipient: royaltyRecipient,
    deploymentBlockNumber: await hre.ethers.provider.getBlockNumber(),
    deploymentDate: new Date().toISOString(),
  };

  const fs = require('fs');
  const deploymentPath = `./deployments/${network}_deployment.json`;

  // Crear directorio si no existe
  if (!fs.existsSync('./deployments')) {
    fs.mkdirSync('./deployments');
  }

  fs.writeFileSync(deploymentPath, JSON.stringify(addresses, null, 2));
  console.log(`\n📝 Deployment saved to: ${deploymentPath}`);

  // ============ VERIFICACIÓN EN EXPLORER ============

  if (network === 'polygon' || network === 'mumbai') {
    const explorerUrl =
      network === 'polygon'
        ? `https://polygonscan.com/address/${nft.address}`
        : `https://mumbai.polygonscan.com/address/${nft.address}`;

    console.log(`\n🔍 View on block explorer:`);
    console.log(`   ${explorerUrl}`);

    // Attempt automatic verification (si Etherscan API key está configurada)
    if (process.env.ETHERSCAN_API_KEY) {
      console.log('\n⏳ Waiting 6 blocks before verification...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      try {
        console.log('📤 Verifying contract on Etherscan...');
        await hre.run('verify:verify', {
          address: nft.address,
          constructorArguments: [royaltyRecipient],
        });
        console.log('✅ Contract verified!');
      } catch (error) {
        console.log('⚠️  Verification failed (puede intentarse manualmente después)');
        console.log(error.message);
      }
    }
  }

  // ============ TEST MINT EN TESTNET ============

  if (network === 'mumbai') {
    console.log('\n🧪 Testing mint functionality...');

    try {
      const testEventId = 1;
      const testIpfsHash = 'QmTestHash123456789';
      const testUserAddress = deployer.address;

      const tx = await nft.mint(testUserAddress, testEventId, testIpfsHash);
      const receipt = await tx.wait();

      console.log(`✅ Test mint successful!`);
      console.log(`   Token ID: 0`);
      console.log(`   Event ID: ${testEventId}`);
      console.log(`   Tx: ${receipt.transactionHash}`);

      // Verificar que se puede leer el metadata
      const tokenURI = await nft.tokenURI(0);
      console.log(`   Token URI: ${tokenURI}`);
    } catch (error) {
      console.error('❌ Test mint failed:', error.message);
    }
  }

  console.log('\n✨ Deployment complete!');
  console.log('\n📚 Next steps:');
  console.log('1. Guardar RondaEventNFT address en nft-config.js');
  console.log('2. Verificar en block explorer que el contrato es deployable');
  console.log('3. Configurar verificación automática en Etherscan (opcional)');
  console.log('4. Usar mainnet deployment cuando esté listo para production\n');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
