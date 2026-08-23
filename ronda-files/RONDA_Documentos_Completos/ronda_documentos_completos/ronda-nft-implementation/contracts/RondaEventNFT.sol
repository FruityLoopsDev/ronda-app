// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * RONDA Event NFT
 * Certificados de asistencia a eventos de speed dating en Polygon
 *
 * - Cada usuario que asiste a un evento recibe un NFT verificado
 * - Los NFTs contienen metadata de evento, fecha, zona, matches realizados
 * - RONDA recibe 10% de royalties en ventas secundarias (OpenSea)
 * - Los NFTs NO son transferibles en las primeras 24h post-evento
 */
contract RondaEventNFT is ERC721, ERC721Burnable, Ownable {
  using Counters for Counters.Counter;

  // ============ STATE VARIABLES ============

  Counters.Counter private _tokenIdCounter;
  uint256 public constant ROYALTY_PERCENT = 10; // 10% de royalties
  address public royaltyRecipient; // Wallet que recibe royalties

  // Metadata almacenada on-chain para cada token
  struct EventMetadata {
    uint256 eventId; // ID en Firestore
    address userAddress; // Wallet del usuario
    uint256 mintTimestamp; // Cuándo se acuñó
    string ipfsHash; // Enlace a metadata en IPFS
    bool transferable; // Bloqueado primeras 24h
  }

  mapping(uint256 => EventMetadata) public tokenMetadata;
  mapping(uint256 => uint256) public eventTokenCount; // Tokens emitidos por evento
  mapping(address => uint256) public userTokenCount; // Tokens que posee cada usuario

  // ============ EVENTS ============

  event NFTMinted(
    address indexed user,
    uint256 indexed eventId,
    uint256 indexed tokenId,
    string ipfsHash,
    uint256 timestamp
  );

  event RoyaltyWithdrawn(address indexed recipient, uint256 amount);
  event RoyaltyRecipientUpdated(address indexed newRecipient);

  // ============ CONSTRUCTOR ============

  /**
   * Inicializar contrato
   * @param _royaltyRecipient Address de RONDA que recibe royalties
   */
  constructor(address _royaltyRecipient) ERC721("RONDA Event NFT", "RONDA") {
    require(_royaltyRecipient != address(0), "Invalid royalty recipient");
    royaltyRecipient = _royaltyRecipient;
  }

  // ============ MINTING ============

  /**
   * Acuñar NFT de asistencia
   * Solo puede ser llamado por el dueño (backend autenticado)
   *
   * @param _userAddress Address Ethereum del usuario
   * @param _eventId ID del evento en Firestore
   * @param _ipfsHash Hash IPFS de la metadata del evento
   */
  function mint(
    address _userAddress,
    uint256 _eventId,
    string memory _ipfsHash
  ) external onlyOwner returns (uint256) {
    require(_userAddress != address(0), "Invalid user address");
    require(_eventId > 0, "Invalid event ID");
    require(bytes(_ipfsHash).length > 0, "Invalid IPFS hash");

    uint256 tokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();

    // Acuñar token
    _safeMint(_userAddress, tokenId);

    // Guardar metadata
    tokenMetadata[tokenId] = EventMetadata({
      eventId: _eventId,
      userAddress: _userAddress,
      mintTimestamp: block.timestamp,
      ipfsHash: _ipfsHash,
      transferable: false // Bloqueado por 24h
    });

    eventTokenCount[_eventId]++;
    userTokenCount[_userAddress]++;

    emit NFTMinted(_userAddress, _eventId, tokenId, _ipfsHash, block.timestamp);

    return tokenId;
  }

  // ============ TOKEN URI ============

  /**
   * Obtener URI de metadata (IPFS)
   * OpenSea y otros marketplaces usan esto para cargar metadata
   */
  function tokenURI(uint256 tokenId)
    public
    view
    override
    returns (string memory)
  {
    require(_exists(tokenId), "Token does not exist");
    return string(abi.encodePacked("ipfs://", tokenMetadata[tokenId].ipfsHash));
  }

  // ============ TRANSFER RESTRICTIONS ============

  /**
   * Override _beforeTokenTransfer para bloquear transfers en primeras 24h
   * Evita dumping inmediato post-evento
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId,
    uint256 batchSize
  ) internal override {
    super._beforeTokenTransfer(from, to, tokenId, batchSize);

    // Si es mint, no hay restricción
    if (from == address(0)) {
      return;
    }

    // Verificar si ya pasaron 24h desde el mint
    EventMetadata memory metadata = tokenMetadata[tokenId];
    uint256 elapsedTime = block.timestamp - metadata.mintTimestamp;
    uint256 ONE_DAY = 24 * 60 * 60;

    require(
      elapsedTime >= ONE_DAY,
      "Token locked for 24 hours post-event"
    );
  }

  // ============ ROYALTIES (EIP-2981) ============

  /**
   * Implementar EIP-2981 para royalties automáticas en OpenSea
   * OpenSea lee esto automáticamente para determinar royalties
   */
  function royaltyInfo(uint256 tokenId, uint256 salePrice)
    external
    view
    returns (address, uint256)
  {
    require(_exists(tokenId), "Token does not exist");

    uint256 royaltyAmount = (salePrice * ROYALTY_PERCENT) / 100;
    return (royaltyRecipient, royaltyAmount);
  }

  /**
   * Implementar supportsInterface para EIP-2981
   */
  function supportsInterface(bytes4 interfaceId)
    public
    view
    override
    returns (bool)
  {
    // EIP-2981: Royalty standard
    if (interfaceId == 0x2a55205a) {
      return true;
    }
    return super.supportsInterface(interfaceId);
  }

  // ============ QUERIES ============

  /**
   * Obtener todos los tokens de un usuario
   * Nota: Esto es O(n) y caro en blockchain. Para produción, usar eventos indexados
   */
  function getUserTokens(address user)
    external
    view
    returns (uint256[] memory)
  {
    uint256 balance = balanceOf(user);
    uint256[] memory tokenIds = new uint256[](balance);

    uint256 index = 0;
    for (uint256 i = 0; i < _tokenIdCounter.current(); i++) {
      if (ownerOf(i) == user) {
        tokenIds[index] = i;
        index++;
      }
    }
    return tokenIds;
  }

  /**
   * Contar tokens de un evento
   */
  function getEventTokenCount(uint256 eventId)
    external
    view
    returns (uint256)
  {
    return eventTokenCount[eventId];
  }

  /**
   * Obtener metadata de un token
   */
  function getTokenMetadata(uint256 tokenId)
    external
    view
    returns (EventMetadata memory)
  {
    require(_exists(tokenId), "Token does not exist");
    return tokenMetadata[tokenId];
  }

  /**
   * Verificar si un token es transferible
   */
  function isTransferable(uint256 tokenId) external view returns (bool) {
    require(_exists(tokenId), "Token does not exist");
    uint256 elapsedTime = block.timestamp - tokenMetadata[tokenId].mintTimestamp;
    uint256 ONE_DAY = 24 * 60 * 60;
    return elapsedTime >= ONE_DAY;
  }

  // ============ ADMIN FUNCTIONS ============

  /**
   * Actualizar dirección de royalties
   * Solo owner puede llamar esto
   */
  function setRoyaltyRecipient(address newRecipient) external onlyOwner {
    require(newRecipient != address(0), "Invalid address");
    royaltyRecipient = newRecipient;
    emit RoyaltyRecipientUpdated(newRecipient);
  }

  /**
   * Retirar fondos acumulados (si alguna vez pasan directamente al contrato)
   * Nota: Los royalties de OpenSea van directamente a royaltyRecipient
   */
  function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    require(balance > 0, "No balance to withdraw");

    (bool success, ) = payable(royaltyRecipient).call{value: balance}("");
    require(success, "Withdrawal failed");

    emit RoyaltyWithdrawn(royaltyRecipient, balance);
  }

  // ============ METADATA HOOKS ============

  /**
   * Hook para actualizar metadata en IPFS (si es necesario corregir)
   * Muy pocos casos de uso; se recomienda NO usar esto en producción
   */
  function updateIPFSHash(uint256 tokenId, string memory newIPFSHash)
    external
    onlyOwner
  {
    require(_exists(tokenId), "Token does not exist");
    tokenMetadata[tokenId].ipfsHash = newIPFSHash;
  }

  // ============ FALLBACK ============

  /**
   * Rechazar ETH enviados accidentalmente
   */
  receive() external payable {
    revert("This contract does not accept ETH");
  }
}
