# Motion Blending & On-Chain Attestation Implementation Plan

**Project**: Kinetic Ledger - Motion Sequence Tokenization with BlendAnim Integration  
**Date**: November 9, 2025  
**Status**: Planning Phase

---

## 🎯 Objective

Implement proper motion sequence blending using the BlendAnim framework (single-shot GANimator-based blending) with complete on-chain attestation of motion hashes, ensuring each blended sequence is:
1. Properly generated via temporal conditioning
2. Hashed with cryptographic integrity
3. Attested by AI agents via EIP-712 signatures
4. Stored on Arc blockchain with compliance metadata
5. Minted as ERC-721 tokens with novelty verification

---

## 📋 Implementation Checklist

### Phase 1: Motion Blending Integration (BlendAnim → Kinetic Ledger)

#### ✅ Prerequisites
- [ ] **1.1** Review BlendAnim repository structure
  - Single-shot GANimator architecture
  - Temporal conditioning mechanism
  - SPADE/FiLM normalization layers
  - BVH input/output format
  - Skeleton hierarchy and joint mappings

- [ ] **1.2** Understand existing Kinetic Ledger contracts
  - `AttestedMotion.sol` - ERC-721 with EIP-712 minting
  - `MotionNoveltyDetector.sol` - RkCNN-based novelty verification
  - `MotionMintOrchestrator.sol` - End-to-end pipeline orchestration
  - `RewardsEscrow.sol` - USDC reward distribution

#### 📦 Step 1: Create Motion Blending Service
**Goal**: Extract 2-3 motion sequences → blend → generate seamless output

- [ ] **1.3** Create `apps/motion-blend-service/` directory
  ```bash
  mkdir -p apps/motion-blend-service/{src,tests,config}
  ```

- [ ] **1.4** Set up Python environment for BlendAnim
  ```bash
  cd apps/motion-blend-service
  python -m venv venv
  source venv/bin/activate
  pip install torch numpy scipy matplotlib
  pip install moai-tools  # For skeleton convolutions
  ```

- [ ] **1.5** Create `src/blend_engine.py` - Core blending logic
  - **Input**: List of BVH file paths + blend weights + transition points
  - **Processing**:
    - Load BVH files (quaternions + positions)
    - Create temporal conditioning map (skeleton_id_map)
    - Pass through GANimator generator (2 stages)
    - Apply SPADE normalization per stage
    - Output blended motion tensor
  - **Output**: Blended BVH file + embedding hash
  - **Requirements**:
    - Verbose entry/exit logging for each function
    - Type hints for all parameters
    - Docstrings with examples
    - No lint errors (ruff, mypy)

- [ ] **1.6** Create `src/motion_processor.py` - Motion embedding extraction
  - **Functions**:
    - `extract_features()` - Convert BVH → 512-D embedding
    - `compute_hash()` - Keccak256 hash of embedding
    - `validate_sequence()` - Check frame count, joint validity
  - **Logging**: Entry/exit with frame count, joint count, hash prefix

- [ ] **1.7** Create `src/bvh_utils.py` - BVH I/O utilities
  - **Functions**:
    - `load_bvh(path)` → positions, rotations, offsets, parents, names
    - `save_bvh(path, data)` - Export blended motion
    - `validate_skeleton(parents, names)` - Ensure hierarchy consistency
  - **Requirements**: Handle both euler and quaternion representations

- [ ] **1.8** Create `tests/test_blend_engine.py`
  - Unit tests for blending 2-3 sample BVH files
  - Assert output frame count matches expected
  - Verify hash consistency (same inputs → same hash)
  - Test with invalid inputs (wrong dimensions, missing joints)

#### 🔗 Step 2: Connect Blending to Agent Service
**Goal**: Agent service calls blend engine → gets hash → signs attestation

- [ ] **1.9** Create `apps/motion-blend-service/src/api.py` - FastAPI endpoint
  ```python
  @app.post("/blend")
  async def blend_motions(request: BlendRequest):
      # 1. Validate request (file paths exist, weights sum to 1.0)
      # 2. Call blend_engine.blend()
      # 3. Extract embedding hash
      # 4. Return { blendedBvhPath, embeddingHash, metadata }
  ```
  - **Logging**: Request ID, input files, blend weights, execution time
  - **Error handling**: Invalid files, blending failures, filesystem errors

