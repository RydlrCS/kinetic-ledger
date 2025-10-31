# Motion Novelty Detection - Smart Contracts

## Overview

This directory contains the smart contracts implementing the **Random k Conditional Nearest Neighbor (RkCNN)** novelty detection algorithm described in the Kinetic Ledger research paper: "Agentic AI Meets Blockchain: Kinetic Ledger for Motion Tokenization in a Compliant Cloud Ecosystem."

## Architecture

The novelty detection system consists of two main contracts:

### 1. MotionNoveltyDetector.sol
**Purpose**: On-chain verification of motion embedding novelty using RkCNN ensemble voting

**Key Features**:
- **Adaptive Thresholding**: Dynamically adjusts novelty threshold based on local density estimation
  - Sparse regions (low density): Lower threshold to encourage diversity
  - Dense regions (high density): Higher threshold to avoid duplicates
- **Multi-Agent Attestation**: ERC-8001 compliant attestation framework for autonomous AI agents
- **Compliance Metadata**: Kenya VASP Act 2025 compliance with provenance tracking
- **Replay Protection**: Nonce-based replay attack prevention
- **EIP-712 Signatures**: Typed structured data signing for agent attestations

**Research Reference**:
> Lu, Y., Gweon, H. (2025). Random k Conditional Nearest Neighbor for High-Dimensional Data. PeerJ Computer Science, 11:e2497

**Core Algorithm**:
```
if min_j(||f_θ(x_i) - f_θ(x_j)||_2) > δ:
    motion is novel → mint token
else:
    motion is known → reject
```

Where:
- `f_θ(x_i)` = 512-D motion embedding from MotionBlend AI engine
- `δ` = adaptive novelty threshold (base: 95%, range: 85%-99%)
- Off-chain: RkCNN ensemble computes confidence score across random subspaces

**Contract Functions**:

| Function | Purpose | Access |
|----------|---------|--------|
| `verifyNovelty()` | Verify and record novel motion embedding | External (authorized agents) |
| `batchVerifyNovelty()` | Batch processing for buffered events | External |
| `setAgentAuthorization()` | Authorize/revoke AI agents | Owner only |
| `setNoveltyThreshold()` | Update base threshold (8500-9900 bps) | Owner only |
| `getAdaptiveThreshold()` | Calculate threshold for given density | View |
| `auditCompliance()` | Validate compliance for regulatory audit | View |

**Events**:
- `NovelMotionDetected(embeddingHash, confidenceScore, localDensity, agent, timestamp)`
- `KnownMotionRejected(embeddingHash, confidenceScore, threshold, agent)`
- `ComplianceRecorded(embeddingHash, jurisdictionTag, vaspLicenseId)`
- `ThresholdAdjusted(oldThreshold, newThreshold, triggerDensity)`
- `AgentAuthorized(agent, authorized)`

**Storage Structure**:
```solidity
struct NoveltyRecord {
    uint256 confidenceScore;  // 0-10000 basis points
    uint256 localDensity;     // 0-10000 basis points
    uint256 timestamp;
    address agent;
    bool isNovel;
}

struct ComplianceMetadata {
    bytes32 dataOriginHash;    // Hash of raw sensor data
    string jurisdictionTag;     // e.g., "KE", "EU", "US"
    bool userConsent;           // GDPR/VASP compliance
    string vaspLicenseId;       // Service provider license
}
```

### 2. MotionMintOrchestrator.sol
**Purpose**: End-to-end orchestration of novelty detection → token minting → reward distribution

**Integration Points**:
- **MotionNoveltyDetector**: Verify motion is novel before minting
- **AttestedMotion**: Mint ERC-721 NFT for validated motions
- **RewardsEscrow**: Optional USDC reward distribution

**Workflow**:
```
┌─────────────┐
│ AI Agent    │
│ (MotionBlend│
│  + Wearable)│
└──────┬──────┘
       │ 1. Submit novelty attestation
       │    (embedding hash + confidence score)
       ▼
┌──────────────────────┐
│ NoveltyDetector      │
│ - Verify signature   │
│ - Check threshold    │
│ - Record embedding   │
└──────┬───────────────┘
       │ 2. Novel? ✓
       ▼
┌──────────────────────┐
│ Orchestrator         │
│ - Mint NFT           │
│ - Map embedding→token│
│ - Trigger reward     │
└──────┬───────────────┘
       │ 3. Mint token #123
       ▼
┌──────────────────────┐
│ AttestedMotion (ERC721)│
│ - Token owner: user  │
│ - Metadata: IPFS     │
└──────────────────────┘
```

