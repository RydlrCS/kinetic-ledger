# Kinetic Ledger - AI Agent Instructions

## Project Overview
Kinetic Ledger is an AI-powered payment solution built for the **Arc x USDC Hackathon** (Oct 27 - Nov 9, 2025). This project enables intelligent financial agents to automate on-chain payments, motion data attestations, and USDC transactions on Arc, an EVM-compatible Layer-1 blockchain where USDC is the native gas token.

## Architecture Principles
- **Arc-native with USDC gas**: All transactions settle on Arc (EVM Layer-1) using USDC for gas fees
- **Off-chain data, on-chain hashes**: Keep raw data off-chain for privacy; only store hashes/attestations on-chain
- **EIP-712 everywhere**: Use structured typed data signing for all user interactions and agent attestations
- **Agent-first design**: AI agents autonomously interact with DeFi protocols, manage payments, and execute financial logic

## Hackathon Innovation Tracks
Choose one or combine multiple tracks for your submission:

1. **🔁 On-chain Actions**: AI agents autonomously interact with DeFi protocols (swaps, lending, liquidity rebalancing)
2. **🏢 Payments for Real-World Assets (RWA)**: Recurring or conditional USDC payments for tokenized assets (real estate, treasuries, supply chain)
3. **📺 Payments for Content**: AI-native payment flows for creators (micropayments, tipping, subscription models)

## Monorepo Structure (pnpm workspaces)
```
apps/
├── web-dapp/         # Next.js 15 + wagmi + viem (wallet UX)
├── api-gateway/      # FastAPI proxy (rate-limit, CORS, RBAC)
└── agent-service/    # TypeScript agent (LLM logic, oracles, payflows)

packages/
├── contracts/        # Solidity (ERC-721/1155 + attestation verifier)
├── sdk/             # Shared TypeScript client (contracts + API)
└── schemata/        # OpenAPI, JSON Schemas, EIP-712 types

data/
├── pipelines/       # ETL stubs (Fivetran/dbt hooks)
└── samples/         # Demo motion+metrics JSON (seed)

infra/
├── terraform/       # Arc RPC, secrets, buckets, CI identities
└── github-actions/  # Reusable workflows
```

## Development Workflows

### Quick Start
```bash
pnpm i                                    # Install all dependencies
pnpm -C packages/contracts build && test # Compile & test contracts first
pnpm dev                                  # Start all services in parallel
```

### Environment Setup
- Copy `.env.example` → `.env` in each app directory
- Required vars:
  - `ARC_RPC_URL` - Arc testnet RPC endpoint
  - `USDC_TOKEN_ADDRESS` - Native USDC contract on Arc
  - `WALLET_PRIVATE_KEY` - Agent validator key (testnet only)
  - `AGENT_WEBHOOK_SECRET` - HMAC secret for API authentication