- [ ] **1.10** Update `apps/agent-service/src/processor.ts`
  - Add `callBlendService()` function
  - Modify `processMotionEvent()` to handle blend requests:
    ```typescript
    if (event.type === 'blend') {
      const blendResult = await callBlendService(event.sourceFiles, event.weights);
      event.embedding = await extractEmbedding(blendResult.bvhPath);
      event.embeddingHash = blendResult.embeddingHash;
    }
    ```

- [ ] **1.11** Test integration: agent-service → motion-blend-service → hash verification
  - Send sample blend request
  - Verify hash matches between services
  - Confirm logging shows full trace (agent → blend → return)

#### 🔐 Step 3: On-Chain Attestation of Blended Motion
**Goal**: Each blended sequence hash is attested on Arc with EIP-712 signature

- [ ] **1.12** Review existing attestation flow in `signer.ts`
  - `signMotionAttestation()` - EIP-712 signature generation
  - `hashMotionEmbedding()` - Current hashing logic
  - Confirm compatibility with blended motion hashes

- [ ] **1.13** Create `packages/contracts/contracts/BlendedMotionRegistry.sol`
  - **Purpose**: Store blended motion metadata on-chain
  - **Struct BlendMetadata**:
    ```solidity
    struct BlendMetadata {
        bytes32 embeddingHash;        // Hash of blended embedding
        bytes32[] sourceHashes;        // Hashes of input motions (2-3)
        uint256[] blendWeights;        // Weights per source (sum = 10000)
        uint256 frameCount;            // Total frames in blend
        uint256 timestamp;             // Block timestamp
        address blendAgent;            // AI agent that performed blend
    }
    ```
  - **Function**: `registerBlend(BlendMetadata, signature)`
  - **Events**: `BlendRegistered(embeddingHash, sourceHashes, agent)`
  - **Requirements**:
    - EIP-712 signature verification
    - Prevent duplicate blend registration
    - Store compliance metadata (jurisdiction, consent)

- [ ] **1.14** Add comprehensive NatSpec comments to `BlendedMotionRegistry.sol`
  - Document all structs, functions, events, errors
  - Explain blend weight validation logic
  - Reference BlendAnim paper for technical context

- [ ] **1.15** Create `packages/contracts/test/BlendedMotionRegistry.test.ts`
  - Test blend registration with 2 sources
  - Test blend registration with 3 sources
  - Test duplicate blend rejection
  - Test invalid signature rejection
  - Test weight validation (must sum to 10000)
  - Test unauthorized agent rejection

- [ ] **1.16** Deploy `BlendedMotionRegistry.sol` to Arc testnet
  ```bash
  cd packages/contracts
  pnpm hardhat deploy --network arc-testnet --tags BlendedMotionRegistry
  ```
  - **Verify**: Contract address saved to `.env`
  - **Test**: Submit sample blend registration transaction
  - **Confirm**: Event emitted on ArcScan

#### 🎭 Step 4: Integrate with Motion Minting Pipeline
**Goal**: Blended motions flow through full pipeline: blend → hash → attest → novelty check → mint

- [ ] **1.17** Update `MotionMintOrchestrator.sol`
  - Add `blendedMotionRegistry` contract reference
  - Modify `verifyAndMint()` to check if embedding is from a blend:
    ```solidity
    function verifyAndMint(...) external returns (uint256 tokenId) {
        // Step 0: Check if this is a blended motion
        BlendMetadata memory blendMeta = blendedMotionRegistry.getBlendMetadata(embeddingHash);
        
        // Step 1: Verify novelty (existing logic)
        bool isNovel = noveltyDetector.verifyNovelty(...);
        
        // Step 2: If novel AND blended, store blend metadata in token
        if (blendMeta.embeddingHash != bytes32(0)) {
            tokenId = attestedMotion.mintWithBlendMetadata(recipient, dataHash, blendMeta, ...);
        } else {
            tokenId = attestedMotion.mintWithAttestation(recipient, dataHash, ...);
        }
    }
    ```

- [ ] **1.18** Update `AttestedMotion.sol` to store blend metadata
  - Add mapping: `mapping(uint256 => bytes32) public tokenToBlendHash`
  - Add function: `mintWithBlendMetadata(address, bytes32, BlendMetadata, ...)`
  - Emit event with blend source hashes

