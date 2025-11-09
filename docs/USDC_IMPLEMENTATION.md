# USDC Implementation on Arc Testnet

Complete implementation for sending and managing USDC on Arc blockchain, based on Circle's official tutorial.

## Overview

Arc uses **USDC as the native gas token** (Chain ID: 421614). All transaction fees are paid in USDC instead of ETH.

## Files Created

### 1. **SDK Module** (`packages/sdk/src/usdc.ts`)
Core utilities for USDC operations using ethers.js:
- ✅ Parse and format USDC amounts (6 decimals)
- ✅ Get USDC balance
- ✅ Send USDC transfers
- ✅ Approve spending
- ✅ Batch transfers
- ✅ Check allowances

### 2. **React Hook** (`apps/web-dapp/src/hooks/useUSDCTransfer.ts`)
wagmi-based React hook for web dApp:
- ✅ `useUSDCTransfer()` - Send USDC with React
- ✅ Balance checking
- ✅ Transaction confirmation
- ✅ Error handling

### 3. **Example Script** (`examples/send-usdc-arc.ts`)
Complete working example demonstrating:
- ✅ Initialize wallet and provider
- ✅ Connect to Arc testnet
- ✅ Check USDC balance
- ✅ Send USDC transfer
- ✅ Wait for confirmation
- ✅ Parse Transfer events

## Quick Start

### 1. Get Testnet USDC

Visit Circle's faucet: https://faucet.circle.com/
- Select "Arc Testnet"
- Enter your wallet address
- Request testnet USDC

### 2. Run Example Script

```bash
# Install dependencies
pnpm add ethers dotenv

# Set environment variables
cp .env.example .env
# Edit .env:
# PRIVATE_KEY=your_private_key_here
# USDC_ADDRESS=arc_testnet_usdc_address
# RECIPIENT_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C

# Run the example
pnpm tsx examples/send-usdc-arc.ts
```

**Expected Output:**
```
🚀 Sending USDC on Arc Testnet

Wallet Address: 0x...
Network: arc-testnet
Chain ID: 421614
USDC Contract: 0x...

💰 USDC Balance: 100.00 USDC

📤 Transfer Details:
   From: 0x...
   To: 0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C
   Amount: 10.50 USDC

⛽ Estimating gas...
   Gas Estimate: 51234
   Estimated Fee: 0.01 USDC

📡 Sending transaction...
   Transaction Hash: 0xabc123...
   View on Explorer: https://explorer.arc-testnet.circle.com/tx/0xabc123...

⏳ Waiting for confirmation...

✅ Transaction Confirmed!
   Block Number: 12345
   Gas Used: 51234
   Actual Fee: 0.01 USDC

💰 New USDC Balance: 89.49 USDC
   Change: -10.51 USDC

📋 Transfer Event:
   From: 0x...
   To: 0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C
   Amount: 10.50 USDC

✨ Done!
```

### 3. Use in Backend (ethers.js)

```typescript
import { ethers } from 'ethers';
import { sendUSDC, getUSDCContract, getBalance } from '@kinetic-ledger/sdk/usdc';

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider('https://rpc.arc-testnet.circle.com');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Get USDC contract
const usdc = getUSDCContract('0x...', wallet);

// Check balance
const balance = await getBalance(usdc, wallet.address);
console.log(`Balance: ${balance.formatted} USDC`);

// Send USDC
const result = await sendUSDC(usdc, '0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C', '10.5');
console.log(`Sent ${result.amountSent} USDC`);
console.log(`Transaction: ${result.txHash}`);
```

### 4. Use in React dApp (wagmi)

```tsx
import { useUSDCTransfer } from '@/hooks/useUSDCTransfer';

function SendUSDCButton() {
  const { sendUSDC, balance, isTransferring } = useUSDCTransfer();
  
  const handleSend = async () => {
    const result = await sendUSDC(
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C',
      '10.5'
    );
    
    if (result.success) {
      console.log(`Transfer successful: ${result.txHash}`);
    } else {
      console.error(`Transfer failed: ${result.error}`);
    }
  };
  
  return (
    <div>
      <p>Balance: {balance} USDC</p>
      <button onClick={handleSend} disabled={isTransferring}>
        {isTransferring ? 'Sending...' : 'Send 10.5 USDC'}
      </button>
    </div>
  );
}
```

## API Reference

### SDK Functions (ethers.js)

#### `parseUSDC(amount: string | number): bigint`
Convert human-readable amount to wei (6 decimals)
```typescript
parseUSDC('10.5') // 10500000n
```

#### `formatUSDC(amount: bigint): string`
Convert wei to human-readable amount
```typescript
formatUSDC(10500000n) // "10.5"
```

#### `sendUSDC(usdc: Contract, to: string, amount: string | bigint)`
Send USDC to a recipient
```typescript
const result = await sendUSDC(usdc, '0x...', '10.5');
// Returns: { txHash, receipt, amountSent }
```

