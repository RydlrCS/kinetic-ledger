# Agent Service - Kinetic Ledger

Autonomous AI agent for motion novelty detection and on-chain attestation on Arc blockchain.

## Overview

This TypeScript service implements the autonomous agent component of Kinetic Ledger:

- **EIP-712 Signing**: Generates cryptographic attestations for motion data
- **RkCNN Integration**: Submits embeddings to on-chain novelty detection contracts
- **Batch Processing**: Handles thousands of motion events with memory-efficient streaming
- **Circuit Breaker**: Automatic shutdown if Arc RPC becomes unhealthy
- **USDC Gas**: All transactions settle on Arc using USDC for gas fees

## Architecture

```
┌─────────────────────┐
│  API Gateway        │ Webhooks (fitness trackers, mocap, IoT)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Agent Service      │ ← This Service
│  ┌───────────────┐  │
│  │ Queue Manager │  │ Memory-efficient processing
│  ├───────────────┤  │
│  │ EIP-712 Signer│  │ Attestation generation
│  ├───────────────┤  │
│  │ Contract Layer│  │ ethers.js v6
│  └───────────────┘  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Arc Blockchain     │
│  ┌───────────────┐  │
│  │ NoveltyDetect │  │ RkCNN verification
│  ├───────────────┤  │
│  │ Orchestrator  │  │ Mint + reward
│  ├───────────────┤  │
│  │ AttestedMotion│  │ ERC-721 NFTs
│  └───────────────┘  │
└─────────────────────┘
```

## Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your deployed contract addresses
nano .env
```

## Configuration

Required environment variables in `.env`:

```bash
# Arc RPC
ARC_RPC_URL=https://arc-testnet.rpc.circle.com

# Deployed contract addresses (from Task 7 deployment)
MOTION_NOVELTY_DETECTOR_ADDRESS=0x...
MOTION_MINT_ORCHESTRATOR_ADDRESS=0x...
ATTESTED_MOTION_ADDRESS=0x...
USDC_TOKEN_ADDRESS=0x...

# Agent wallet (validator key for signing attestations)
# ⚠️ TESTNET ONLY - Use HSM/KMS in production
AGENT_PRIVATE_KEY=0x...

# Logging
LOG_LEVEL=info
VERBOSE=false
```

## Usage

### Development Mode (with auto-reload)

```bash
pnpm dev
```

### Production Mode

```bash
# Build TypeScript
pnpm build

# Run compiled JavaScript
pnpm start
```

### Run with Verbose Logging

```bash
VERBOSE=true pnpm dev
```

## Code Structure

```
src/
├── index.ts          # Main entry point, health checks, demo mode
├── config.ts         # Environment validation, structured logging
├── signer.ts         # EIP-712 signing utilities
├── contracts.ts      # ethers.js contract interaction layer
└── processor.ts      # Queue management, batch processing
```

## Key Features

### 1. EIP-712 Attestation Signing

```typescript
import { signMotionAttestation } from './signer';

const attestation = {
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
  embeddingHash: '0x123...',
  nonce: BigInt(Date.now()),
  expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
};

const signature = await signMotionAttestation(wallet, attestation);
```

### 2. Memory-Efficient Batch Processing

```typescript
import { processBatch } from './processor';

const events: MotionEvent[] = [
  /* ... thousands of events ... */
];

// Processes in chunks to avoid memory overflow
const results = await processBatch(events, contracts);
```

### 3. Circuit Breaker for RPC Health

Automatically exits with code `20` if RPC fails consecutively:

```typescript
// Configured in .env
RPC_HEALTH_CHECK_INTERVAL_MS=30000
MAX_CONSECUTIVE_FAILURES=5
```

### 4. Comprehensive Error Handling

```typescript
// Exit codes for operational clarity
0  = clean shutdown
10 = config/env invalid
20 = chain/RPC unhealthy
30 = wallet signing failure
40 = attestation generation failure
50 = contract call revert
60 = unexpected/unhandled
```

## Integration with API Gateway

The agent service is designed to receive motion events from the API gateway:

```typescript
// API Gateway sends webhook
POST http://localhost:3000/webhooks/fitness-tracker
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "embedding": [0.123, 0.456, ...],
  "timestamp": 1698765432,
  "source": "fitness-tracker"
}

// Agent processes event → signs attestation → submits to Arc
```

## Production Deployment

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-service
spec:
  replicas: 1 # Single replica to avoid nonce conflicts
  selector:
    matchLabels:
      app: agent-service
  template:
    metadata:
      labels:
        app: agent-service
    spec:
      containers:
        - name: agent-service
          image: ghcr.io/rydlrcs/kinetic-ledger-agent:latest
          env:
            - name: ARC_RPC_URL
              valueFrom:
                secretKeyRef:
                  name: arc-secrets
                  key: rpc-url
            - name: AGENT_PRIVATE_KEY
              valueFrom:
                secretKeyRef:
                  name: arc-secrets
                  key: agent-private-key
            - name: MOTION_NOVELTY_DETECTOR_ADDRESS
              valueFrom:
                configMapKeyRef:
                  name: contract-addresses
                  key: novelty-detector
          resources:
            requests:
              memory: '256Mi'
              cpu: '100m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            exec:
              command:
                - pgrep
                - node
            initialDelaySeconds: 10
            periodSeconds: 30
```

### Security Best Practices

- **Key Management**: Use AWS KMS, Google Secret Manager, or HashiCorp Vault for production keys
- **Rate Limiting**: Configure `BATCH_SIZE` and `MAX_QUEUE_SIZE` to avoid overwhelming Arc RPC
- **Monitoring**: Export pino logs to Datadog/CloudWatch for observability
- **Nonce Management**: Single replica to avoid nonce conflicts (or implement nonce coordination)

## Testing

```bash
# Lint TypeScript
pnpm lint

# Run unit tests (when implemented)
pnpm test
```

## Logging Examples

### Successful Processing

```json
{
  "level": "info",
  "time": "2025-10-31T12:00:00.000Z",
  "service": "agent-service",
  "action": "motion_processed",
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "embeddingHash": "0x123...",
  "txHash": "0xabc...",
  "tokenId": "42",
  "processedTotal": 1,
  "trace_id": "motion_1698765432_xyz",
  "msg": "Motion event successfully processed"
}
```

### Duplicate Detection

```json
{
  "level": "info",
  "service": "agent-service",
  "action": "duplicate_detected",
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "embeddingHash": "0x123...",
  "msg": "Embedding already processed - skipping"
}
```

### RPC Failure

```json
{
  "level": "error",
  "service": "agent-service",
  "action": "rpc_health_check_failed",
  "consecutiveFailures": 3,
  "maxFailures": 5,
  "msg": "RPC health check failed"
}
```

## Roadmap

- [ ] HTTP webhook listener (currently demo mode only)
- [ ] Multi-agent signature aggregation for ERC-8001 compliance
- [ ] Redis queue for distributed processing
- [ ] Prometheus metrics endpoint
- [ ] Automated retry with exponential backoff
- [ ] Fivetran connector integration for batch ingestion

## Related Documentation

- [RkCNN Novelty Detection](../../packages/contracts/NOVELTY_DETECTION.md)
- [API Gateway README](../api-gateway/README.md)
- [Arc Documentation](https://docs.circle.com/arc)

## License

MIT - See [LICENSE](../../LICENSE)
