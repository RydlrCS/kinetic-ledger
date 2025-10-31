// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title MotionNoveltyDetector
 * @notice On-chain novelty detection for motion embeddings using Random k Conditional Nearest Neighbor (RkCNN)
 * @dev Implements the high-dimensional novelty detection algorithm described in the Kinetic Ledger research paper
 * 
 * Key Features:
 * - Random subspace ensemble voting for curse of dimensionality mitigation
 * - Adaptive thresholding based on local density estimation
 * - Multi-agent attestation support per ERC-8001
 * - Compliance metadata embedding (Kenya VASP Act 2025)
 * 
 * Architecture:
 * - Off-chain AI agents compute RkCNN scores using full 512-D embeddings
 * - Agents submit compressed novelty attestations (hash + confidence score)
 * - Contract verifies signatures and enforces thresholds
 * - Integrates with AttestedMotion.sol for token minting
 * 
 * Research Reference: Lu, Y., Gweon, H. (2025). Random k Conditional Nearest Neighbor
 * for High-Dimensional Data. PeerJ Computer Science, 11:e2497
 */
contract MotionNoveltyDetector is Ownable, EIP712 {
    using ECDSA for bytes32;

    /// @notice EIP-712 type hash for novelty attestations
    bytes32 public constant NOVELTY_ATTESTATION_TYPEHASH = keccak256(
        "NoveltyAttestation(address agent,bytes32 embeddingHash,uint256 confidenceScore,uint256 localDensity,uint256 nonce,uint256 expiry)"
    );

    /// @notice Minimum confidence score (0-10000 basis points, 9500 = 95%)
    uint256 public noveltyThreshold = 9500;

    /// @notice Adaptive threshold range (min/max allowed)
    uint256 public constant MIN_THRESHOLD = 8500; // 85%
    uint256 public constant MAX_THRESHOLD = 9900; // 99%

    /// @notice Maximum age of attestation before expiry (seconds)
    uint256 public constant MAX_ATTESTATION_AGE = 300; // 5 minutes

    /// @notice Authorized AI agents (validator addresses)
    mapping(address => bool) public authorizedAgents;

    /// @notice Agent nonces for replay protection
    mapping(address => uint256) public agentNonces;

    /// @notice Known motion embeddings (hash -> novelty score at time of acceptance)
    mapping(bytes32 => NoveltyRecord) public knownEmbeddings;

    /// @notice Local density buckets for adaptive thresholding
    /// @dev Maps density range (0-100) to count of embeddings in that range
    mapping(uint256 => uint256) public densityDistribution;

    /// @notice Total embeddings registered
    uint256 public totalEmbeddings;

    /// @notice Novelty record structure
    struct NoveltyRecord {
        uint256 confidenceScore;
        uint256 localDensity;
        uint256 timestamp;
        address agent;
        bool isNovel;
    }

    /// @notice Novelty attestation structure
    struct NoveltyAttestation {
        address agent;
        bytes32 embeddingHash;
        uint256 confidenceScore; // 0-10000 basis points
        uint256 localDensity;    // 0-10000 basis points (density estimate)
        uint256 nonce;
        uint256 expiry;
    }

    /// @notice Compliance metadata for Kenya VASP Act 2025
    struct ComplianceMetadata {
        bytes32 dataOriginHash;    // Hash of raw sensor data for authenticity
        string jurisdictionTag;     // e.g., "KE", "EU", "US"
        bool userConsent;           // Data subject consent flag
        string vaspLicenseId;       // Service provider license identifier
    }

    /// @notice Compliance data per embedding
    mapping(bytes32 => ComplianceMetadata) public complianceData;

    /// @notice Events
    event NovelMotionDetected(
        bytes32 indexed embeddingHash,
        uint256 confidenceScore,
        uint256 localDensity,
        address indexed agent,
        uint256 timestamp
    );

    event KnownMotionRejected(
        bytes32 indexed embeddingHash,
        uint256 confidenceScore,
        uint256 threshold,
        address indexed agent
    );

    event ThresholdAdjusted(
        uint256 oldThreshold,
        uint256 newThreshold,
        uint256 triggerDensity
    );

    event AgentAuthorized(address indexed agent, bool authorized);

    event ComplianceRecorded(
        bytes32 indexed embeddingHash,
        string jurisdictionTag,
        string vaspLicenseId
    );

    /// @notice Custom errors
    error UnauthorizedAgent(address agent);
    error ExpiredAttestation(uint256 expiry, uint256 currentTime);
    error InvalidNonce(uint256 expected, uint256 provided);
    error InvalidSignature();
    error BelowNoveltyThreshold(uint256 score, uint256 threshold);
    error EmbeddingAlreadyKnown(bytes32 embeddingHash);
    error InvalidThreshold(uint256 threshold);
    error MissingComplianceData();
    error InvalidConfidenceScore(uint256 score);

    constructor(address initialOwner) 
        Ownable(initialOwner)
        EIP712("MotionNoveltyDetector", "1")
    {}

    /**
     * @notice Verify and record a novel motion embedding
     * @dev Implements RkCNN-based novelty verification with EIP-712 signatures
     * @param attestation The novelty attestation data
     * @param signature EIP-712 signature from authorized agent
     * @param compliance Compliance metadata per Kenya VASP Act
     * @return isNovel Whether the motion was accepted as novel
     */
    function verifyNovelty(
        NoveltyAttestation calldata attestation,
        bytes calldata signature,
        ComplianceMetadata calldata compliance
    ) external returns (bool isNovel) {
        // Step 1-4: Verify attestation validity
        _verifyAttestation(attestation, signature);

        // Step 5: Compliance validation
        _verifyCompliance(compliance);

        // Step 6-9: Novelty decision
        isNovel = _processNovelty(attestation, compliance);

        return isNovel;
    }

    /**
     * @notice Internal: Verify attestation signature and validity
     */
    function _verifyAttestation(
        NoveltyAttestation calldata attestation,
        bytes calldata signature
    ) internal {
        // Authorization check
        if (!authorizedAgents[attestation.agent]) {
            revert UnauthorizedAgent(attestation.agent);
        }

        // Expiry check
        if (block.timestamp > attestation.expiry) {
            revert ExpiredAttestation(attestation.expiry, block.timestamp);
        }

        // Nonce verification
        if (attestation.nonce != agentNonces[attestation.agent]) {
            revert InvalidNonce(agentNonces[attestation.agent], attestation.nonce);
        }

        // Confidence score validation
        if (attestation.confidenceScore > 10000) {
            revert InvalidConfidenceScore(attestation.confidenceScore);
        }

        // Signature verification
        bytes32 structHash = keccak256(abi.encode(
            NOVELTY_ATTESTATION_TYPEHASH,
            attestation.agent,
            attestation.embeddingHash,
            attestation.confidenceScore,
            attestation.localDensity,
            attestation.nonce,
            attestation.expiry
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        if (signer != attestation.agent) {
            revert InvalidSignature();
        }
    }

    /**
     * @notice Internal: Verify compliance metadata
     */
    function _verifyCompliance(ComplianceMetadata calldata compliance) internal pure {
        if (!compliance.userConsent || bytes(compliance.vaspLicenseId).length == 0) {
            revert MissingComplianceData();
        }
    }

    /**
     * @notice Internal: Process novelty decision and record
     */
    function _processNovelty(
        NoveltyAttestation calldata attestation,
        ComplianceMetadata calldata compliance
    ) internal returns (bool) {
        // Check if already known
        if (knownEmbeddings[attestation.embeddingHash].timestamp != 0) {
            revert EmbeddingAlreadyKnown(attestation.embeddingHash);
        }

        // Adaptive threshold calculation
        uint256 currentThreshold = _calculateAdaptiveThreshold(attestation.localDensity);

        // Novelty decision
        bool isNovel = attestation.confidenceScore >= currentThreshold;

        if (!isNovel) {
            emit KnownMotionRejected(
                attestation.embeddingHash,
                attestation.confidenceScore,
                currentThreshold,
                attestation.agent
            );
            revert BelowNoveltyThreshold(attestation.confidenceScore, currentThreshold);
        }

        // Record novel embedding
        knownEmbeddings[attestation.embeddingHash] = NoveltyRecord({
            confidenceScore: attestation.confidenceScore,
            localDensity: attestation.localDensity,
            timestamp: block.timestamp,
            agent: attestation.agent,
            isNovel: true
        });

        // Record compliance
        complianceData[attestation.embeddingHash] = compliance;

        // Update density distribution
        uint256 densityBucket = attestation.localDensity / 100;
        densityDistribution[densityBucket]++;
        totalEmbeddings++;

        // Increment nonce
        agentNonces[attestation.agent]++;

        emit NovelMotionDetected(
            attestation.embeddingHash,
            attestation.confidenceScore,
            attestation.localDensity,
            attestation.agent,
            block.timestamp
        );

        emit ComplianceRecorded(
            attestation.embeddingHash,
            compliance.jurisdictionTag,
            compliance.vaspLicenseId
        );

        return true;
    }

    /**
     * @notice Calculate adaptive novelty threshold based on local density
     * @dev Implements density-aware thresholding as described in Kinetic Ledger paper
     * 
     * Logic:
     * - Sparse regions (low density): Lower threshold (encourage diversity)
     * - Dense regions (high density): Higher threshold (avoid duplicates)
     * 
     * @param localDensity Density estimate in basis points (0-10000)
     * @return threshold Adaptive threshold in basis points
     */
    function _calculateAdaptiveThreshold(uint256 localDensity) internal view returns (uint256 threshold) {
        // Inverse relationship: higher density -> higher threshold
        // Formula: threshold = base + (density_factor * localDensity / 10000)
        
        uint256 densityFactor = 400; // Max adjustment: ±4%
        
        if (localDensity < 3000) {
            // Sparse region: lower threshold
            threshold = noveltyThreshold - ((3000 - localDensity) * densityFactor / 3000);
        } else if (localDensity > 7000) {
            // Dense region: higher threshold
            threshold = noveltyThreshold + ((localDensity - 7000) * densityFactor / 3000);
        } else {
            // Medium density: use base threshold
            threshold = noveltyThreshold;
        }

        // Clamp to allowed range
        if (threshold < MIN_THRESHOLD) threshold = MIN_THRESHOLD;
        if (threshold > MAX_THRESHOLD) threshold = MAX_THRESHOLD;

        return threshold;
    }

    /**
     * @notice Batch verify multiple novelty attestations (gas optimization)
     * @dev Useful for processing buffered motion events
     * @param attestations Array of attestations
     * @param signatures Array of corresponding signatures
     * @param complianceMetadata Array of compliance data
     * @return results Boolean array of novelty results
     */
    function batchVerifyNovelty(
        NoveltyAttestation[] calldata attestations,
        bytes[] calldata signatures,
        ComplianceMetadata[] calldata complianceMetadata
    ) external returns (bool[] memory results) {
        uint256 len = attestations.length;
        require(len == signatures.length && len == complianceMetadata.length, "Array length mismatch");

        results = new bool[](len);

        for (uint256 i; i < len;) {
            try this.verifyNovelty(attestations[i], signatures[i], complianceMetadata[i]) {
                results[i] = true;
            } catch {
                results[i] = false;
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Authorize or revoke an AI agent
     * @param agent Agent address
     * @param authorized Authorization status
     */
    function setAgentAuthorization(address agent, bool authorized) external onlyOwner {
        authorizedAgents[agent] = authorized;
        emit AgentAuthorized(agent, authorized);
    }

    /**
     * @notice Update base novelty threshold
     * @dev Admin function for tuning system sensitivity
     * @param newThreshold New threshold in basis points (8500-9900)
     */
    function setNoveltyThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold < MIN_THRESHOLD || newThreshold > MAX_THRESHOLD) {
            revert InvalidThreshold(newThreshold);
        }

        uint256 oldThreshold = noveltyThreshold;
        noveltyThreshold = newThreshold;

        emit ThresholdAdjusted(oldThreshold, newThreshold, 0);
    }

    /**
     * @notice Get novelty record for a given embedding
     * @param embeddingHash Hash of the motion embedding
     * @return record The novelty record
     */
    function getNoveltyRecord(bytes32 embeddingHash) external view returns (NoveltyRecord memory record) {
        return knownEmbeddings[embeddingHash];
    }

    /**
     * @notice Get compliance metadata for a given embedding
     * @param embeddingHash Hash of the motion embedding
     * @return metadata The compliance metadata
     */
    function getComplianceMetadata(bytes32 embeddingHash) external view returns (ComplianceMetadata memory metadata) {
        return complianceData[embeddingHash];
    }

    /**
     * @notice Calculate expected adaptive threshold for a given density
     * @dev Helper for off-chain agents to predict threshold
     * @param localDensity Density estimate in basis points
     * @return threshold Expected threshold
     */
    function getAdaptiveThreshold(uint256 localDensity) external view returns (uint256 threshold) {
        return _calculateAdaptiveThreshold(localDensity);
    }

    /**
     * @notice Get density distribution statistics
     * @param bucket Specific bucket to query (0-100)
     * @return count Count of embeddings in that bucket
     * @return total Total embeddings
     */
    function getDensityBucket(uint256 bucket) external view returns (uint256 count, uint256 total) {
        require(bucket <= 100, "Bucket out of range");
        return (densityDistribution[bucket], totalEmbeddings);
    }

    /**
     * @notice Get total embeddings count
     */
    function getTotalEmbeddings() external view returns (uint256) {
        return totalEmbeddings;
    }

    /**
     * @notice Validate compliance for regulatory audit
     * @dev Used by Kenya VASP auditors to verify licensing
     * @param embeddingHash Hash of the motion embedding
     * @return isCompliant Whether embedding meets compliance requirements
     * @return metadata Full compliance metadata
     */
    function auditCompliance(bytes32 embeddingHash) 
        external 
        view 
        returns (bool isCompliant, ComplianceMetadata memory metadata) 
    {
        metadata = complianceData[embeddingHash];
        
        isCompliant = (
            metadata.userConsent &&
            bytes(metadata.vaspLicenseId).length > 0 &&
            bytes(metadata.jurisdictionTag).length > 0 &&
            knownEmbeddings[embeddingHash].timestamp != 0
        );

        return (isCompliant, metadata);
    }
}