- Get testnet USDC from the [official faucet](https://faucet.circle.com/)
- **Never commit secrets** - use environment-specific configs

## Recommended Technology Stack

### Required Technologies
- **Arc**: EVM-compatible Layer-1 blockchain (all transactions must settle here)
- **USDC**: Native gas token and payment currency on Arc

### Account Abstraction & Wallet Infrastructure
Choose one or more for user onboarding:
- **Circle Wallets**: Enterprise-scale in-app wallet creation
- **Thirdweb Wallets**: Authentication and identity management
- **Crossmint Wallets**: Chain-agnostic web2 APIs for embedded wallets
- **Dynamic**: SMS/email/social login with TSS-MPC security
- **Para**: Single ecosystem wallet for identity and assets

### Cross-Chain & USDC Movement
- **CCTP V2**: Transfer USDC across supported blockchains
- **Bridge Kit SDK**: Move USDC cross-chain in a few lines of code
- **Circle Gateway**: Unified USDC balance with on-demand liquidity
- **Pimlico**: Smart account tools for EVM chains

### AI & Voice Integrations
- **ElevenLabs**: Voice AI platform for conversational agents (3-month Creator Plan available)
- **Cloudflare Workers AI**: Serverless GPU-powered inference at the edge
- **AI/ML API**: 100+ models for text, image, vision tasks (use promo code `ARCHACK20`)

## Key Patterns & Conventions

### Verbose Logging & Observability
All services implement **structured, verbose logging** for agentic monitoring and transparent debugging:

```typescript
// TypeScript/Node.js - use pino with verbose flag
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Set VERBOSE=true for trace-level logs
  ...(process.env.VERBOSE === 'true' && { level: 'trace' }),
});

// Log with structured context for narrative building
logger.info({
  service: 'agent-service',
  action: 'attestation_generated',
  wallet: to,
  dataHash,
  nonce,
  expiry,
  trace_id: req.traceId,
}, 'Motion attestation created');
```

```python
# Python/FastAPI - use structlog with verbose flag
import structlog
import sys

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
)

logger = structlog.get_logger()

# Verbose logging with --verbose CLI flag
if os.getenv('VERBOSE') == 'true':
    logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
else:
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)

# Compliance-aware logging with typed events
logger.info(
    "motion_event_received",
    wallet=event.wallet,
    nonce=event.nonce,
    compliance_check="passed",
    trace_id=trace_id,
)
```

**Logging Best Practices:**
- ✅ Use `VERBOSE=true` env var or `--verbose` CLI flag for trace-level debugging
- ✅ Include `trace_id` in all logs for distributed tracing across services
- ✅ Log compliance checkpoints (KYC, sanctions, AML) with typed event names
- ✅ Surface AI decision points: `agent_decision`, `model_inference`, `risk_score`
- ✅ Never log private keys, full PII, or raw motion data (use hashes)
- ✅ Tag logs with service name for narrative building in monitoring tools

### Error Handling & Exit Codes
Each service uses **documented exit codes** for operational clarity:
- `0` = clean shutdown
- `10` = config/env invalid  
- `20` = chain/RPC unhealthy
- `30` = wallet signing failure
- `40` = attestation generation failure
- `50` = contract call revert
- `60` = unexpected/unhandled

### Retry Logic
```typescript
// Standard retry pattern with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5, baseMs = 500): Promise<T> {
  // Capped exponential backoff, jitter, structured logging
  // Log context: {attempt, backoff, label, err}
}
```

### Contract Interaction
- **Gas estimation** before every transaction
- **Revert reason decoding** for user-friendly error messages  
- **Nonces + expiries** on all EIP-712 signatures to prevent replay
- **Pause switches** on all money-handling contracts

### Attestation Flow
1. Agent captures/validates off-chain event (motion data)
2. Compute `dataHash = keccak256(rawData)` 
3. Generate EIP-712 signature over `(to, dataHash, nonce, expiry)`
4. Submit to contract: `mintWithAttestation(to, dataHash, nonce, expiry, signature)`
5. Contract verifies signature against trusted validator address

### Data Pipeline Architecture (Motion Data → Blockchain)
**Challenge**: Handle tens of thousands of potential data connectors without overwhelming memory

```typescript
// Stream-based processing to avoid loading all data into memory
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import split2 from 'split2';

// Process motion data in batches
async function processMotionDataStream(source: string) {
  const batchSize = 100; // Configurable batch size
  let batch: MotionEvent[] = [];
  
  await pipeline(
    createReadStream(source),
    split2(JSON.parse),
    async function* (source) {
      for await (const event of source) {
        batch.push(event);
        
        if (batch.length >= batchSize) {
          yield batch;
          batch = [];
        }
      }
      if (batch.length > 0) yield batch;
    },
    async function (batches) {
      for await (const batch of batches) {
        await processBatchToBlockchain(batch);
      }
    }
  );
}
```

**Fivetran Integration Pattern:**
```yaml
# data/pipelines/fivetran-config.yml
connector:
  name: motion-data-replication
  type: custom
  config:
    # Replicate rows incrementally to avoid memory issues
    sync_mode: incremental
    cursor_field: timestamp
    batch_size: 1000
    # Transform before blockchain submission
    transformations:
      - hash_sensitive_fields
      - aggregate_by_wallet
      - compute_merkle_root
```

**Memory-Efficient Best Practices:**
- ✅ Use streaming/chunked reading for large datasets
- ✅ Process in configurable batches (100-1000 records)
- ✅ Implement backpressure handling for rate-limited blockchain writes
- ✅ Clear processed batches from memory immediately
- ✅ Use cursor-based pagination for Fivetran connectors
- ✅ Monitor heap usage with `--max-old-space-size` flag
- ✅ Log batch progress: `logger.debug({ batch: n, total: N, heapUsed })`

## Security & Operational Practices

### Key Management
- **Principle of least privilege**: separate keys for deployer ≠ treasurer ≠ validator
- Validator key: signs attestations (hot wallet for agents)
- Treasurer key: controls USDC disbursements (cold storage)
- Deployer key: contract upgrades (multisig recommended)

### Monitoring & Observability
- **Structured logging** with pino: `{level, timestamp, service, trace_id, ...context}`
- **Circuit breakers**: pause agents if RPC/USDC unhealthy for N minutes
- **Rate limiting**: API gateway throttles per IP + validates HMAC webhooks

### Testing Strategy
- **Hardhat tests** with revert reason assertions
- **PyTest** for FastAPI endpoints
- **Playwright** for end-to-end dapp flows
- **Slither** static analysis on every PR

## Integration Points

### Web Dapp ↔ Contracts
- Use `wagmi` + `viem` for wallet connections
- Optimistic UI with on-chain confirmation patterns
- Decode revert reasons: show actual failure cause + retry policy

### Agent Service ↔ API Gateway  
- HMAC webhook authentication: `x-signature: hmac-sha256(secret, payload)`
- Idempotent operations by nonce to handle retries
- Queue events reliably before processing

### Contracts ↔ External Systems
- **Event emission** for off-chain indexing: `MotionMinted(to, tokenId, dataHash, nonce, expiry)`
- **Oracle integration** via trusted validator signatures
- **USDC integration** through standard ERC-20 interface

## Common Anti-Patterns to Avoid
- ❌ Storing raw motion data on-chain (use hashes)
- ❌ Missing nonces/expiries on signatures (replay vulnerability)  
- ❌ Generic error messages (decode specific revert reasons)
- ❌ Unbounded retry loops (use exponential backoff with caps)
- ❌ Single point of failure keys (separate concerns)

## Hackathon Submission Requirements
Your project must include:

### Core Deliverables
- ✅ Working prototype built on Arc using USDC
- ✅ Public GitHub repository with clean, maintainable code
- ✅ Demo application URL (hosted/accessible)
- ✅ Clear problem-solving purpose aligned with one innovation track
- ✅ Realistic adoption pathway or reuse potential

### Presentation Materials
- 📸 Cover image for your project
- 🎥 Video presentation demonstrating functionality
- 📊 Slide deck explaining architecture and value proposition
- 📝 Project description (short & long form)
- 🏷️ Appropriate technology & category tags

### Judging Criteria (in priority order)
1. **Application of Technology** (40%): Effective integration of Arc, USDC, and chosen AI models
2. **Business Value** (25%): Real-world impact and practical utility
3. **Originality** (20%): Unique approaches and creative problem-solving
4. **Presentation** (15%): Clear communication of your solution

### Additional Developer Requirements for Excellence
Beyond the official judging criteria, consider these quality benchmarks:

#### Code Quality & Maintainability
- ✅ **Lint-free code**: Run ESLint (TypeScript), Ruff/Black (Python), Solhint (Solidity) with zero errors
- ✅ **Comprehensive comments**: Document WHY not just WHAT - explain Arc-specific patterns
- ✅ **Type safety**: Use TypeScript strict mode, Python type hints with mypy
- ✅ **Minimal tech debt**: Avoid quick hacks - build for post-hackathon iteration
- ✅ **Consistent style**: Follow project conventions (see `.prettierrc`, `.eslintrc`)

#### Creative Use Case Testing
**Demonstrate your framework works across scenarios:**

1. **Happy Path**: Successful payment flow from trigger → attestation → on-chain settlement
2. **Edge Cases**: Expired signatures, insufficient USDC balance, network congestion
3. **Failure Recovery**: Retry logic, circuit breakers, graceful degradation
4. **Scale Testing**: Process 1000+ motion events in batches without memory issues
5. **Multi-Connector**: Show different data sources (API, CSV, Fivetran) feeding same pipeline

```typescript
// Example: Creative test demonstrating framework flexibility
describe('Multi-Source Motion Pipeline', () => {
  it('should process motion data from 3 different connectors', async () => {
    const sources = [
      { type: 'fivetran', connector: 'fitness-tracker' },
      { type: 'api', endpoint: '/webhooks/motion' },
      { type: 'csv', path: './data/samples/demo.csv' },
    ];
    
    for (const source of sources) {
      const events = await ingestFrom(source);
      expect(events.length).toBeGreaterThan(0);
      
      // Verify Arc settlement for each source
      const tx = await agent.submitBatch(events);
      expect(tx.status).toBe('success');
    }
  });
});
```

#### Tying Narrative to Arc by Circle
Explicitly connect your project to Arc's unique value propositions:

- 🎯 **USDC-native gas**: Highlight how predictable fees enable new use cases
- 🎯 **Sub-second settlement**: Show real-time payment flows that weren't possible before
- 🎯 **Institutional-grade**: Emphasize compliance logging, audit trails, privacy controls
- 🎯 **Ecosystem integration**: Leverage Circle APIs, CCTP, Gateway where relevant

**In your README/presentation:**
```markdown
## Why Arc?

This project leverages Arc's **USDC-native architecture** to enable:
- Predictable gas costs for AI agents (no ETH price volatility)
- Sub-second finality for real-time motion-triggered payments
- Seamless cross-chain USDC movement via Circle's CCTP
- Enterprise-ready compliance through structured logging

Traditional blockchains would require [X complexity]. Arc eliminates this by [Y benefit].
```

### Prize Opportunities
- 🥇 1st Place: $5,000 USDC
- 🥈 2nd Place: $3,000 USDC
- 🥉 3rd Place: $2,000 USDC
- ⭐ Best Use of ElevenLabs: Scale Plan for 6 months (~$2,000/team member)

### Key Dates
- **Oct 27 - Nov 8**: Online development phase
- **Nov 8**: NYC on-site build day (by invitation)
- **Nov 9 2:30 AM EAT**: Submission deadline
- **Nov 9**: Live pitching & winner announcement (NYC)

## Developer Resources
- [Circle Sample Apps](https://developers.circle.com/samples) - Reference implementations
- [Deploy Contract on Arc](https://docs.circle.com/arc/deploy-contract) - Smart contract deployment guide
- [Testnet USDC Faucet](https://faucet.circle.com/) - Get test funds
- [Arc Documentation](https://docs.circle.com/arc) - Blockchain specifications
- [ElevenLabs Coupon](https://lablab.ai) - Claim your 3-month Creator Plan (500 available)
- [AI/ML API Promo](https://aimlapi.com) - Use code `ARCHACK20` for free week with 100+ models

## Documentation References
- `docs/ARCHITECTURE.md` - detailed component interactions
- `docs/RUNBOOK.md` - deployment and incident response
- `docs/SECURITY.md` - threat model and risk controls
- `packages/schemata/` - EIP-712 type definitions and API schemas