# Team name ideas (pick 1–2 you like)

* MotionMint
* ArcMōtif
* USDC Velocity
*** KineticLedger**
* Attest&Pay
* MotifWorks
* ArcBehave
* VectorVault
* AgenticFlow
* Blend&Bond

# Monorepo layout (pnpm workspaces)

```
arc-agents-usdc/
├─ apps/
│  ├─ web-dapp/                # Next.js 15 + wagmi + viem (wallet UX)
│  ├─ api-gateway/             # FastAPI proxy (rate-limit, CORS, RBAC)
│  └─ agent-service/           # TypeScript agent (LLM logic, oracles, payflows)
├─ packages/
│  ├─ contracts/               # Solidity (ERC-721/1155 + attestation verifier)
│  ├─ sdk/                     # Shared TypeScript client (contracts + API)
│  └─ schemata/                # OpenAPI, JSON Schemas, EIP-712 types
├─ data/
│  ├─ pipelines/               # ETL stubs (Fivetran/dbt hooks)
│  └─ samples/                 # Demo motion+metrics JSON (seed)
├─ infra/
│  ├─ terraform/               # Arc RPC, secrets, buckets, CI identities
│  └─ github-actions/          # Reusable workflows
├─ docs/
│  ├─ GETTING_STARTED.md
│  ├─ ARCHITECTURE.md
│  ├─ RUNBOOK.md               # On-call, SLOs, playbooks
│  └─ SECURITY.md
├─ .github/
│  └─ workflows/               # ci.yml, slither.yml, hardhat.yml, dapp.yml
├─ package.json
├─ pnpm-workspace.yaml
└─ README.md
```

# README.md (starter)

````md
# Arc Agents with USDC — Motion Tokens

## What it does
- Captures/verifies an off-chain “event” (e.g., motion metric) via an agent
- Agent generates EIP-712 attestation → on-chain mint/payment on Arc with USDC
- Verifiable audit trail; privacy by keeping raw data off-chain

## Quick start
```bash
pnpm i
pnpm -C packages/contracts hardhat compile
pnpm -C packages/contracts hardhat test
pnpm -C apps/agent-service dev
pnpm -C apps/web-dapp dev
````

## Env

Copy `.env.example` to `.env` in each app. Never commit secrets.

```
ARC_RPC_URL=
USDC_TOKEN_ADDRESS=
WALLET_PRIVATE_KEY=
AGENT_WEBHOOK_SECRET=
```

## Docs

* docs/ARCHITECTURE.md — components & flows
* docs/RUNBOOK.md — deploy, rollback, incident steps
* docs/SECURITY.md — threat model, keys, risk controls

````

# Solidity: minimal, audit-friendly contracts (with verbose checks)

`packages/contracts/contracts/AttestedMotion.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AttestedMotion
 * @notice ERC-721 motion NFT mint gated by EIP-712 attestation.
 * - Pausable, ReentrancyGuard, Ownable
 * - Verifies signer(s), expiry, nonce, dataHash
 * - Emits detailed failure reasons for debug (reverts with custom errors)
 */
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error InvalidSigner();
error ExpiredAttestation();
error UsedNonce();
error HashMismatch();

contract AttestedMotion is ERC721, ReentrancyGuard, Pausable, Ownable {
    bytes32 public constant EIP712_DOMAIN =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant MINT_TYPEHASH =
        keccak256("Mint(address to,bytes32 dataHash,uint256 nonce,uint256 expiry)");

    mapping(uint256 => bool) public usedNonce;
    address public validator; // trusted oracle/agent key
    uint256 public tokenIdSeq;

    constructor(address _validator) ERC721("MotionNFT", "MOTION") {
        validator = _validator;
    }

    function setValidator(address _v) external onlyOwner { validator = _v; }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            EIP712_DOMAIN,
            keccak256(bytes("AttestedMotion")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    function _hashMint(address to, bytes32 dataHash, uint256 nonce, uint256 expiry) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(MINT_TYPEHASH, to, dataHash, nonce, expiry));
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function mintWithAttestation(
        address to,
        bytes32 dataHash,
        uint256 nonce,
        uint256 expiry,
        bytes calldata sig
    ) external nonReentrant whenNotPaused returns (uint256 tokenId) {
        if (block.timestamp > expiry) revert ExpiredAttestation();
        if (usedNonce[nonce]) revert UsedNonce();

        bytes32 digest = _hashMint(to, dataHash, nonce, expiry);
        (bytes32 r, bytes32 s, uint8 v) = _split(sig);
        address recovered = ecrecover(digest, v, r, s);
        if (recovered != validator) revert InvalidSigner();

        usedNonce[nonce] = true;
        tokenId = ++tokenIdSeq;
        _safeMint(to, tokenId);

        // Store dataHash in event for traceability
        emit MotionMinted(to, tokenId, dataHash, nonce, expiry);
    }

    event MotionMinted(address indexed to, uint256 indexed tokenId, bytes32 dataHash, uint256 nonce, uint256 expiry);

    function _split(bytes memory sig) private pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "BadSigLen");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
    }
}
````

