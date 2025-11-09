// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title BlendedMotionRegistry
 * @author Kinetic Ledger Team
 * @notice Registry for blended motion sequence metadata with on-chain attestation
 * @dev Stores blend metadata with EIP-712 signature verification from trusted validators
 *
 * Architecture:
 * - Motion blending service computes keccak256 hash of 512-D embedding
 * - Trusted validator signs blend metadata with EIP-712
 * - Registry verifies signature and stores metadata on-chain
 * - Metadata includes source hashes, weights, quality metrics
 *
 * Integration with Kinetic Ledger:
 * 1. Blend service creates smooth motion from 2-3 source BVH files
 * 2. Extract embedding hash (keccak256)
 * 3. Validator signs BlendAttestation with embedding hash + metadata
 * 4. Registry stores metadata (emits BlendRegistered event)
 * 5. MotionNoveltyDetector can verify blend is novel
 * 6. MotionMintOrchestrator mints ERC-721 token
 *
 * Quality Metrics:
 * - velocity_continuity: Max velocity discontinuity (lower is better)
 * - acceleration_smoothness: Max acceleration spike (lower is better)
 * - foot_contact_stability: Foot sliding distance (lower is better)
 * - overall_score: Combined score 0-100 (higher is better, min 80)
 */
contract BlendedMotionRegistry is Ownable, EIP712 {
    using ECDSA for bytes32;

    // ========================================================================
    // State Variables
    // ========================================================================

    /// @notice Trusted validator address (AI agent that signs blend attestations)
    address public validator;

    /// @notice Counter for total blends registered
    uint256 public totalBlends;

    /// @notice Mapping from embedding hash to blend metadata
    mapping(bytes32 => BlendMetadata) public blendRecords;

    /// @notice Mapping from embedding hash to registration status
    mapping(bytes32 => bool) public isRegistered;

    // ========================================================================
    // Structs
    // ========================================================================

    /**
     * @notice Metadata for a blended motion sequence
     * @param embeddingHash keccak256 hash of 512-D blended embedding
     * @param sourceHashes Array of keccak256 hashes for 2-3 source motions
     * @param blendWeights Array of blend weights (scaled by 10000, sum = 10000)
     * @param transitionFrame Primary transition point (frame index)
     * @param frameCount Total number of frames in blended motion
     * @param jointCount Number of joints in skeleton
     * @param qualityScore Overall quality score 0-10000 (scaled, 10000 = 100%)
     * @param velocityContinuity Velocity discontinuity metric (scaled by 1e6)
     * @param accelerationSmoothness Acceleration smoothness metric (scaled by 1e6)
     * @param footContactStability Foot contact stability metric (scaled by 1e6)
     * @param timestamp Block timestamp when registered
     * @param blendAgent Address of AI agent that performed blend
     */
    struct BlendMetadata {
        bytes32 embeddingHash;
        bytes32[] sourceHashes;
        uint256[] blendWeights;
        uint256 transitionFrame;
        uint256 frameCount;
        uint256 jointCount;
        uint256 qualityScore;
        uint256 velocityContinuity;
        uint256 accelerationSmoothness;
        uint256 footContactStability;
        uint256 timestamp;
        address blendAgent;
    }

    /**
     * @notice EIP-712 attestation for blend registration
     * @param embeddingHash keccak256 hash of blended embedding
     * @param sourceHashes Array of source motion hashes
     * @param blendWeights Array of blend weights (sum = 10000)
     * @param transitionFrame Primary transition point
     * @param frameCount Total frames in blend
     * @param jointCount Number of joints
     * @param qualityScore Overall quality 0-10000
     * @param velocityContinuity Velocity metric (scaled)
     * @param accelerationSmoothness Acceleration metric (scaled)
     * @param footContactStability Foot metric (scaled)
     * @param blendAgent Address of blending agent
     * @param nonce Unique nonce to prevent replay attacks
     * @param expiry Expiration timestamp for signature
     */
    struct BlendAttestation {
        bytes32 embeddingHash;
        bytes32[] sourceHashes;
        uint256[] blendWeights;
        uint256 transitionFrame;
        uint256 frameCount;
        uint256 jointCount;
        uint256 qualityScore;
        uint256 velocityContinuity;
        uint256 accelerationSmoothness;
        uint256 footContactStability;
        address blendAgent;
        uint256 nonce;
        uint256 expiry;
    }

    // ========================================================================
    // Events
    // ========================================================================

    /**
     * @notice Emitted when a blended motion is registered
     * @param embeddingHash Hash of blended embedding
     * @param sourceHashes Hashes of source motions
     * @param blendWeights Blend weights (sum = 10000)
     * @param qualityScore Overall quality 0-10000
     * @param blendAgent Address of blending agent
     * @param timestamp Block timestamp
     */
    event BlendRegistered(
        bytes32 indexed embeddingHash,
        bytes32[] sourceHashes,
        uint256[] blendWeights,
        uint256 qualityScore,
        address indexed blendAgent,
        uint256 timestamp
    );

    /**
     * @notice Emitted when validator address is updated
     * @param oldValidator Previous validator address
     * @param newValidator New validator address
     */
    event ValidatorUpdated(address indexed oldValidator, address indexed newValidator);

    // ========================================================================
    // Errors
    // ========================================================================

    error InvalidValidator();
    error AlreadyRegistered(bytes32 embeddingHash);
    error InvalidSignature();
    error ExpiredSignature(uint256 expiry, uint256 currentTime);
    error InvalidSourceCount(uint256 count);
    error InvalidWeightsSum(uint256 sum);
    error QualityBelowThreshold(uint256 score, uint256 threshold);
    error InvalidNonce(uint256 nonce, uint256 expected);

    // ========================================================================
    // Constructor
    // ========================================================================

    /**
     * @notice Initialize registry with validator address
     * @param _validator Address of trusted validator (AI agent)
     */
    constructor(address _validator) Ownable(msg.sender) EIP712("BlendedMotionRegistry", "1") {
        if (_validator == address(0)) revert InvalidValidator();
        validator = _validator;
        emit ValidatorUpdated(address(0), _validator);
    }

    // ========================================================================
    // Type Hash
    // ========================================================================

    /// @notice EIP-712 type hash for BlendAttestation
    bytes32 public constant BLEND_ATTESTATION_TYPEHASH =
        keccak256(
            "BlendAttestation("
            "bytes32 embeddingHash,"
            "bytes32[] sourceHashes,"
            "uint256[] blendWeights,"
            "uint256 transitionFrame,"
            "uint256 frameCount,"
            "uint256 jointCount,"
            "uint256 qualityScore,"
            "uint256 velocityContinuity,"
            "uint256 accelerationSmoothness,"
            "uint256 footContactStability,"
            "address blendAgent,"
            "uint256 nonce,"
            "uint256 expiry"
            ")"
        );

    // ========================================================================
    // Nonce Management
    // ========================================================================

    /// @notice Nonces for blend agents to prevent replay attacks
    mapping(address => uint256) public nonces;

    // ========================================================================
    // Quality Threshold
    // ========================================================================

    /// @notice Minimum quality score required (default: 8000 = 80%)
    uint256 public qualityThreshold = 8000;

    /**
     * @notice Update quality threshold (only owner)
     * @param _threshold New minimum quality score 0-10000
     */
    function setQualityThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold <= 10000, "Threshold too high");
        qualityThreshold = _threshold;
    }

    // ========================================================================
    // Validator Management
    // ========================================================================

    /**
     * @notice Update trusted validator address (only owner)
     * @param _newValidator Address of new validator
     */
    function setValidator(address _newValidator) external onlyOwner {
        if (_newValidator == address(0)) revert InvalidValidator();
        address oldValidator = validator;
        validator = _newValidator;
        emit ValidatorUpdated(oldValidator, _newValidator);
    }

    // ========================================================================
    // Core Functions
    // ========================================================================

    /**
     * @notice Register a blended motion with validator signature
     * @param attestation BlendAttestation with metadata and signature parameters
     * @param signature EIP-712 signature from trusted validator
     *
     * Requirements:
     * - Signature must be valid and from trusted validator
     * - Signature must not be expired
     * - Embedding hash must not already be registered
     * - Must have 2-3 source motions
     * - Blend weights must sum to 10000
     * - Quality score must meet threshold
     * - Nonce must match expected value
     *
     * Emits:
     * - BlendRegistered event
     */
    function registerBlend(BlendAttestation calldata attestation, bytes calldata signature)
        external
        returns (bool)
    {
        // ====================================================================
        // 1. Validate Inputs
        // ====================================================================

        if (isRegistered[attestation.embeddingHash]) {
            revert AlreadyRegistered(attestation.embeddingHash);
        }

        if (attestation.sourceHashes.length < 2 || attestation.sourceHashes.length > 3) {
            revert InvalidSourceCount(attestation.sourceHashes.length);
        }

        if (attestation.sourceHashes.length != attestation.blendWeights.length) {
            revert InvalidSourceCount(attestation.blendWeights.length);
        }

        // Verify weights sum to 10000
        uint256 weightsSum = 0;
        for (uint256 i = 0; i < attestation.blendWeights.length; i++) {
            weightsSum += attestation.blendWeights[i];
        }
        if (weightsSum != 10000) {
            revert InvalidWeightsSum(weightsSum);
        }

        // Verify quality meets threshold
        if (attestation.qualityScore < qualityThreshold) {
            revert QualityBelowThreshold(attestation.qualityScore, qualityThreshold);
        }

        // Verify signature not expired
        if (block.timestamp > attestation.expiry) {
            revert ExpiredSignature(attestation.expiry, block.timestamp);
        }

        // Verify nonce
        uint256 expectedNonce = nonces[attestation.blendAgent];
        if (attestation.nonce != expectedNonce) {
            revert InvalidNonce(attestation.nonce, expectedNonce);
        }

        // ====================================================================
        // 2. Verify EIP-712 Signature
        // ====================================================================

        bytes32 structHash = keccak256(
            abi.encode(
                BLEND_ATTESTATION_TYPEHASH,
                attestation.embeddingHash,
                keccak256(abi.encodePacked(attestation.sourceHashes)),
                keccak256(abi.encodePacked(attestation.blendWeights)),
                attestation.transitionFrame,
                attestation.frameCount,
                attestation.jointCount,
                attestation.qualityScore,
                attestation.velocityContinuity,
                attestation.accelerationSmoothness,
                attestation.footContactStability,
                attestation.blendAgent,
                attestation.nonce,
                attestation.expiry
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = digest.recover(signature);

        if (recoveredSigner != validator) {
            revert InvalidSignature();
        }

        // ====================================================================
        // 3. Store Blend Metadata
        // ====================================================================

        BlendMetadata storage metadata = blendRecords[attestation.embeddingHash];
        metadata.embeddingHash = attestation.embeddingHash;
        metadata.sourceHashes = attestation.sourceHashes;
        metadata.blendWeights = attestation.blendWeights;
        metadata.transitionFrame = attestation.transitionFrame;
        metadata.frameCount = attestation.frameCount;
        metadata.jointCount = attestation.jointCount;
        metadata.qualityScore = attestation.qualityScore;
        metadata.velocityContinuity = attestation.velocityContinuity;
        metadata.accelerationSmoothness = attestation.accelerationSmoothness;
        metadata.footContactStability = attestation.footContactStability;
        metadata.timestamp = block.timestamp;
        metadata.blendAgent = attestation.blendAgent;

        isRegistered[attestation.embeddingHash] = true;
        nonces[attestation.blendAgent]++;
        totalBlends++;

        // ====================================================================
        // 4. Emit Event
        // ====================================================================

        emit BlendRegistered(
            attestation.embeddingHash,
            attestation.sourceHashes,
            attestation.blendWeights,
            attestation.qualityScore,
            attestation.blendAgent,
            block.timestamp
        );

        return true;
    }

    // ========================================================================
    // View Functions
    // ========================================================================

    /**
     * @notice Get blend metadata for a given embedding hash
     * @param embeddingHash keccak256 hash of blended embedding
     * @return metadata BlendMetadata struct
     */
    function getBlendMetadata(bytes32 embeddingHash) external view returns (BlendMetadata memory) {
        return blendRecords[embeddingHash];
    }

    /**
     * @notice Check if an embedding hash is registered
     * @param embeddingHash keccak256 hash to check
     * @return registered True if registered, false otherwise
     */
    function isBlendRegistered(bytes32 embeddingHash) external view returns (bool) {
        return isRegistered[embeddingHash];
    }

    /**
     * @notice Get current nonce for a blend agent
     * @param blendAgent Address of blend agent
     * @return nonce Current nonce value
     */
    function getNonce(address blendAgent) external view returns (uint256) {
        return nonces[blendAgent];
    }

    /**
     * @notice Compute EIP-712 hash for BlendAttestation (for off-chain signing)
     * @param attestation BlendAttestation struct
     * @return digest EIP-712 typed data hash
     */
    function hashBlendAttestation(BlendAttestation calldata attestation)
        external
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                BLEND_ATTESTATION_TYPEHASH,
                attestation.embeddingHash,
                keccak256(abi.encodePacked(attestation.sourceHashes)),
                keccak256(abi.encodePacked(attestation.blendWeights)),
                attestation.transitionFrame,
                attestation.frameCount,
                attestation.jointCount,
                attestation.qualityScore,
                attestation.velocityContinuity,
                attestation.accelerationSmoothness,
                attestation.footContactStability,
                attestation.blendAgent,
                attestation.nonce,
                attestation.expiry
            )
        );

        return _hashTypedDataV4(structHash);
    }
}