**Functions**:
- `verifyAndMint()`: Complete flow from novelty check to token mint
- `getMotionRecord()`: Audit trail (novelty + compliance + token ownership)
- `getTokenByEmbedding()` / `getEmbeddingByToken()`: Bidirectional mapping

## Deployment Guide

### Prerequisites
- Docker (for Hardhat compilation)
- Arc testnet RPC access: `https://rpc.arc-testnet.circle.com`
- Arc testnet USDC from faucet: https://faucet.circle.com/

### Compilation
```bash
cd packages/contracts
docker run --rm -v "$(pwd)":/app -w /app node:20-alpine sh -c "
  npm install --legacy-peer-deps && \
  npx hardhat compile
"
```

### Deployment Script

Create `scripts/deploy-novelty.ts`:
```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy MotionNoveltyDetector
  const NoveltyDetectorFactory = await ethers.getContractFactory("MotionNoveltyDetector");
  const noveltyDetector = await NoveltyDetectorFactory.deploy(deployer.address);
  await noveltyDetector.waitForDeployment();
  console.log("MotionNoveltyDetector deployed:", await noveltyDetector.getAddress());

  // 2. Authorize AI agent (validator)
  const agentAddress = process.env.AGENT_VALIDATOR_ADDRESS!;
  await noveltyDetector.setAgentAuthorization(agentAddress, true);
  console.log("Authorized agent:", agentAddress);

  // 3. Deploy AttestedMotion (prerequisite)
  const AttestedMotionFactory = await ethers.getContractFactory("AttestedMotion");
  const attestedMotion = await AttestedMotionFactory.deploy(agentAddress);
  await attestedMotion.waitForDeployment();
  console.log("AttestedMotion deployed:", await attestedMotion.getAddress());

  // 4. Deploy MotionMintOrchestrator
  const OrchestratorFactory = await ethers.getContractFactory("MotionMintOrchestrator");
  const orchestrator = await OrchestratorFactory.deploy(
    await noveltyDetector.getAddress(),
    await attestedMotion.getAddress(),
    ethers.ZeroAddress // No rewards escrow for now
  );
  await orchestrator.waitForDeployment();
  console.log("MotionMintOrchestrator deployed:", await orchestrator.getAddress());

  // Save addresses
  const addresses = {
    noveltyDetector: await noveltyDetector.getAddress(),
    attestedMotion: await attestedMotion.getAddress(),
    orchestrator: await orchestrator.getAddress(),
  };
  
  console.log("\n=== Deployment Complete ===");
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Deploy to Arc Testnet
```bash
npx hardhat run scripts/deploy-novelty.ts --network arcTestnet
```

## Usage Examples

### Off-Chain: AI Agent Submits Novelty Attestation

```typescript
import { ethers } from "ethers";
import * as contracts from "./typechain-types";

// Setup
const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
const agentWallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);
const noveltyDetector = contracts.MotionNoveltyDetector__factory.connect(
  process.env.NOVELTY_DETECTOR_ADDRESS!,
  agentWallet
);

// 1. AI agent computes RkCNN novelty score off-chain
const motionEmbedding = await computeMotionEmbedding(sensorData); // 512-D vector
const embeddingHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(motionEmbedding)));
const confidenceScore = await computeRkCNNScore(motionEmbedding); // 0-10000 bps
const localDensity = await estimateLocalDensity(motionEmbedding); // 0-10000 bps

// 2. Create EIP-712 attestation
const nonce = await noveltyDetector.agentNonces(agentWallet.address);
const expiry = Math.floor(Date.now() / 1000) + 300; // 5 minutes

const domain = {
  name: "MotionNoveltyDetector",
  version: "1",
  chainId: 421614, // Arc testnet
  verifyingContract: await noveltyDetector.getAddress(),
};