`packages/contracts/contracts/RewardsEscrow.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error InsufficientFunding();
error TransferFailed();
error NotTreasurer();

contract RewardsEscrow is ReentrancyGuard {
    IERC20 public immutable USDC;
    address public treasurer;

    event Disbursed(address indexed to, uint256 amount, bytes32 attestationId);

    modifier onlyTreasurer() { if (msg.sender != treasurer) revert NotTreasurer(); _; }

    constructor(address usdc, address _treasurer) { USDC = IERC20(usdc); treasurer = _treasurer; }

    function setTreasurer(address t) external onlyTreasurer { treasurer = t; }

    function disburse(address to, uint256 amount, bytes32 attestationId) external nonReentrant onlyTreasurer {
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientFunding();
        bool ok = USDC.transfer(to, amount);
        if (!ok) revert TransferFailed();
        emit Disbursed(to, amount, attestationId);
    }
}
```

# Agent (TypeScript) with robust retries, exits, and observability

`apps/agent-service/src/index.ts`

```ts
import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import pino from 'pino';
import { setTimeout as wait } from 'timers/promises';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

/** Exit codes (RUNBOOK.md)
 *  0 = clean shutdown
 *  10 = config/env invalid
 *  20 = chain/RPC unhealthy
 *  30 = wallet signing failure
 *  40 = attestation generation failure
 *  50 = contract call revert (checked)
 *  60 = unexpected/unhandled
 */

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) { log.error({ key }, 'Missing env'); process.exit(10); }
  return v;
}

const RPC = requireEnv('ARC_RPC_URL');
const PRIV = requireEnv('WALLET_PRIVATE_KEY');
const account = privateKeyToAccount(`0x${PRIV}`);

const client = createPublicClient({ transport: http(RPC), batch: { multicall: true }});
const wallet = createWalletClient({ transport: http(RPC), account });

async function healthcheck(): Promise<boolean> {
  try {
    const block = await client.getBlockNumber();
    log.info({ block: block.toString() }, 'RPC ok');
    return true;
  } catch (e) {
    log.warn({ err: e }, 'RPC healthcheck failed');
    return false;
  }
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5, baseMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const backoff = Math.min(10_000, baseMs * 2 ** (i - 1));
      log.warn({ attempt: i, backoff, label, err: e }, 'Retryable failure');
      await wait(backoff);
    }
  }
  log.error({ label, err: lastErr }, 'Exhausted retries');
  throw lastErr;
}

// EIP-712 typed data builder (shared via packages/schemata)
import { buildMintTypedData, hashMotionBytes } from '@arc-agents/schemata';

async function main() {
  if (!(await healthcheck())) process.exit(20);

  // 1) Pull next validated motion event from API (or read sample)
  const motion = await withRetry(async () => {
    const res = await fetch(process.env.EVENT_FEED_URL!, { headers: { 'x-auth': process.env.AGENT_WEBHOOK_SECRET! }});
    if (!res.ok) throw new Error(`FEED_${res.status}`);
    return res.json();
  }, 'pull-motion');

  // 2) Compute content hash and EIP-712 signature
  const dataHash = hashMotionBytes(motion.bytes);
  const typed = buildMintTypedData({
    chainId: await client.getChainId(),
    verifyingContract: process.env.MOTION_CONTRACT!,
    to: motion.wallet,
    dataHash,
    nonce: motion.nonce,
    expiry: Math.floor(Date.now()/1000) + 300
  });

  const signature = await withRetry(async () => {
    try {
      return await wallet.signTypedData(typed);
    } catch (e) {
      throw new Error('SIGN_FAIL');
    }
  }, 'sign-typed');

  // 3) Call contract (with gas estimation + revert decoding)
  const hash = await withRetry(async () => {
    try {
      return await wallet.writeContract({
        address: typed.domain.verifyingContract as `0x${string}`,
        abi: [ /* AttestedMotion ABI fragment */ ],
        functionName: 'mintWithAttestation',
        args: [motion.wallet, dataHash, motion.nonce, typed.message.expiry, signature]
      });
    } catch (e: any) {
      if (e.shortMessage) log.error({ reason: e.shortMessage }, 'Revert');
      throw e;
    }
  }, 'mint-call', 4, 1000);

  log.info({ tx: hash }, 'Mint submitted');

  // graceful shutdown after one loop (demo). In prod run a worker loop.
  process.exit(0);
}

process.on('SIGINT', () => { log.info('SIGINT'); process.exit(0); });
process.on('SIGTERM', () => { log.info('SIGTERM'); process.exit(0); });
process.on('unhandledRejection', (e) => { console.error(e); process.exit(60); });
process.on('uncaughtException', (e) => { console.error(e); process.exit(60); });

main().catch((e) => { console.error(e); process.exit(60); });
```

