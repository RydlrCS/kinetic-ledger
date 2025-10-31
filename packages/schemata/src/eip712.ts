/**
 * EIP-712 Type Definitions for Kinetic Ledger
 * 
 * Structured typed data signing for:
 * - Motion attestations (validator → contract)
 * - Payment authorizations (user → agent)
 * - Off-chain data verification
 */

import type { TypedDataDomain, TypedDataParameter } from 'viem';

/**
 * EIP-712 Domain for AttestedMotion contract
 */
export interface AttestedMotionDomain extends TypedDataDomain {
  name: 'AttestedMotion';
  version: '1';
  chainId: number; // 421614 for Arc testnet
  verifyingContract: `0x${string}`;
}

/**
 * Mint attestation message structure
 * Matches Solidity: Mint(address to,bytes32 dataHash,uint256 nonce,uint256 expiry)
 */
export interface MintMessage {
  to: `0x${string}`;
  dataHash: `0x${string}`; // keccak256 of raw motion data
  nonce: bigint;
  expiry: bigint; // Unix timestamp
}

/**
 * EIP-712 types for mint attestation
 */
export const MINT_TYPES = {
  Mint: [
    { name: 'to', type: 'address' },
    { name: 'dataHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ] as const satisfies readonly TypedDataParameter[],
} as const;

/**
 * Complete EIP-712 typed data for mint signature
 */
export interface MintTypedData {
  domain: AttestedMotionDomain;
  types: typeof MINT_TYPES;
  primaryType: 'Mint';
  message: MintMessage;
}

/**
 * Payment authorization domain (future use for agent-initiated payments)
 */
export interface PaymentAuthDomain extends TypedDataDomain {
  name: 'KineticLedgerPayments';
  version: '1';
  chainId: number;
  verifyingContract: `0x${string}`;
}

/**
 * Payment authorization message
 */
export interface PaymentMessage {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: bigint; // USDC amount (6 decimals)
  attestationId: `0x${string}`;
  nonce: bigint;
  deadline: bigint;
}

/**
 * EIP-712 types for payment authorization
 */
export const PAYMENT_TYPES = {
  Payment: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'attestationId', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ] as const satisfies readonly TypedDataParameter[],
} as const;

/**
 * Helper to create domain separator
 */
export function createDomain(
  name: string,
  version: string,
  chainId: number,
  verifyingContract: `0x${string}`
): TypedDataDomain {
  return {
    name,
    version,
    chainId,
    verifyingContract,
  };
}

/**
 * Arc testnet chain ID
 */
export const ARC_TESTNET_CHAIN_ID = 421614;

/**
 * Arc mainnet chain ID (when available)
 */
export const ARC_MAINNET_CHAIN_ID = 42161; // Placeholder - update when Arc mainnet launches