- [ ] **1.19** Create end-to-end test: `test/MotionBlendPipeline.test.ts`
  - Load 2 sample BVH files
  - Call blend service
  - Extract embedding and hash
  - Sign attestation
  - Register blend on-chain
  - Verify novelty
  - Mint token
  - Verify token contains blend metadata

---

### Phase 2: Temporal Conditioning & Transition Quality

#### 🕐 Step 5: Implement Temporal Conditioning Map
**Goal**: Generate `skeleton_id_map` that guides blending at transition points

- [ ] **2.1** Create `src/temporal_conditioning.py`
  - **Function**: `create_skeleton_id_map(frames, transition_points, blend_weights)`
    - **Input**: Total frames, list of transition frame indices, blend weights per segment
    - **Output**: Tensor [B, 174, T] where 174 = feature dim
    - **Logic**:
      - Segment 1: frames 0-49 → map = source1 features
      - Transition: frames 50-65 → map = weighted blend of source1 + source2
      - Segment 2: frames 66-120 → map = source2 features
  - **Logging**: Transition frame ranges, weight distribution, map shape

- [ ] **2.2** Implement SPADE normalization integration
  - Load SPADE module from BlendAnim (`src/monads/utils/spade.py`)
  - Apply SPADE at each generator stage:
    ```python
    generated = skeleton_block(generated + noise0) + generated
    generated = spade(generated, skeleton_id_map)
    ```
  - **Test**: Verify SPADE modulates features correctly at transitions

- [ ] **2.3** Create transition quality metrics
  - **Function**: `compute_transition_smoothness(blended_motion, transition_frames)`
    - **Metrics**:
      - L2 velocity change at transition boundaries
      - L2 acceleration at transition midpoints
      - Foot contact consistency
    - **Output**: Quality score 0-100
  - **Logging**: Per-joint velocity/acceleration, average smoothness

- [ ] **2.4** Test temporal conditioning with 3 different transition points
  - Early transition (25% through)
  - Middle transition (50% through)
  - Late transition (75% through)
  - Verify smoothness metrics are within acceptable range

#### 📊 Step 6: Blending Metrics & Validation
**Goal**: Ensure blended motions meet quality thresholds before on-chain submission

- [ ] **2.5** Create `src/metrics/blend_quality.py`
  - **Functions**:
    - `measure_joint_continuity(positions, velocities)` - C1 continuity check
    - `measure_foot_contact_stability(contacts)` - Ground contact preservation
    - `measure_energy_conservation(velocities)` - Momentum consistency
  - **Thresholds**:
    - Velocity discontinuity < 0.5 m/s at transitions
    - Acceleration spike < 2.0 m/s² at transitions
    - Foot slip distance < 0.1 m during ground contact

- [ ] **2.6** Add quality checks to `blend_engine.py`
  ```python
  def blend_motions(...) -> BlendResult:
      # 1. Perform blending
      blended = generator.forward(...)
      
      # 2. Validate quality
      quality_score = blend_quality.measure_joint_continuity(blended)
      if quality_score < 80:
          raise BlendQualityError(f"Quality score {quality_score} below threshold")
      
      # 3. Return with quality metadata
      return BlendResult(bvh_path, embedding_hash, quality_score)
  ```

- [ ] **2.7** Store quality scores on-chain
  - Add `qualityScore` field to `BlendMetadata` struct
  - Require minimum quality score (80/100) for registration
  - Emit quality score in `BlendRegistered` event

---

### Phase 3: Frontend Integration & User Experience

#### 🖥️ Step 7: Motion Blending UI
**Goal**: Users can upload 2-3 BVH files, adjust weights, preview blend, mint

- [ ] **3.1** Create `apps/web-dapp/src/components/MotionBlendingStudio.tsx`
  - **UI Elements**:
    - File upload (2-3 BVH files)
    - Blend weight sliders (totaling 100%)
    - Transition point selector (frame range)
    - Preview canvas (3D skeleton visualization)
    - Blend button (calls API)
    - Quality score display
    - Mint button (submits to blockchain)
  - **State Management**:
    ```typescript
    const [sourceFiles, setSourceFiles] = useState<File[]>([]);
    const [blendWeights, setBlendWeights] = useState<number[]>([50, 50]);
    const [transitionPoint, setTransitionPoint] = useState<number>(50);
    const [blendResult, setBlendResult] = useState<BlendResult | null>(null);
    const [isBlending, setIsBlending] = useState(false);
    ```

