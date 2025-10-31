/**
 * Kinetic Ledger Shared Schemas
 * 
 * Centralized type definitions for:
 * - EIP-712 structured data signing
 * - Motion data models
 * - API contracts
 * 
 * @packageDocumentation
 */

// EIP-712 types
export * from './eip712';

// Motion data structures
export * from './motion';

// API contracts
export * from './api';

// Constants
export const CONTRACTS = {
  ARC_TESTNET: {
    CHAIN_ID: 421614,
    RPC_URL: 'https://rpc.arc-testnet.circle.com',
    EXPLORER: 'https://explorer.arc-testnet.circle.com',
  },
  ARC_MAINNET: {
    CHAIN_ID: 42161, // Placeholder
    RPC_URL: 'https://rpc.arc.circle.com', // Placeholder
    EXPLORER: 'https://explorer.arc.circle.com', // Placeholder
  },
} as const;

export const USDC_DECIMALS = 6;

export const DEFAULT_ATTESTATION_EXPIRY_SECONDS = 300; // 5 minutes