# API Gateway (FastAPI) with explicit error & retry semantics

`apps/api-gateway/main.py`

```py
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field
import os, time, hmac, hashlib

app = FastAPI(title="Arc Agent API", version="1.0.0")

class MotionEvent(BaseModel):
    wallet: str = Field(..., pattern="^0x[a-fA-F0-9]{40}$")
    bytes_b64: str
    nonce: int

def verify_sig(secret: str, payload: bytes, signature: str) -> bool:
    mac = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(mac, signature)

@app.post("/events")
def push_event(ev: MotionEvent, x_signature: str = Header(default="")):
    secret = os.getenv("INGEST_SECRET", "")
    raw = (ev.json()).encode()
    if not secret or not verify_sig(secret, raw, x_signature):
        raise HTTPException(401, "BAD_SIGNATURE")
    # store reliably (idempotent by nonce)
    # ... (upsert to queue)
    return {"status":"queued","nonce":ev.nonce,"ts":int(time.time())}
```

# Web Dapp (Next.js) – developer-controlled wallets & verbose UX

* Connect wallet (or embedded/developer-controlled wallet)
* Show: “Motions Captured / NFTs Minted / USDC Paid”
* Decode revert reasons and surface human-readable errors
* Components: `TxStatus` (pending/confirmed/fail with reason), `GuardRail` (daily payout caps, require admin sign-off above thresholds)

# CI/CD, quality & security

* **Lint/format**: ESLint + Prettier (TS), Ruff/Black (Python), Solhint + Prettier Solidity
* **Tests**: Hardhat (chai + waffle) with revert reason assertions; PyTest; Playwright for Dapp flows
* **Static analysis**: Slither, Mythril (fast checks on PR)
* **Secrets**: no plaintext in CI; OIDC → cloud secret manager; dotenv only locally
* **Branch rules**: required checks (tests, lint, slither), conventional commits, protected main
* **SBOM**: `pnpm dlx syft . -o json > sbom.json` on release

`.github/workflows/ci.yml` (excerpt)

```yaml
name: ci
on: [push, pull_request]
jobs:
  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm i
      - run: pnpm -C packages/contracts test
      - name: Slither
        uses: crytic/slither-action@v0.3.0
        with: { target: packages/contracts }
  app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm i
      - run: pnpm -C apps/agent-service build && pnpm -C apps/agent-service test
      - run: pnpm -C apps/web-dapp build
```

# Error, exit, retry & runbook highlights

* **Retries**: capped exponential backoff, jitter, idempotent ops only; log context `{attempt, backoff, label}`
* **Exit codes**: documented; every `process.exit(code)` tied to RUNBOOK action (who/what next)
* **Reverts**: decode, map to user-friendly messages; include contract address, fn, chainId
* **Circuit breaker**: if RPC/USDC unhealthy for N minutes → pause agent & alert
* **Rate limits**: gateway throttles per IP + HMAC webhooks
* **Observability**: pino structured logs → Loki/Grafana; OpenTelemetry traces (http, RPC)

# Coding best practices for the team

* Keep **raw data off-chain**; only hashes/attestations on-chain; stablecoin (USDC) for all value transfers
* **EIP-712 everywhere** (clear-sign inputs); **nonces + expiries** to prevent replay; **pause switches** on money paths
* **Principle of least privilege**: separate treasurer key; deployer ≠ treasurer ≠ validator
* **Deterministic builds** & pinned deps; enable `--via-ir` & optimizer in Solidity
* **Threat model** documented in `docs/SECURITY.md` (oracle spoofing, replay, key loss, MEV griefing)
* **UX resilience**: optimistic UI with on-chain confirmation; “Try again” buttons show *actual* failure reason & include retry policy