- [ ] **3.2** Create `src/hooks/useMotionBlend.ts`
  ```typescript
  export function useMotionBlend() {
    const blendMotions = async (files: File[], weights: number[]) => {
      // 1. Upload BVH files to backend
      // 2. Call /blend endpoint
      // 3. Poll for result
      // 4. Return blendedBvhUrl + embeddingHash
    };
    
    return { blendMotions, isBlending, blendResult, error };
  }
  ```

- [ ] **3.3** Add 3D motion preview with Three.js
  - Display skeleton hierarchy
  - Animate blended motion sequence
  - Highlight transition frames with different colors
  - Show velocity/acceleration graphs

- [ ] **3.4** Create `src/hooks/useBlendMinting.ts`
  ```typescript
  export function useBlendMinting() {
    const mintBlendedMotion = async (
      embeddingHash: string,
      sourceHashes: string[],
      weights: number[]
    ) => {
      // 1. Register blend via BlendedMotionRegistry
      // 2. Call MotionMintOrchestrator.verifyAndMint()
      // 3. Wait for confirmation
      // 4. Return token ID
    };
    
    return { mintBlendedMotion, isMinting, txHash, tokenId };
  }
  ```

#### 📱 Step 8: Motion Studio Integration
**Goal**: Seamless blend → mint workflow in existing Motion Studio page

- [ ] **3.5** Update `apps/web-dapp/src/app/studio/page.tsx`
  - Add "Blend Motions" tab alongside "Upload" and "Mint"
  - Import `<MotionBlendingStudio />` component
  - Connect to existing wallet context
  - Integrate with USDC balance checking (7 USDC minting fee)

- [ ] **3.6** Add blend history display
  - Show user's past blended motions
  - Display source files, weights, quality scores
  - Link to minted tokens on ArcScan
  - Show USDC spent on minting

- [ ] **3.7** Create `src/components/BlendMetadataCard.tsx`
  - Display blend sources with thumbnails
  - Show blend weights as pie chart
  - Display quality score with color coding (red < 60, yellow 60-80, green > 80)
  - Show transition frame markers on timeline

---

### Phase 4: Testing, Documentation & Deployment

#### 🧪 Step 9: Comprehensive Testing
**Goal**: 100% coverage of blend → attest → mint pipeline

- [ ] **4.1** Create integration test suite: `tests/integration/blend_pipeline.test.ts`
  - **Test 1**: Blend 2 motions → register → verify novelty → mint
  - **Test 2**: Blend 3 motions with custom weights
  - **Test 3**: Reject low-quality blend (quality score < 80)
  - **Test 4**: Reject duplicate blend (same sources + weights)
  - **Test 5**: Reject unauthorized agent signature
  - **Test 6**: Verify blend metadata stored correctly in token

- [ ] **4.2** Create load test: 10 concurrent blend requests
  - Measure API response time (target < 5 seconds per blend)
  - Verify no race conditions in hash generation
  - Confirm all blends are registered on-chain

- [ ] **4.3** Test edge cases
  - Blending motions with different frame rates
  - Blending motions with different skeleton hierarchies
  - Blending motions with missing joints (partial skeletons)
  - Blending with extreme weights (95/5 split)
  - Blending at frame 0 and last frame

- [ ] **4.4** Manual UI testing checklist
  - [ ] Upload 2 BVH files → adjust weights → blend → preview
  - [ ] Upload 3 BVH files → adjust weights → blend → preview
  - [ ] Mint blended motion → verify transaction on ArcScan
  - [ ] View blend metadata in token details
  - [ ] Check USDC balance decreases by 7 USDC after mint

#### 📚 Step 10: Documentation
**Goal**: Complete docs for developers and users

- [ ] **4.5** Create `docs/MOTION_BLENDING.md`
  - **Sections**:
    - Architecture overview (BlendAnim + Kinetic Ledger)
    - Blending algorithm explanation (GANimator + SPADE)
    - API reference for blend service
    - Smart contract reference for BlendedMotionRegistry
    - Quality metrics and thresholds
    - Deployment guide
  - **Requirements**:
    - Diagrams showing data flow
    - Code examples for all API endpoints
    - Contract interaction examples

