# Quick Test Guide - USDC on Arc Testnet

## ⚡ 5-Minute Test Setup

### Prerequisites
✅ SDK built and dependencies installed  
✅ Code committed and pushed to GitHub

### Step 1: Get Testnet USDC (2 minutes)

1. Visit https://faucet.circle.com/
2. Select **"Arc Testnet"** from dropdown
3. Enter your wallet address
4. Click "Request USDC"
5. Wait for confirmation (~30 seconds)

### Step 2: Create Environment File (1 minute)

Create `.env` in project root:

```bash
# Your wallet private key (NEVER commit this!)
PRIVATE_KEY=0x1234567890abcdef...

# Arc testnet USDC contract address
# Get from: https://docs.circle.com/arc/supported-tokens
USDC_ADDRESS=0x...  # Fill in Arc testnet USDC address

# Test recipient address (or use your own second wallet)
RECIPIENT_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C
```

### Step 3: Run USDC Transfer Example (2 minutes)

```bash
# From project root
pnpm tsx examples/send-usdc-arc.ts
```

### Expected Output

```
🚀 Starting USDC Transfer on Arc Testnet...

📍 Wallet Address: 0xYourAddressHere
   Network: Arc Testnet (Chain ID: 421614)
   RPC URL: https://rpc.arc-testnet.circle.com

💰 USDC Balance Check:
   Current Balance: 100.00 USDC
   Contract: 0xUSDCAddressHere

📤 Preparing Transfer:
   From: 0xYourAddressHere
   To: 0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C
   Amount: 10.50 USDC

⛽ Gas Estimation:
   Gas Estimate: 52,000
   Gas Price: 0.000001 USDC/gas
   Estimated Gas Cost: 0.000052 USDC

📡 Transaction Submitted:
   TX Hash: 0xTransactionHashHere
   Explorer: https://arc-testnet.circle.com/tx/0xTransactionHashHere

⏳ Waiting for confirmation...

✅ Transaction Confirmed!
   Block Number: 12345678
   Gas Used: 51,234
   Actual Gas Cost: 0.000051 USDC

📋 Transfer Event:
   From: 0xYourAddressHere
   To: 0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C
   Amount: 10.50 USDC

✨ Final Balance:
   New Balance: 89.50 USDC
   Successfully transferred 10.50 USDC!
```

### Troubleshooting

#### Error: "Insufficient balance"
- **Solution**: Request more USDC from faucet (up to 100 USDC per request)

#### Error: "Cannot find module 'ethers'"
- **Solution**: Run `pnpm install` in project root
- **Check**: `ls node_modules/ethers` should exist

#### Error: "Invalid RPC URL" or Network error
- **Solution**: Check Arc testnet RPC is accessible:
  ```bash
  curl https://rpc.arc-testnet.circle.com \
    -X POST \
    -H "Content-Type: application/json" \
    --data '{"method":"eth_chainId","params":[],"id":1,"jsonrpc":"2.0"}'
  ```
  Should return: `{"jsonrpc":"2.0","id":1,"result":"0x66eee"}`  (Chain ID 421614)

#### Error: "Transaction reverted"
- **Possible causes**:
  - Recipient address invalid (check format: `0x...`)
  - USDC contract address incorrect
  - Nonce issues (wait a bit and retry)

### Step 4: Test Motion Minting (Optional)

**Prerequisites**: Deployed contracts on Arc testnet

```bash
# Update .env with contract addresses
ORCHESTRATOR_ADDRESS=0x...
NOVELTY_DETECTOR_ADDRESS=0x...

# Run minting example
pnpm tsx examples/mint-with-usdc.ts
```

This will:
1. Check USDC balance (need ≥10 USDC)
2. Generate mock motion embedding
3. Create EIP-712 signature
4. Estimate gas in USDC
5. Submit minting transaction (7 USDC fee + gas)
6. Verify NFT minted and show gas paid

### Next Steps

Once USDC transfers are working:

1. **Integrate into UI**: Add `useUSDCTransfer` hook to Motion Studio
   ```typescript
   // apps/web-dapp/src/app/studio/page.tsx
   import { useUSDCTransfer } from '@/hooks/useUSDCTransfer';
   
   const { sendUSDC, balance } = useUSDCTransfer();
   ```

2. **Update WalletPaymentPanel**: Add USDC transfer button
   ```typescript
   const handleTransfer = async () => {
     const result = await sendUSDC(recipientAddress, '7.0');
     if (result.success) {
       toast.success(`Sent 7 USDC! TX: ${result.txHash}`);
     }
   };
   ```

3. **Test in Browser**: 
   - Dev server should still be running on http://localhost:3000
   - Connect wallet (WalletConnect)
   - Check USDC balance displays
   - Try minting motion NFT (7 USDC fee)

### Resources

- **Full Documentation**: [docs/USDC_IMPLEMENTATION.md](./docs/USDC_IMPLEMENTATION.md)
- **Implementation Summary**: [USDC_IMPLEMENTATION_SUMMARY.md](./USDC_IMPLEMENTATION_SUMMARY.md)
- **Arc Testnet Explorer**: https://arc-testnet.circle.com/
- **Circle Faucet**: https://faucet.circle.com/
- **Arc Documentation**: https://docs.circle.com/arc

### Time Budget

- ✅ **Done** (0 min): Dependencies installed, SDK built, code committed
- ⏱️ **Testing** (5 min): Get USDC → Create .env → Run example → Verify
- ⏱️ **Integration** (15 min): Add hook to UI → Test in browser
- ⏱️ **Polish** (10 min): Final commit → Update README → Screenshot

**Total remaining**: ~30 minutes to complete before hackathon deadline

---

**Status**: Ready to test on Arc testnet 🚀  
**Commit**: a986080 (pushed to main)  
**Date**: November 9, 2025
