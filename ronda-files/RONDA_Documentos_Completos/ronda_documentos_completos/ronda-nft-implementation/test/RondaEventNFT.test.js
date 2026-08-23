/**
 * Tests para RondaEventNFT Smart Contract
 * Ejecutar: npx hardhat test
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('RondaEventNFT', function () {
  let nft;
  let deployer, user1, user2, royaltyRecipient;

  beforeEach(async function () {
    [deployer, user1, user2, royaltyRecipient] = await ethers.getSigners();

    // Deploy contract
    const RondaEventNFT = await ethers.getContractFactory('RondaEventNFT');
    nft = await RondaEventNFT.deploy(royaltyRecipient.address);
    await nft.deployed();
  });

  describe('Deployment', function () {
    it('Debería deployar con royalty recipient correcto', async function () {
      expect(await nft.royaltyRecipient()).to.equal(royaltyRecipient.address);
    });

    it('Debería tener nombre y símbolo correcto', async function () {
      expect(await nft.name()).to.equal('RONDA Event NFT');
      expect(await nft.symbol()).to.equal('RONDA');
    });

    it('Debería tener royalty percent de 10%', async function () {
      expect(await nft.ROYALTY_PERCENT()).to.equal(10);
    });
  });

  describe('Minting', function () {
    it('Debería mintar un NFT correctamente', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);

      expect(await nft.balanceOf(user1.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(user1.address);
    });

    it('Debería fallar si user address es inválido', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await expect(
        nft.mint(ethers.constants.AddressZero, eventId, ipfsHash)
      ).to.be.revertedWith('Invalid user address');
    });

    it('Debería fallar si event ID es 0', async function () {
      const eventId = 0;
      const ipfsHash = 'QmTestHash123';

      await expect(
        nft.mint(user1.address, eventId, ipfsHash)
      ).to.be.revertedWith('Invalid event ID');
    });

    it('Debería fallar si IPFS hash está vacío', async function () {
      const eventId = 1;
      const ipfsHash = '';

      await expect(
        nft.mint(user1.address, eventId, ipfsHash)
      ).to.be.revertedWith('Invalid IPFS hash');
    });

    it('Debería emitir evento NFTMinted', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      const tx = nft.mint(user1.address, eventId, ipfsHash);

      await expect(tx)
        .to.emit(nft, 'NFTMinted')
        .withArgs(
          user1.address,
          eventId,
          0, // tokenId
          ipfsHash,
          (await ethers.provider.getBlockNumber()) + 1
        );
    });

    it('Debería incrementar counter después de mint', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);
      await nft.mint(user2.address, eventId, ipfsHash);
      await nft.mint(user1.address, eventId + 1, ipfsHash);

      expect(await nft.balanceOf(user1.address)).to.equal(2);
      expect(await nft.balanceOf(user2.address)).to.equal(1);
      expect(await nft.userTokenCount(user1.address)).to.equal(2);
    });
  });

  describe('Token URI', function () {
    it('Debería retornar IPFS gateway URL', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);

      const tokenURI = await nft.tokenURI(0);
      expect(tokenURI).to.equal(`ipfs://${ipfsHash}`);
    });

    it('Debería fallar si token no existe', async function () {
      await expect(nft.tokenURI(999)).to.be.revertedWith('Token does not exist');
    });
  });

  describe('Transfer Restrictions (24h lock)', function () {
    it('Debería bloquear transfers dentro de 24h', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);

      // Intentar transferir inmediatamente
      await expect(
        nft.connect(user1).transferFrom(user1.address, user2.address, 0)
      ).to.be.revertedWith('Token locked for 24 hours post-event');
    });

    it('Debería permitir transfers después de 24h', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);

      // Avanzar tiempo 24h + 1 segundo
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60 + 1]);
      await ethers.provider.send('evm_mine');

      // Debería funcionar ahora
      await nft.connect(user1).transferFrom(user1.address, user2.address, 0);

      expect(await nft.ownerOf(0)).to.equal(user2.address);
    });

    it('isTransferable debería retornar true/false correctamente', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);

      // Inmediatamente después del mint
      expect(await nft.isTransferable(0)).to.equal(false);

      // Después de 24h
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60 + 1]);
      await ethers.provider.send('evm_mine');

      expect(await nft.isTransferable(0)).to.equal(true);
    });
  });

  describe('Royalties (EIP-2981)', function () {
    it('Debería calcular royalties correctamente', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);

      const salePrice = ethers.utils.parseEther('10'); // 10 MATIC
      const [recipient, royaltyAmount] = await nft.royaltyInfo(0, salePrice);

      expect(recipient).to.equal(royaltyRecipient.address);
      expect(royaltyAmount).to.equal(ethers.utils.parseEther('1')); // 10%
    });

    it('supportsInterface debería retornar true para EIP-2981', async function () {
      const EIP2981InterfaceId = '0x2a55205a';
      expect(await nft.supportsInterface(EIP2981InterfaceId)).to.equal(true);
    });
  });

  describe('Event Metadata Tracking', function () {
    it('Debería contar NFTs por evento', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);
      await nft.mint(user2.address, eventId, ipfsHash);
      await nft.mint(user1.address, 2, ipfsHash); // Diferente evento

      expect(await nft.getEventTokenCount(eventId)).to.equal(2);
      expect(await nft.getEventTokenCount(2)).to.equal(1);
    });

    it('Debería guardar metadata correctamente', async function () {
      const eventId = 42;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);

      const metadata = await nft.getTokenMetadata(0);
      expect(metadata.eventId).to.equal(eventId);
      expect(metadata.userAddress).to.equal(user1.address);
      expect(metadata.ipfsHash).to.equal(ipfsHash);
      expect(metadata.transferable).to.equal(false);
    });
  });

  describe('Admin Functions', function () {
    it('Solo owner puede mintar', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await expect(
        nft.connect(user1).mint(user2.address, eventId, ipfsHash)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Solo owner puede actualizar royalty recipient', async function () {
      await nft.setRoyaltyRecipient(user1.address);

      expect(await nft.royaltyRecipient()).to.equal(user1.address);

      await expect(
        nft.connect(user2).setRoyaltyRecipient(user2.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Debería emitir evento al actualizar royalty recipient', async function () {
      await expect(nft.setRoyaltyRecipient(user1.address))
        .to.emit(nft, 'RoyaltyRecipientUpdated')
        .withArgs(user1.address);
    });

    it('No debería permitir royalty recipient inválido (address 0)', async function () {
      await expect(
        nft.setRoyaltyRecipient(ethers.constants.AddressZero)
      ).to.be.revertedWith('Invalid address');
    });
  });

  describe('Gas Efficiency', function () {
    it('Mint debería usar razonable gas (~150k)', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      const tx = await nft.mint(user1.address, eventId, ipfsHash);
      const receipt = await tx.wait();

      console.log(`  Gas used for mint: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(ethers.BigNumber.from('200000'));
    });
  });

  describe('Burn Functionality (ERC721Burnable)', function () {
    it('Owner puede quemar su NFT', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);
      expect(await nft.balanceOf(user1.address)).to.equal(1);

      await nft.connect(user1).burn(0);
      expect(await nft.balanceOf(user1.address)).to.equal(0);
    });

    it('No-owner no puede quemar NFT ajeno', async function () {
      const eventId = 1;
      const ipfsHash = 'QmTestHash123';

      await nft.mint(user1.address, eventId, ipfsHash);

      await expect(nft.connect(user2).burn(0)).to.be.revertedWith(
        'ERC721Burnable: caller is not owner nor approved'
      );
    });
  });
});

describe('RONDA NFT Integration (E2E)', function () {
  // Estos tests pueden usar la app completa + smart contract
  // Por ahora, son placeholders para testing E2E futuro

  it('[TODO] Debería completar flujo completo: evento → IPFS → mint', async function () {
    // 1. Crear evento en Firestore
    // 2. Confirmar evento
    // 3. Ejecutar confirmarSala() con NFT logic
    // 4. Verificar IPFS metadata
    // 5. Verificar NFT minted en blockchain
    // 6. Verificar en OpenSea
  });

  it('[TODO] Debería manejar fallos de IPFS sin romper evento', async function () {
    // 1. Simular fallo de Pinata
    // 2. Ejecutar confirmarSala()
    // 3. Evento debe completarse OK
    // 4. NFT skip sin fallar
  });

  it('[TODO] Debería respetar royalties en OpenSea', async function () {
    // 1. Verificar que OpenSea lee EIP-2981
    // 2. Simular venta en secondary market
    // 3. Verificar que 10% va a royaltyRecipient
  });
});
