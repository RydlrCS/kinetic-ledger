# Kinetic Ledger

**AI-powered payment solution on Arc with USDC** — Built for the Arc x USDC Hackathon (Oct 27 - Nov 9, 2025)

A futuristic, lightweight agentic AI + blockchain framework enabling intelligent financial agents to automate on-chain payments, motion data attestations, and USDC transactions with precision, transparency, and verifiable trust.

## Why Arc?

This project leverages **Arc's USDC-native architecture** to enable:
- **Predictable gas costs** for AI agents (no ETH price volatility)
- **Sub-second finality** for real-time motion-triggered payments
- **Seamless cross-chain USDC movement** via Circle's CCTP
- **Enterprise-ready compliance** through structured logging and audit trails

Traditional blockchains require complex gas token management and unpredictable fees. Arc eliminates this by making USDC the native gas token, enabling agents to reason about costs in stable dollar terms.

## Quick Start

```bash
# Install dependencies
pnpm i

# Setup environment
cp .env.example .env
# Edit .env with your Arc RPC URL and testnet keys

# Build contracts
pnpm -C packages/contracts build

# Run tests
pnpm -C packages/contracts test

# Start development
pnpm dev
```

## Architecture

### Monorepo Structure
```
apps/
├── web-dapp/         # Next.js 15 + wagmi + viem (wallet UX)
├── api-gateway/      # FastAPI proxy (rate-limit, CORS, RBAC)
└── agent-service/    # TypeScript agent (LLM logic, oracles, payflows)

packages/
├── contracts/        # Solidity (ERC-721 + attestation verifier)
├── sdk/             # Shared TypeScript client
└── schemata/        # OpenAPI, JSON Schemas, EIP-712 types

data/
├── pipelines/       # ETL stubs (Fivetran/dbt hooks)
└── samples/         # Demo motion+metrics JSON
```

### Core Contracts

**AttestedMotion** (ERC-721)
- Mints NFTs gated by EIP-712 attestations
- Prevents replay attacks with nonces + expiries
- Emits events for off-chain indexing

**RewardsEscrow**
- Manages USDC disbursements
- Treasurer-only access control
- Links payments to attestation IDs

## Innovation Track

**🔁 On-chain Actions**: AI agents autonomously verify motion data, generate attestations, and trigger USDC payments on Arc with sub-second settlement.

## Key Features

✅ **EIP-712 Signatures** - Structured typed data for all interactions
✅ **Verbose Logging** - Compliance-aware structured logs with `VERBOSE=true`
✅ **Stream Processing** - Handle thousands of data connectors without memory issues
✅ **Memory Efficient** - Batch processing with backpressure handling
✅ **Arc-Native** - USDC gas, sub-second finality, institutional grade

## Development

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git

### Setup

1. Get testnet USDC from the [official faucet](https://faucet.circle.com/)
2. Configure your `.env` file with Arc RPC and private keys
3. Install dependencies: `pnpm i`
4. Build contracts: `pnpm -C packages/contracts build`

### Testing

```bash
# Unit tests (contracts)
pnpm test:contracts

# Integration tests (API + agent)
pnpm test:integration

# E2E tests (dapp)
pnpm test:e2e

# All tests
pnpm test
```

### Deployment

```bash
# Deploy to Arc testnet
cd packages/contracts
npx hardhat run scripts/deploy.ts --network arcTestnet
```

## Project Status

🚧 **Work in Progress** - Implementing for hackathon submission

- [x] Monorepo structure
- [x] Smart contracts (AttestedMotion, RewardsEscrow)
- [x] Contract tests
- [ ] API gateway (FastAPI)
- [ ] Agent service (TypeScript)
- [ ] Web dapp (Next.js)
- [ ] Data pipelines
- [ ] Documentation

## License

Apache-2.0

# kinetic-ledger/

## package.json
```json
{
  "name": "kinetic-ledger",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "bootstrap": "pnpm i && pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "dev": "pnpm -C apps/web-dapp dev & pnpm -C apps/agent-service dev & pnpm -C apps/api-gateway dev"
  },
  "devDependencies": {
    "eslint": "^9.11.0",
    "prettier": "^3.3.3",
    "typescript": "^5.6.2"
  }
}
```

## pnpm-workspace.yaml
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "infra/*"
  - "docs"
```

## .gitignore
```gitignore
node_modules
.env
.env.*
dist
.cache
.artifacts
coverage
__pycache__
*.pyc
.next
```

---
# apps/web-dapp/

## apps/web-dapp/package.json
```json
{
  "name": "web-dapp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 5173",
    "build": "next build",
    "start": "next start",
    "lint": "eslint ."
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "viem": "^2.19.3",
    "wagmi": "^2.12.7",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@types/node": "^20.14.11",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0"
  }
}
```

## apps/web-dapp/app/page.tsx
```tsx
'use client';
import { useEffect, useState } from 'react';
import { createConfig, http, useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

const config = createConfig({
  chains: [],
  transports: { 421614: http(process.env.NEXT_PUBLIC_ARC_RPC_URL!) }
});

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [notice, setNotice] = useState<string>('');

  useEffect(() => { if (error) setNotice(error.message); }, [error]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Kinetic Ledger</h1>
      {!isConnected ? (
        <button onClick={() => connect({ connector: injected() })}>Connect Wallet</button>
      ) : (
        <div>
          <p>Connected: {address}</p>
          <button onClick={() => disconnect()}>Disconnect</button>
        </div>
      )}
      {status === 'pending' && <p>Connecting…</p>}
      {notice && <pre>{notice}</pre>}
      <hr />
      <MintDemo />
    </main>
  );
}

function MintDemo() {
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function trigger() {
    setError(''); setResult('');
    try {
      const res = await fetch('/api/demo');
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const j = await res.json();
      setResult(JSON.stringify(j, null, 2));
    } catch (e:any) { setError(e.message); }
  }

  return (
    <section>
      <h2>Mint via Agent (demo)</h2>
      <button onClick={trigger}>Run</button>
      {result && <pre>{result}</pre>}
      {error && <pre>ERROR: {error}</pre>}
    </section>
  );
}
```

---
# apps/api-gateway/main.py
```py
import os, time, hmac, hashlib
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

app = FastAPI(title="Kinetic Ledger API", version="1.0.0")

class MotionEvent(BaseModel):
  wallet: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")
  bytes_b64: str
  nonce: int

def verify_sig(secret: str, payload: bytes, signature: str) -> bool:
  mac = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
  return hmac.compare_digest(mac, signature)

@app.get('/health')
def health():
  return {"ok": True, "ts": int(time.time())}
```

---
# packages/contracts/package.json
```json
{
  "name": "@kinetic-ledger/contracts",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "hardhat compile",
    "test": "hardhat test",
    "lint": "prettier --check ."
  },
  "devDependencies": {
    "hardhat": "^2.22.10",
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "prettier": "^3.3.3",
    "solhint": "^4.5.4",
    "@openzeppelin/contracts": "^5.0.2"
  }
}
```

---
# ROOT README.md
```md
# Kinetic Ledger — USDC Agents Monorepo

## Quick start
1. `pnpm i`
2. Fill all `.env.example` → `.env` files
3. `pnpm -C packages/contracts build && pnpm -C packages/contracts test`
4. `pnpm -C apps/api-gateway run`
5. `pnpm -C apps/agent-service dev`
6. `pnpm -C apps/web-dapp dev`

## Notes
- Verbose logs + exit codes for rapid debug
- Contracts compile with optimizer + viaIR
- Keep raw data off-chain; only hashes on-chain
```
