# Deployment Guide - Arc Testnet

Complete guide for deploying Kinetic Ledger smart contracts to Arc testnet.

## Prerequisites

1. **Node.js v20+** (or use Docker with `node:20-alpine`)
2. **Testnet USDC** from Circle's faucet
3. **Private key** for deployer wallet

## Step 1: Get Testnet USDC

Arc uses USDC as the native gas token. You must have testnet USDC to deploy contracts.

### Option A: Circle Faucet (Recommended)

1. Visit https://faucet.circle.com/
2. Connect your wallet or enter your address
3. Request testnet USDC for Arc testnet (Chain ID: 421614)
4. Wait for confirmation (~30 seconds)

### Option B: Bridge from Ethereum Sepolia (Alternative)

If the faucet is unavailable, you can bridge testnet USDC from Sepolia:

1. Get Sepolia ETH from https://sepoliafaucet.com/
2. Get testnet USDC from https://faucet.circle.com/ (Sepolia)
3. Bridge to Arc using Circle's CCTP: https://testnet.circle.com/cctp

## Step 2: Configure Environment

```bash
cd packages/contracts

# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env
```

Required variables:

```bash
ARC_RPC_URL=https://rpc.arc-testnet.circle.com
WALLET_PRIVATE_KEY=0x...  # Your deployer private key (testnet only!)
```

**Security Note**: NEVER commit real private keys. Use environment-specific configs or secret managers in production.

## Step 3: Install Dependencies

```bash
# If using pnpm (monorepo root)
cd ../../
pnpm install

# Or npm (contracts directory)
cd packages/contracts
npm install
```

## Step 4: Compile Contracts

```bash
# Compile all contracts
npm run compile

# Expected output:
# ✅ Compiled 11 Solidity files successfully
# ✅ Generated typechain-types/
```

## Step 5: Deploy to Arc Testnet

```bash
# Run deployment script
npx hardhat run scripts/deploy.ts --network arcTestnet
```

Expected output:

```
🚀 Starting Kinetic Ledger deployment to Arc testnet...

📋 Deployment Details:
  Deployer address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1
  USDC balance: 100.00 USDC
  Network: arc-testnet
  Chain ID: 421614

1️⃣  Deploying AttestedMotion...
  ✅ AttestedMotion deployed to: 0x...
  📝 Transaction: 0x...

2️⃣  Deploying MotionNoveltyDetector...
  ✅ MotionNoveltyDetector deployed to: 0x...
  📝 Transaction: 0x...

3️⃣  Deploying MotionMintOrchestrator...
  ✅ MotionMintOrchestrator deployed to: 0x...
  📝 Transaction: 0x...

4️⃣  Configuring contract permissions...
  ✅ Authorized orchestrator as agent in novelty detector
  📝 Transaction: 0x...

5️⃣  Saving deployment addresses...
  ✅ Deployment addresses saved to: deployments/arc-testnet-TIMESTAMP.json

6️⃣  Environment variable updates:

# Add these to your .env files:

# Arc Testnet Contract Addresses
ATTESTED_MOTION_ADDRESS=0x...
MOTION_NOVELTY_DETECTOR_ADDRESS=0x...
MOTION_MINT_ORCHESTRATOR_ADDRESS=0x...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Deployment completed successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Step 6: Update Application .env Files

Copy the deployed contract addresses to your application services:

### apps/agent-service/.env

```bash
MOTION_NOVELTY_DETECTOR_ADDRESS=0x...  # From deployment output
MOTION_MINT_ORCHESTRATOR_ADDRESS=0x...
ATTESTED_MOTION_ADDRESS=0x...
```

### apps/api-gateway/.env

```bash
MOTION_NOVELTY_DETECTOR_ADDRESS=0x...  # From deployment output
MOTION_MINT_ORCHESTRATOR_ADDRESS=0x...
```

### apps/web-dapp/.env (when implemented)

```bash
NEXT_PUBLIC_ATTESTED_MOTION_ADDRESS=0x...
NEXT_PUBLIC_NOVELTY_DETECTOR_ADDRESS=0x...
NEXT_PUBLIC_ORCHESTRATOR_ADDRESS=0x...
```

## Step 7: Authorize Agent Address

The deployment script authorizes the orchestrator, but you also need to authorize your agent service:

```bash
# Get agent address from apps/agent-service/.env
AGENT_ADDRESS=0x...

# Run authorization script
npx hardhat run scripts/authorize-agent.ts --network arcTestnet
```

Or manually via Hardhat console:

```javascript
npx hardhat console --network arcTestnet

const detector = await ethers.getContractAt(
  "MotionNoveltyDetector",
  "0x..."  // deployed address
);

await detector.setAgentAuthorization("0x...", true);  // agent address
```

## Step 8: Verify Deployment

### Check Contract on Arc Explorer

Visit https://explorer.arc-testnet.circle.com/ and search for your contract addresses to verify:

- Contracts are deployed
- Transactions succeeded
- USDC was deducted for gas fees

### Test Attestation Flow

```bash
# Run test script with deployed contracts
npx hardhat test --network arcTestnet

# Or use agent service demo mode
cd ../../apps/agent-service
npm run dev
```

## Troubleshooting

### Error: "Insufficient USDC balance"

**Solution**: Get more testnet USDC from https://faucet.circle.com/

### Error: "Nonce too high"

**Solution**: Reset your wallet nonce or wait for pending transactions to confirm

```bash
# Check pending transactions
npx hardhat console --network arcTestnet
await ethers.provider.getTransactionCount("YOUR_ADDRESS", "pending")
```

### Error: "Transaction reverted"

**Solution**: Check revert reason in Arc explorer. Common causes:
- Insufficient gas limit
- Contract constructor parameter mismatch
- Authorization issues

Enable verbose logging:

```bash
VERBOSE=true npx hardhat run scripts/deploy.ts --network arcTestnet
```

### Error: "Network connection timeout"

**Solution**: Check Arc RPC endpoint status

```bash
# Test RPC connection
curl -X POST https://rpc.arc-testnet.circle.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Gas Costs (Estimated)

| Contract                   | Deployment Cost |
| -------------------------- | --------------- |
| AttestedMotion             | ~0.50 USDC      |
| MotionNoveltyDetector      | ~1.20 USDC      |
| MotionMintOrchestrator     | ~0.80 USDC      |
| Authorization transactions | ~0.05 USDC      |
| **Total**                  | **~2.55 USDC**  |

**Note**: Actual costs may vary based on network congestion. Request at least 5 USDC from faucet to have buffer.

## Next Steps After Deployment

1. ✅ Update all .env files with deployed addresses
2. ✅ Authorize agent service address
3. ✅ Test motion attestation flow
4. ✅ Build web dapp frontend (Task 6)
5. ✅ Create presentation materials (Task 10)

## Related Documentation

- [MotionNoveltyDetector Implementation](./NOVELTY_DETECTION.md)
- [Agent Service README](../../apps/agent-service/README.md)
- [Arc Documentation](https://docs.circle.com/arc)
- [Circle Faucet](https://faucet.circle.com/)

## Support

- **Arc Discord**: https://discord.gg/circle
- **GitHub Issues**: https://github.com/RydlrCS/kinetic-ledger/issues
- **Documentation**: https://docs.circle.com/arc/deploy-contract