- [ ] **4.6** Create `docs/BLEND_API_REFERENCE.md`
  - **POST /blend**:
    - Request schema
    - Response schema
    - Error codes
    - Example curl command
  - **GET /blend/{id}/status**:
    - Poll for blend completion
    - Return quality score when done

- [ ] **4.7** Update `README.md` with blending quickstart
  ```markdown
  ## Motion Blending Quickstart
  
  1. Start blend service: `pnpm run blend-service`
  2. Upload 2 BVH files to Motion Studio
  3. Adjust blend weights (default 50/50)
  4. Click "Blend" → wait for preview
  5. Click "Mint" → approve USDC transaction
  6. View minted token with blend metadata
  ```

- [ ] **4.8** Add inline code comments to all new files
  - Every function: entry log, processing steps, exit log
  - Every contract function: NatSpec with `@param`, `@return`, `@dev`
  - Every class: docstring with purpose, example usage

#### 🚀 Step 11: Deployment & Monitoring
**Goal**: Production-ready deployment on Arc testnet

- [ ] **4.9** Deploy all contracts to Arc testnet
  ```bash
  pnpm hardhat deploy --network arc-testnet --tags All
  ```
  - Verify contract addresses in `.env`
  - Verify on ArcScan explorer
  - Test all functions via Hardhat console

- [ ] **4.10** Deploy motion-blend-service to cloud
  - Dockerize Python service
  - Deploy to Render/Railway/Fly.io
  - Configure environment variables (MODEL_PATH, RPC_URL)
  - Set up health check endpoint (`/health`)

- [ ] **4.11** Update web-dapp to use production API
  - Replace localhost URLs with production URLs
  - Update WalletConnect Project ID if needed
  - Deploy to Vercel
  - Verify all API calls work

- [ ] **4.12** Set up monitoring
  - **Blend Service**:
    - Track blend requests per hour
    - Track average blend time
    - Alert on failures > 5%
  - **Smart Contracts**:
    - Monitor `BlendRegistered` events
    - Track gas costs per blend registration
    - Alert on failed transactions

- [ ] **4.13** Create operational runbook: `docs/RUNBOOK_BLENDING.md`
  - How to restart blend service
  - How to debug failed blends
  - How to verify on-chain blend records
  - Common error codes and solutions

---

## 🔍 Quality Gates (Must Pass Before Moving to Next Phase)

### Phase 1 Complete When:
- [ ] Blend service returns valid BVH file for 2-input blend
- [ ] Embedding hash is deterministic (same inputs → same hash)
- [ ] Agent service successfully calls blend service
- [ ] BlendedMotionRegistry deployed and verified on Arc testnet
- [ ] End-to-end test passes: blend → register → verify
- [ ] Zero lint errors in Python and TypeScript code
- [ ] All functions have entry/exit logging
- [ ] 100% type coverage (TypeScript strict mode, Python mypy)

### Phase 2 Complete When:
- [ ] Temporal conditioning map generates correct shape [B, 174, T]
- [ ] SPADE normalization applied at both generator stages
- [ ] Transition smoothness metrics show < 0.5 m/s velocity jump
- [ ] Quality score validation rejects blends < 80/100
- [ ] 3-motion blend works with custom weights [40, 30, 30]

### Phase 3 Complete When:
- [ ] Users can upload BVH files via UI
- [ ] 3D preview renders blended skeleton correctly
- [ ] Mint button calls BlendedMotionRegistry + MotionMintOrchestrator
- [ ] Token metadata displays blend sources and weights
- [ ] USDC balance updates correctly after minting

### Phase 4 Complete When:
- [ ] All integration tests pass (6/6)
- [ ] Load test handles 10 concurrent requests
- [ ] Documentation covers all API endpoints and contracts
- [ ] Contracts deployed to Arc testnet
- [ ] Blend service deployed to cloud
- [ ] Monitoring dashboards show metrics

---

## 📦 File Structure After Implementation

