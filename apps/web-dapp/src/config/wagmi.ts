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

// Get WalletConnect Project ID with helpful error message
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId && process.env.NODE_ENV === 'production') {
  throw new Error(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required for production.\n' +
    'Get your Project ID at: https://cloud.walletconnect.com/'
  );
}

// Use a development placeholder if not set (for local development only)
const walletConnectProjectId = projectId || 'development-mode-placeholder';

if (!projectId && process.env.NODE_ENV !== 'production') {
  console.warn(
    '⚠️  Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID\n' +
    '   WalletConnect will not work until you:\n' +
    '   1. Get a Project ID from https://cloud.walletconnect.com/\n' +
    '   2. Add it to apps/web-dapp/.env.local\n' +
    '   3. Restart the dev server\n'
  );
}

export const config = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Kinetic Ledger',
  projectId: walletConnectProjectId,
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
