// scripts/deploy-nft.js
// Script de depliegue con Hardhat para RondaEventNFT

const hre = require("hardhat");

async function main() {
  const royaltyRecipient = "0x7A23d5389658E29e843fB7A6C32b9CD7987B5760"; // Ronda Treasury
  
  console.log("Desplegando RondaEventNFT...");
  
  const RondaEventNFT = await hre.ethers.getContractFactory("RondaEventNFT");
  const contract = await RondaEventNFT.deploy(royaltyRecipient);

  await contract.deployed();

  console.log(`✓ RondaEventNFT desplegado exitosamente en: ${contract.address}`);
  console.log(`✓ Recipiente de regalías configurado: ${royaltyRecipient}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