```
kinetic-ledger/
├── apps/
│   ├── motion-blend-service/
│   │   ├── src/
│   │   │   ├── blend_engine.py          # Core GANimator blending
│   │   │   ├── motion_processor.py      # Embedding extraction
│   │   │   ├── bvh_utils.py             # BVH I/O
│   │   │   ├── temporal_conditioning.py # Skeleton ID map generation
│   │   │   ├── metrics/
│   │   │   │   └── blend_quality.py     # Quality validation
│   │   │   └── api.py                   # FastAPI endpoints
│   │   ├── tests/
│   │   │   ├── test_blend_engine.py
│   │   │   ├── test_temporal_conditioning.py
│   │   │   └── test_blend_quality.py
│   │   ├── config/
│   │   │   └── model_config.yaml
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   ├── agent-service/
│   │   └── src/
│   │       ├── processor.ts             # Updated with blend support
│   │       └── blend_client.ts          # NEW: Calls motion-blend-service
│   │
│   └── web-dapp/
│       └── src/
│           ├── components/
│           │   ├── MotionBlendingStudio.tsx
│           │   ├── BlendMetadataCard.tsx
│           │   └── BlendHistoryView.tsx
│           └── hooks/
│               ├── useMotionBlend.ts
│               └── useBlendMinting.ts
│
├── packages/
│   └── contracts/
│       ├── contracts/
│       │   ├── BlendedMotionRegistry.sol   # NEW
│       │   ├── AttestedMotion.sol          # UPDATED: blend metadata
│       │   └── MotionMintOrchestrator.sol  # UPDATED: blend integration
│       └── test/
│           ├── BlendedMotionRegistry.test.ts
│           ├── MotionBlendPipeline.test.ts # NEW: E2E
│           └── integration/
│               └── blend_pipeline.test.ts
│
├── docs/
│   ├── MOTION_BLENDING.md                  # NEW
│   ├── BLEND_API_REFERENCE.md              # NEW
│   └── RUNBOOK_BLENDING.md                 # NEW
│
└── MOTION_BLENDING_TODO.md                 # THIS FILE
```

---

## 🎯 Success Criteria

### Technical Requirements
- [x] BlendAnim GANimator model integrated
- [ ] Temporal conditioning map implemented
- [ ] SPADE normalization applied correctly
- [ ] Embedding hash is deterministic and keccak256-based
- [ ] EIP-712 attestation for every blend
- [ ] On-chain storage of blend metadata
- [ ] Novelty verification before minting
- [ ] Quality score validation (minimum 80/100)
- [ ] Zero TypeScript/Python lint errors
- [ ] 100% type coverage
- [ ] Entry/exit logging for all functions
- [ ] Comprehensive test coverage (>90%)

### User Experience
- [ ] Upload 2-3 BVH files via UI
- [ ] Adjust blend weights with sliders
- [ ] Preview blended motion in 3D
- [ ] One-click mint after blend
- [ ] View blend metadata in token details
- [ ] See blend history and USDC spent

### On-Chain Requirements
- [ ] BlendedMotionRegistry deployed to Arc testnet
- [ ] All blends registered with valid signatures
- [ ] Blend source hashes stored on-chain
- [ ] Quality scores recorded on-chain
- [ ] Tokens linked to blend metadata
- [ ] Compliance metadata (jurisdiction, consent)

---

## 🚨 Critical Reminders

1. **No code without comments**: Every function must have entry/exit logs
2. **No lint errors**: Run `ruff`, `mypy`, `eslint` before each commit
3. **Type everything**: Python type hints, TypeScript strict mode
4. **Test before moving on**: Each step must have passing tests
5. **Verbose logging**: Log frame counts, hashes, signatures, errors
6. **Quality gates**: Don't skip to next phase until current phase is 100% complete

---

## 📝 Notes & References

- **BlendAnim Paper**: [Controllable Single-Shot Animation Blending](https://github.com/RydlrCS/blendanim)
- **GANimator**: Multi-stage skeleton-aware generator with residual connections
- **SPADE**: Spatially-Adaptive Normalization (modulates features via skeleton ID map)
- **RkCNN**: Random k Conditional Nearest Neighbor for novelty detection
- **EIP-712**: Typed structured data hashing and signing
- **Arc Testnet**: Chain ID 421614, USDC as native gas token

---

**Last Updated**: November 9, 2025  
**Next Review**: After Phase 1 completion  
**Owner**: @RydlrCS Team
