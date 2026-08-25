// nft-config.js: Configuración de la capa Web3 / NFT para RONDA

export const NFT_CONFIG = {
  POLYGON_RPC: 'https://polygon-rpc.com',
  POLYGON_MUMBAI_RPC: 'https://rpc-mumbai.maticvigil.com',
  RONDA_WALLET_ADDRESS: '0x7A23d5389658E29e843fB7A6C32b9CD7987B5760', // Treasury wallet
  
  SMART_CONTRACT: {
    ADDRESS: '0x9C28c20579e00000000000000000000000000000', // Mock deployed contract address
    ABI: [
      "function mint(address _userAddress, uint256 _eventId, string memory _ipfsHash) external",
      "function tokenURI(uint256 tokenId) public view returns (string memory)",
      "event NFTMinted(address indexed user, uint256 indexed eventId, uint256 tokenId)"
    ]
  },
  
  IPFS: {
    GATEWAY: 'https://gateway.pinata.cloud/ipfs/'
  }
};