#### `approveUSDC(usdc: Contract, spender: string, amount: string | bigint)`
Approve USDC spending for contracts
```typescript
const result = await approveUSDC(usdc, orchestratorAddress, '100');
// Returns: { txHash, receipt }
```

#### `getBalance(usdc: Contract, address: string)`
Get USDC balance
```typescript
const balance = await getBalance(usdc, walletAddress);
// Returns: { raw: 10500000n, formatted: "10.5" }
```

#### `batchSendUSDC(usdc: Contract, recipients: Array<{address, amount}>)`
Send USDC to multiple recipients
```typescript
const results = await batchSendUSDC(usdc, [
  { address: '0xabc...', amount: '10' },
  { address: '0xdef...', amount: '20' },
]);
```

### React Hook (wagmi)

#### `useUSDCTransfer()`
Returns:
- `sendUSDC(to: Address, amount: string)` - Send USDC
- `approveUSDC(spender: Address, amount: string)` - Approve spending
- `balance` - Formatted USDC balance
- `balanceRaw` - Raw balance (bigint)
- `isTransferring` - Transaction in progress
- `isConfirming` - Waiting for confirmation
- `isConfirmed` - Transaction confirmed
- `refetchBalance()` - Manually refresh balance

## Arc Testnet Details

- **Chain ID**: 421614
- **RPC URL**: https://rpc.arc-testnet.circle.com
- **Explorer**: https://explorer.arc-testnet.circle.com
- **Faucet**: https://faucet.circle.com/
- **Native Gas Token**: USDC (6 decimals)

## Integration with Kinetic Ledger

### Motion Minting with USDC Fees

```typescript
import { useUSDCTransfer } from '@/hooks/useUSDCTransfer';
import { useWriteContract } from 'wagmi';

function MintMotionNFT() {
  const { balance, isTransferring } = useUSDCTransfer();
  const { writeContractAsync } = useWriteContract();
  
  const mintingFee = '7.00'; // 7 USDC per token
  
  const handleMint = async () => {
    // Check balance
    if (parseFloat(balance) < parseFloat(mintingFee)) {
      throw new Error('Insufficient USDC balance');
    }
    
    // Call orchestrator (uses USDC for gas)
    const tx = await writeContractAsync({
      address: orchestratorAddress,
      abi: orchestratorABI,
      functionName: 'verifyAndMint',
      args: [/* ... */],
    });
    
    console.log(`Motion NFT minted! Gas paid in USDC: ${tx.hash}`);
  };
  
  return (
    <button onClick={handleMint} disabled={isTransferring}>
      Mint NFT (Fee: {mintingFee} USDC)
    </button>
  );
}
```

### Rewards Distribution

```typescript
import { batchSendUSDC } from '@kinetic-ledger/sdk/usdc';

// Distribute rewards to multiple users
const rewards = [
  { address: '0xuser1...', amount: '5.00' }, // 5 USDC
  { address: '0xuser2...', amount: '10.00' }, // 10 USDC
  { address: '0xuser3...', amount: '3.50' }, // 3.5 USDC
];

const results = await batchSendUSDC(usdc, rewards);

results.forEach(result => {
  if (result.status === 'success') {
    console.log(`✅ Sent ${result.amountSent} USDC to ${result.address}`);
  } else {
    console.error(`❌ Failed to send to ${result.address}: ${result.error}`);
  }
});
```

## Error Handling

Common errors and solutions:

### "Insufficient balance"
**Cause**: Not enough USDC in wallet  
**Solution**: Get testnet USDC from https://faucet.circle.com/

### "Invalid recipient address"
**Cause**: Malformed Ethereum address  
**Solution**: Verify address format (0x followed by 40 hex characters)

### "Transaction reverted"
**Cause**: Various (contract logic, gas issues)  
**Solution**: Check Arc Explorer for revert reason

### "Wrong network"
**Cause**: Connected to wrong chain  
**Solution**: Switch to Arc Testnet (Chain ID: 421614)

## Testing

```bash
# Test USDC transfer
pnpm tsx examples/send-usdc-arc.ts

# Test in development
cd apps/web-dapp
pnpm dev
# Open http://localhost:3000/studio
# Test wallet connection and USDC transfer
```

## Production Considerations

1. **Key Management**: Use secure key storage (AWS KMS, HashiCorp Vault)
2. **Gas Monitoring**: Track USDC gas costs for analytics
3. **Balance Checks**: Always verify balance before transfers
4. **Error Recovery**: Implement retry logic with exponential backoff
5. **Transaction Tracking**: Store txHash for audit trails
6. **Rate Limiting**: Prevent spam with rate limits
7. **Compliance**: Log all transfers for regulatory requirements

## Resources

- **Circle Tutorial**: https://developers.circle.com/tutorials/getting-started-with-arc-testnet-send-usdc-with-ethersjs
- **Arc Documentation**: https://docs.circle.com/arc
- **USDC Standard**: ERC-20 (6 decimals)
- **ethers.js Docs**: https://docs.ethers.org/v6/
- **wagmi Docs**: https://wagmi.sh/

## License

MIT
