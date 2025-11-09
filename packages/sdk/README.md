# @kinetic-ledger/sdk

TypeScript SDK for Kinetic Ledger on Arc blockchain.

## Installation

```bash
pnpm add @kinetic-ledger/sdk
```

## Usage

### USDC Transfers

```typescript
import { sendUSDC, getUSDCContract, parseUSDC } from '@kinetic-ledger/sdk/usdc';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://rpc.arc-testnet.circle.com');
const wallet = new ethers.Wallet(privateKey, provider);
const usdc = getUSDCContract(usdcAddress, wallet);

// Send 10.5 USDC
const result = await sendUSDC(usdc, recipientAddress, '10.5');
console.log(`Transaction: ${result.txHash}`);
```

## Modules

- `usdc` - USDC transfer utilities for Arc testnet

## Documentation

See [USDC_IMPLEMENTATION.md](../../docs/USDC_IMPLEMENTATION.md) for complete guide.