const types = {
  NoveltyAttestation: [
    { name: "agent", type: "address" },
    { name: "embeddingHash", type: "bytes32" },
    { name: "confidenceScore", type: "uint256" },
    { name: "localDensity", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
};

const attestation = {
  agent: agentWallet.address,
  embeddingHash,
  confidenceScore,
  localDensity,
  nonce,
  expiry,
};

const signature = await agentWallet.signTypedData(domain, types, attestation);

// 3. Submit on-chain
const compliance = {
  dataOriginHash: ethers.keccak256(ethers.toUtf8Bytes("raw_mocap_data")),
  jurisdictionTag: "KE",
  userConsent: true,
  vaspLicenseId: "VASP-KE-2025-MOVERSE",
};

try {
  const tx = await noveltyDetector.verifyNovelty(attestation, signature, compliance);
  const receipt = await tx.wait();
  console.log("Motion verified as novel! Tx:", receipt.hash);
} catch (error: any) {
  if (error.message.includes("BelowNoveltyThreshold")) {
    console.log("Motion rejected: too similar to existing motions");
  } else if (error.message.includes("EmbeddingAlreadyKnown")) {
    console.log("Motion rejected: duplicate embedding");
  } else {
    throw error;
  }
}
```

### End-to-End: Verify Novelty + Mint Token

```typescript
import { MotionMintOrchestrator__factory } from "./typechain-types";

const orchestrator = MotionMintOrchestrator__factory.connect(
  process.env.ORCHESTRATOR_ADDRESS!,
  agentWallet
);

// Create mint attestation (separate signature for AttestedMotion contract)
const mintNonce = 123; // From AttestedMotion.usedNonce
const mintExpiry = Math.floor(Date.now() / 1000) + 300;
const dataHash = ethers.keccak256(ethers.toUtf8Bytes("motion_metadata_ipfs_cid"));

const mintDomain = {
  name: "AttestedMotion",
  version: "1",
  chainId: 421614,
  verifyingContract: process.env.ATTESTED_MOTION_ADDRESS!,
};

const mintTypes = {
  Mint: [
    { name: "to", type: "address" },
    { name: "dataHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
};

const mintAttestation = {
  to: userAddress,
  dataHash,
  nonce: mintNonce,
  expiry: mintExpiry,
};

const mintSignature = await agentWallet.signTypedData(mintDomain, mintTypes, mintAttestation);

// Execute full flow
const tx = await orchestrator.verifyAndMint(
  attestation,        // novelty attestation
  signature,          // novelty signature
  compliance,         // compliance metadata
  userAddress,        // recipient
  dataHash,           // motion metadata hash
  mintNonce,          // mint nonce
  mintExpiry,         // mint expiry
  mintSignature       // mint signature
);

const receipt = await tx.wait();
const event = receipt.logs.find(log => log.topics[0] === orchestrator.interface.getEvent("NovelMotionMinted").topicHash);
const { tokenId } = orchestrator.interface.decodeEventLog("NovelMotionMinted", event!.data, event!.topics);

console.log(`Minted token #${tokenId} for novel motion!`);
```

### Audit: Query Compliance Metadata

```typescript
// Regulatory audit query
const [isCompliant, metadata] = await noveltyDetector.auditCompliance(embeddingHash);

console.log("Compliance Status:", isCompliant);
console.log("Jurisdiction:", metadata.jurisdictionTag);
console.log("VASP License:", metadata.vaspLicenseId);
console.log("User Consent:", metadata.userConsent);
console.log("Data Origin Hash:", metadata.dataOriginHash);

// Full motion record (novelty + token + ownership)
const {
  noveltyRecord,
  complianceMetadata,
  tokenId,
  tokenOwner,
} = await orchestrator.getMotionRecord(embeddingHash);

console.log("Confidence Score:", noveltyRecord.confidenceScore, "bps");
console.log("Local Density:", noveltyRecord.localDensity, "bps");
console.log("Minted Token:", tokenId);
console.log("Current Owner:", tokenOwner);
```

## Testing

Run comprehensive test suite:
```bash
cd packages/contracts
docker run --rm -v "$(pwd)":/app -w /app node:20-alpine sh -c "
  npm install --legacy-peer-deps && \
  npx hardhat test test/MotionNoveltyDetector.test.ts
"
```

**Test Coverage**:
- ✅ Agent authorization/revocation
- ✅ EIP-712 signature verification
- ✅ Novelty threshold enforcement (base + adaptive)
- ✅ Replay attack protection (nonce)
- ✅ Expiry validation
- ✅ Duplicate embedding rejection
- ✅ Compliance metadata validation
- ✅ Density distribution tracking
- ✅ Adaptive thresholding (sparse/medium/dense regions)
- ✅ Batch verification
- ✅ Multi-agent attestation scenario

## Security Considerations

### 1. Trusted Validator Model
The novelty detector relies on **authorized AI agents** to compute off-chain RkCNN scores. These agents must be:
- Operated by licensed VASPs (Kenya VASP Act 2025)
- Running verified MotionBlend AI models
- Hardware-secured private keys (HSM/secure enclave)

**Mitigation**: Multi-agent consensus (require 2+ agents to attest before high-value mints)

### 2. Replay Attack Prevention
- Nonces are tracked per agent
- Attestations expire after 5 minutes
- Used nonces are permanently marked

### 3. Sybil Resistance
- Only owner can authorize agents
- Agent private keys must be kept secure
- Consider reputation staking for agents in production

### 4. Data Privacy (GDPR/HIPAA)
- Only **hashes** of motion data are stored on-chain
- Raw sensor data encrypted off-chain
- User consent required (`userConsent` flag)
- Right to be forgotten: mark tokens as revoked (metadata flag)

### 5. Adaptive Threshold Manipulation
- Threshold bounds enforced (85%-99%)
- Admin updates emit events for transparency
- Consider DAO governance for threshold changes

## Gas Optimization

| Operation | Est. Gas (Arc) | Notes |
|-----------|----------------|-------|
| `verifyNovelty()` | ~120k | First-time embedding |
| `verifyNovelty()` (reject) | ~80k | Threshold check fails early |
| `verifyAndMint()` | ~300k | Novelty + mint + reward |
| `batchVerifyNovelty(10)` | ~1.2M | Batch processing |

**Optimizations Applied**:
- `viaIR: true` compiler flag for stack optimization
- `unchecked` loops where overflow impossible
- Internal functions to reduce stack depth
- Calldata over memory for external functions

## Adaptive Thresholding Algorithm

```solidity
function _calculateAdaptiveThreshold(uint256 localDensity) internal view returns (uint256) {
    // Base threshold: 9500 bps (95%)
    // Density range: 0-10000 bps
    // Max adjustment: ±400 bps (±4%)
    
    if (localDensity < 3000) {
        // Sparse region: lower threshold
        threshold = 9500 - ((3000 - localDensity) * 400 / 3000);
    } else if (localDensity > 7000) {
        // Dense region: higher threshold
        threshold = 9500 + ((localDensity - 7000) * 400 / 3000);
    } else {
        // Medium density: base threshold
        threshold = 9500;
    }
    
    // Clamp to bounds [8500, 9900]
    return clamp(threshold, 8500, 9900);
}
```

**Example Values**:
| Local Density | Threshold | Meaning |
|---------------|-----------|---------|
| 0 bps (empty) | 8500 bps (85%) | Very permissive (encourage diversity) |
| 3000 bps (sparse) | 9500 bps (95%) | Base threshold |
| 5000 bps (medium) | 9500 bps (95%) | Base threshold |
| 7000 bps (dense) | 9500 bps (95%) | Base threshold |
| 10000 bps (saturated) | 9900 bps (99%) | Very strict (avoid duplicates) |

## Integration with Kinetic Ledger Ecosystem

### MotionBlend AI Engine
- Computes 512-D embeddings from mocap/wearable data
- Runs RkCNN ensemble across 50 random subspaces
- Outputs confidence score + local density estimate

### Qdrant Vector Database
- Stores historical embeddings for kNN search
- ~30 TB/day throughput (IX Africa cluster)
- Sub-10ms ANN queries

### Arc Blockchain
- Sub-second finality (~400ms)
- USDC native gas (predictable fees: ~$0.01/tx)
- Opt-in privacy for sensitive health data

### Compliance Layer (Kenya VASP Act 2025)
- All agents must hold VASP licenses
- KYC verification before reward payouts
- AML monitoring via event logs
- Audit trail: `auditCompliance()` function

## Future Enhancements

1. **Multi-Agent Consensus**: Require N-of-M agent signatures for high-confidence minting
2. **Reputation Staking**: Agents stake USDC, slashed for false positives
3. **Cross-Chain Bridges**: Port motion tokens to Ethereum/Polygon via CCTP
4. **Privacy Enhancements**: zk-SNARKs for proving novelty without revealing embeddings
5. **DAO Governance**: Community voting on threshold adjustments
6. **Quantum-Safe Signatures**: Prepare for post-quantum cryptography

## References

- **Research Paper**: "Agentic AI Meets Blockchain: Kinetic Ledger for Motion Tokenization in a Compliant Cloud Ecosystem"
- **Lu, Y., Gweon, H. (2025)**. Random k Conditional Nearest Neighbor for High-Dimensional Data. PeerJ Computer Science, 11:e2497
- **ERC-8001**: Agent Coordination Framework (https://eips.ethereum.org/EIPS/eip-8001)
- **Kenya VASP Act 2025**: Virtual Asset Service Providers Act (https://africanlawbusiness.com/news/kenya-introduces-virtual-asset-regulation)
- **Arc Blockchain**: Circle's USDC-native Layer-1 (https://www.circle.com/pressroom/circle-launches-arc-public-testnet)

## License

MIT License - See LICENSE file for details

## Support

- GitHub Issues: https://github.com/RydlrCS/kinetic-ledger/issues
- Research Team: Rydlr Cloud Services Ltd. × Moverse
- Location: IX Africa Data Centre, Nairobi, Kenya
