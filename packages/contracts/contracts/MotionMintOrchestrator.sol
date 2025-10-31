// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AttestedMotion.sol";
import "./MotionNoveltyDetector.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MotionMintOrchestrator
 * @notice Orchestrates the complete flow: novelty detection → token minting → reward distribution
 * @dev Integrates MotionNoveltyDetector with AttestedMotion and RewardsEscrow for end-to-end automation
 * 
 * Flow:
 * 1. AI agent submits motion embedding to MotionNoveltyDetector
 * 2. If novel (passes RkCNN threshold), proceed to step 3
 * 3. Mint AttestedMotion NFT with compliance metadata
 * 4. Optional: Trigger reward distribution via RewardsEscrow
 * 
 * Research Context: Kinetic Ledger - Agentic AI Meets Blockchain
 * This contract implements the "MotionMint Protocol" described in Section 3.2
 */
contract MotionMintOrchestrator {
    /// @notice Novelty detection engine
    MotionNoveltyDetector public immutable noveltyDetector;

    /// @notice Motion token registry
    AttestedMotion public immutable attestedMotion;

    /// @notice Reward escrow (optional, can be zero address)
    address public rewardsEscrow;

    /// @notice Mapping of embedding hash to minted token ID
    mapping(bytes32 => uint256) public embeddingToToken;

    /// @notice Mapping of token ID to embedding hash (reverse lookup)
    mapping(uint256 => bytes32) public tokenToEmbedding;

    /// @notice Auto-mint configuration
    struct MintConfig {
        bool autoMintEnabled;
        bool autoRewardEnabled;
        uint256 rewardAmountPerToken; // In wei/USDC cents
        address rewardToken;           // ERC20 token address (e.g., USDC)
    }

    MintConfig public mintConfig;

    /// @notice Events
    event NovelMotionMinted(
        bytes32 indexed embeddingHash,
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 confidenceScore
    );

    event RewardDistributed(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amount,
        address token
    );

    event MintConfigUpdated(
        bool autoMintEnabled,
        bool autoRewardEnabled,
        uint256 rewardAmountPerToken
    );

    /// @notice Custom errors
    error NoveltyVerificationFailed();
    error TokenAlreadyMinted(bytes32 embeddingHash, uint256 tokenId);
    error AutoMintDisabled();
    error InvalidRewardConfiguration();

    constructor(
        address _noveltyDetector,
        address _attestedMotion,
        address _rewardsEscrow
    ) {
        noveltyDetector = MotionNoveltyDetector(_noveltyDetector);
        attestedMotion = AttestedMotion(_attestedMotion);
        rewardsEscrow = _rewardsEscrow;

        // Default config: auto-mint enabled, no rewards
        mintConfig = MintConfig({
            autoMintEnabled: true,
            autoRewardEnabled: false,
            rewardAmountPerToken: 0,
            rewardToken: address(0)
        });
    }

    /**
     * @notice Complete flow: verify novelty + mint token + distribute reward
     * @dev Combines novelty detection and token minting in single transaction
     * @param noveltyAttestation Attestation from AI agent
     * @param noveltySignature EIP-712 signature for novelty
     * @param compliance Compliance metadata per Kenya VASP Act
     * @param recipient Address to receive the minted token
     * @param dataHash Hash of the motion data (stored in token metadata)
     * @param mintNonce Nonce for minting operation
     * @param mintExpiry Expiry timestamp for mint attestation
     * @param mintSignature EIP-712 signature for minting
     * @return tokenId The minted token ID
     */
    function verifyAndMint(
        MotionNoveltyDetector.NoveltyAttestation calldata noveltyAttestation,
        bytes calldata noveltySignature,
        MotionNoveltyDetector.ComplianceMetadata calldata compliance,
        address recipient,
        bytes32 dataHash,
        uint256 mintNonce,
        uint256 mintExpiry,
        bytes calldata mintSignature
    ) external returns (uint256 tokenId) {
        if (!mintConfig.autoMintEnabled) {
            revert AutoMintDisabled();
        }

        // Step 1: Verify novelty via MotionNoveltyDetector
        bool isNovel = noveltyDetector.verifyNovelty(
            noveltyAttestation,
            noveltySignature,
            compliance
        );

        if (!isNovel) {
            revert NoveltyVerificationFailed();
        }

        // Step 2: Check if already minted
        bytes32 embeddingHash = noveltyAttestation.embeddingHash;
        if (embeddingToToken[embeddingHash] != 0) {
            revert TokenAlreadyMinted(embeddingHash, embeddingToToken[embeddingHash]);
        }

        // Step 3: Mint AttestedMotion NFT
        tokenId = attestedMotion.mintWithAttestation(
            recipient,
            dataHash,
            mintNonce,
            mintExpiry,
            mintSignature
        );

        // Step 4: Record mapping
        embeddingToToken[embeddingHash] = tokenId;
        tokenToEmbedding[tokenId] = embeddingHash;

        emit NovelMotionMinted(
            embeddingHash,
            tokenId,
            recipient,
            noveltyAttestation.confidenceScore
        );

        // Step 5: Optional reward distribution
        if (mintConfig.autoRewardEnabled && mintConfig.rewardAmountPerToken > 0) {
            _distributeReward(tokenId, recipient);
        }

        return tokenId;
    }

    /**
     * @notice Internal reward distribution logic
     * @dev Transfers ERC20 tokens (e.g., USDC) from escrow to recipient
     * @param tokenId The minted token ID
     * @param recipient Address to receive rewards
     */
    function _distributeReward(uint256 tokenId, address recipient) internal {
        if (mintConfig.rewardToken == address(0)) {
            revert InvalidRewardConfiguration();
        }

        IERC20 token = IERC20(mintConfig.rewardToken);
        
        // Transfer from this contract (assumes contract holds reward tokens)
        // In production, this would interact with RewardsEscrow contract
        bool success = token.transfer(recipient, mintConfig.rewardAmountPerToken);
        require(success, "Reward transfer failed");

        emit RewardDistributed(
            tokenId,
            recipient,
            mintConfig.rewardAmountPerToken,
            mintConfig.rewardToken
        );
    }

    /**
     * @notice Get complete motion record (novelty + token + compliance)
     * @dev Aggregates data from NoveltyDetector and AttestedMotion for auditing
     * @param embeddingHash Hash of the motion embedding
     * @return noveltyRecord Novelty detection record
     * @return complianceMetadata Compliance metadata
     * @return tokenId Minted token ID
     * @return tokenOwner Current token owner
     */
    function getMotionRecord(bytes32 embeddingHash) 
        external 
        view 
        returns (
            MotionNoveltyDetector.NoveltyRecord memory noveltyRecord,
            MotionNoveltyDetector.ComplianceMetadata memory complianceMetadata,
            uint256 tokenId,
            address tokenOwner
        ) 
    {
        noveltyRecord = noveltyDetector.getNoveltyRecord(embeddingHash);
        complianceMetadata = noveltyDetector.getComplianceMetadata(embeddingHash);
        tokenId = embeddingToToken[embeddingHash];
        
        if (tokenId != 0) {
            tokenOwner = attestedMotion.ownerOf(tokenId);
        }
    }
}
