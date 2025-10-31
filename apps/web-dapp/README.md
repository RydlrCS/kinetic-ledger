# Web Dapp - Kinetic Ledger

Next.js 15 web application for motion attestation on Arc blockchain.

## Features

- 🌈 **RainbowKit** wallet connection (MetaMask, WalletConnect, Coinbase Wallet)
- ⚡ **wagmi + viem** for blockchain interactions
- 💰 **USDC Balance** display (native gas on Arc)
- 📝 **Motion Attestation** submission form
- 🖼️ **NFT Gallery** for minted motion NFTs
- 🎨 **Tailwind CSS** with Arc brand colors
- 🌓 **Dark mode** support

## Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with deployed contract addresses
nano .env.local
```

## Configuration

Required environment variables in `.env.local`:

```bash
# Arc Testnet
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.arc-testnet.circle.com

# Contract Addresses (from deployment)
NEXT_PUBLIC_ATTESTED_MOTION_ADDRESS=0x...
NEXT_PUBLIC_NOVELTY_DETECTOR_ADDRESS=0x...
NEXT_PUBLIC_ORCHESTRATOR_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...

# WalletConnect Project ID
# Get free ID from: https://cloud.walletconnect.com/
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
```

## Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

## Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Architecture

```
src/
├── app/
│   ├── layout.tsx       # Root layout with providers
│   ├── page.tsx         # Main page with wallet connection
│   └── globals.css      # Global styles + Tailwind
├── components/
│   ├── Providers.tsx            # Wagmi + RainbowKit setup
│   ├── USDCBalance.tsx         # Display wallet USDC balance
│   ├── MotionAttestation.tsx   # Attestation submission form
│   └── NFTGallery.tsx          # Display minted motion NFTs
└── config/
    └── wagmi.ts         # Arc testnet chain config + contract addresses
```

## Smart Contract Integration

### Read Operations (wagmi `useReadContract`)
- **USDC Balance**: `balanceOf(address)`
- **NFT Count**: `AttestedMotion.balanceOf(address)`
- **Token IDs**: `tokenOfOwnerByIndex(address, uint256)`

### Write Operations (wagmi `useWriteContract`)
- **Submit Attestation**: `MotionMintOrchestrator.verifyAndMint(...)`
  - Generates mock embedding (128 dimensions)
  - Calls orchestrator with compliance metadata
  - Waits for transaction confirmation
  - Displays success message with explorer link

## User Flow

1. **Connect Wallet** (RainbowKit modal)
2. **View USDC Balance** (native gas token on Arc)
3. **Select Activity Type** (running, walking, cycling, etc.)
4. **Submit Attestation** (generates mock embedding)
5. **Confirm Transaction** (using USDC for gas)
6. **View Minted NFT** (appears in gallery automatically)

## Limitations (Demo Mode)

⚠️ **This is a demo interface**. Production deployment would require:

1. **Real Motion Data**: Connect to fitness trackers (Apple Watch, Fitbit, Garmin)
2. **Agent Service Integration**: Call `/attestations/generate` API endpoint
3. **Signature Verification**: Use real EIP-712 signatures from authorized agents
4. **Error Handling**: Revert reason decoding and user-friendly messages
5. **Transaction History**: Index past attestations with GraphQL or subgraph
6. **NFT Metadata**: Display actual motion metrics (distance, duration, etc.)

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Environment variables:
- Add all `NEXT_PUBLIC_*` variables in Vercel dashboard
- Enable "Automatically expose System Environment Variables"

### Docker

```bash
# Build image
docker build -t kinetic-ledger-web .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_CHAIN_ID=421614 \
  -e NEXT_PUBLIC_ATTESTED_MOTION_ADDRESS=0x... \
  kinetic-ledger-web
```

## Troubleshooting

### "WalletConnect Project ID not found"

Get a free project ID from https://cloud.walletconnect.com/ and add to `.env.local`:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=abc123...
```

### "Contract call reverted"

Check that:
1. Contracts are deployed to Arc testnet
2. Wallet has USDC balance (get from https://faucet.circle.com/)
3. Contract addresses in `.env.local` are correct
4. Agent service is authorized on NoveltyDetector

### "Network not supported"

Ensure wallet is connected to Arc testnet (Chain ID: 421614). Add network manually:
- **Network Name**: Arc Testnet
- **RPC URL**: https://rpc.arc-testnet.circle.com
- **Chain ID**: 421614
- **Currency Symbol**: USDC
- **Block Explorer**: https://explorer.arc-testnet.circle.com

## Related Documentation

- [Arc Documentation](https://docs.circle.com/arc)
- [RainbowKit Docs](https://www.rainbowkit.com/)
- [wagmi Documentation](https://wagmi.sh/)
- [Next.js 15 Docs](https://nextjs.org/docs)

## License

MIT - See [LICENSE](../../LICENSE)
