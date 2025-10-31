import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Arc Testnet chain configuration
export const arcTestnet = defineChain({
  id: 421614,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.arc-testnet.circle.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://explorer.arc-testnet.circle.com',
    },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Kinetic Ledger',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [arcTestnet],
  ssr: true,
});

// Contract addresses
export const CONTRACT_ADDRESSES = {
  attestedMotion: process.env.NEXT_PUBLIC_ATTESTED_MOTION_ADDRESS as `0x${string}`,
  noveltyDetector: process.env.NEXT_PUBLIC_NOVELTY_DETECTOR_ADDRESS as `0x${string}`,
  orchestrator: process.env.NEXT_PUBLIC_ORCHESTRATOR_ADDRESS as `0x${string}`,
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
};
