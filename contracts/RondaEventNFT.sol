// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RondaEventNFT is ERC721, Ownable {
    uint256 private _nextTokenId;
    
    uint256 public constant ROYALTY_PERCENT = 10; // 10% a RONDA
    address public royaltyRecipient;
    
    struct EventMetadata {
        uint256 eventId;
        address userAddress;
        uint256 mintTimestamp;
        string ipfsHash;
    }
    
    mapping(uint256 => EventMetadata) public tokenMetadata;
    mapping(uint256 => uint256) public eventTokenCount; // Eventos con NFTs emitidos
    
    event NFTMinted(address indexed user, uint256 indexed eventId, uint256 tokenId);
    event RoyaltyPaid(address indexed recipient, uint256 amount);
    
    constructor(address _royaltyRecipient) ERC721("RONDA Event NFT", "RONDA") Ownable(msg.sender) {
        royaltyRecipient = _royaltyRecipient;
    }
    
    function mint(
        address _userAddress,
        uint256 _eventId,
        string memory _ipfsHash
    ) external onlyOwner {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        _safeMint(_userAddress, tokenId);
        
        tokenMetadata[tokenId] = EventMetadata(
            _eventId,
            _userAddress,
            block.timestamp,
            _ipfsHash
        );
        
        eventTokenCount[_eventId]++;
        emit NFTMinted(_userAddress, _eventId, tokenId);
    }
    
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        _requireOwned(tokenId);
        return string(abi.encodePacked(
            "ipfs://",
            tokenMetadata[tokenId].ipfsHash
        ));
    }
}
