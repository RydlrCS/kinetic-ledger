// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AttestedMotion
 * @notice ERC-721 motion NFT mint gated by EIP-712 attestation
 * @dev Implements pausable, reentrancy protection, and owner controls
 * - Verifies trusted validator signatures
 * - Prevents replay attacks with nonce + expiry
 * - Emits detailed events for off-chain indexing
 */

error InvalidSigner();
error ExpiredAttestation();
error UsedNonce();
error BadSignatureLength();

contract AttestedMotion is ERC721, ReentrancyGuard, Pausable, Ownable {
    // EIP-712 domain separator components
    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    
    bytes32 public constant MINT_TYPEHASH =
        keccak256("Mint(address to,bytes32 dataHash,uint256 nonce,uint256 expiry)");

    // State variables
    mapping(uint256 => bool) public usedNonce;
    address public validator; // Trusted oracle/agent key
    uint256 public tokenIdSeq;

    // Events for off-chain indexing and narrative building
    event MotionMinted(
        address indexed to,
        uint256 indexed tokenId,
        bytes32 dataHash,
        uint256 nonce,
        uint256 expiry
    );
    
    event ValidatorUpdated(address indexed oldValidator, address indexed newValidator);

    constructor(address _validator) ERC721("MotionNFT", "MOTION") Ownable(msg.sender) {
        require(_validator != address(0), "Invalid validator");
        validator = _validator;
    }

    /**
     * @notice Update the trusted validator address
     * @param _newValidator Address of new validator
     */
    function setValidator(address _newValidator) external onlyOwner {
        require(_newValidator != address(0), "Invalid validator");
        address oldValidator = validator;
        validator = _newValidator;
        emit ValidatorUpdated(oldValidator, _newValidator);
    }

    /**
     * @notice Pause all minting operations
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause minting operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Compute EIP-712 domain separator
     */
    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("AttestedMotion")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Hash the mint parameters for EIP-712 signing
     */
    function _hashMint(
        address to,
        bytes32 dataHash,
        uint256 nonce,
        uint256 expiry
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(MINT_TYPEHASH, to, dataHash, nonce, expiry));
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    /**
     * @notice Mint motion NFT with trusted attestation
     * @param to Recipient address
     * @param dataHash Keccak256 hash of off-chain motion data
     * @param nonce Unique nonce to prevent replay
     * @param expiry Timestamp when attestation expires
     * @param sig EIP-712 signature from validator
     * @return tokenId Minted token ID
     */
    function mintWithAttestation(
        address to,
        bytes32 dataHash,
        uint256 nonce,
        uint256 expiry,
        bytes calldata sig
    ) external nonReentrant whenNotPaused returns (uint256 tokenId) {
        // Validate expiry
        if (block.timestamp > expiry) revert ExpiredAttestation();
        
        // Validate nonce
        if (usedNonce[nonce]) revert UsedNonce();

        // Verify signature
        bytes32 digest = _hashMint(to, dataHash, nonce, expiry);
        address recovered = _recoverSigner(digest, sig);
        if (recovered != validator) revert InvalidSigner();

        // Mark nonce as used
        usedNonce[nonce] = true;
        
        // Mint token
        tokenId = ++tokenIdSeq;
        _safeMint(to, tokenId);

        // Emit detailed event for off-chain indexing
        emit MotionMinted(to, tokenId, dataHash, nonce, expiry);
    }

    /**
     * @notice Recover signer from EIP-712 signature
     */
    function _recoverSigner(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) revert BadSignatureLength();
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        
        if (v < 27) v += 27;
        
        return ecrecover(digest, v, r, s);
    }
}
