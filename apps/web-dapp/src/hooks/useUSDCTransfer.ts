/**
 * React Hook for USDC Transfers on Arc
 * Uses wagmi/viem for Web3 interactions
 */

'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, type Address } from 'viem';
import { CONTRACT_ADDRESSES } from '@/config/wagmi';

const USDC_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const USDC_DECIMALS = 6;

export interface TransferResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export function useUSDCTransfer() {
  const { address } = useAccount();
  const [isTransferring, setIsTransferring] = useState(false);

  // Get USDC balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Write contract hook
  const { writeContractAsync, data: txHash } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  /**
   * Send USDC to a recipient
   */
  const sendUSDC = async (
    to: Address,
    amount: string // Amount in USDC (e.g., "10.5")
  ): Promise<TransferResult> => {
    try {
      setIsTransferring(true);

      // Validate inputs
      if (!address) {
        throw new Error('Wallet not connected');
      }

      if (!to || to === '0x0000000000000000000000000000000000000000') {
        throw new Error('Invalid recipient address');
      }

      const amountBigInt = parseUnits(amount, USDC_DECIMALS);

      // Check balance
      if (balance && amountBigInt > balance) {
        throw new Error(
          `Insufficient balance. Have ${formatUnits(balance, USDC_DECIMALS)} USDC, need ${amount} USDC`
        );
      }

      // Send transaction
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.usdc,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [to, amountBigInt],
      });

      console.warn(`USDC transfer submitted: ${hash}`);
      console.warn(`View on Arc Explorer: https://explorer.arc-testnet.circle.com/tx/${hash}`);

      // Refetch balance after transfer
      await refetchBalance();

      setIsTransferring(false);

      return {
        success: true,
        txHash: hash,
      };
    } catch (error) {
      setIsTransferring(false);
      const errorMessage = error instanceof Error ? error.message : 'Transfer failed';
      console.error('USDC transfer error:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  /**
   * Approve USDC spending for a contract
   */
  const approveUSDC = async (
    spender: Address,
    amount: string
  ): Promise<TransferResult> => {
    try {
      setIsTransferring(true);

      if (!address) {
        throw new Error('Wallet not connected');
      }

      const amountBigInt = parseUnits(amount, USDC_DECIMALS);

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.usdc,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [spender, amountBigInt],
      });

      console.warn(`USDC approval submitted: ${hash}`);

      setIsTransferring(false);

      return {
        success: true,
        txHash: hash,
      };
    } catch (error) {
      setIsTransferring(false);
      const errorMessage = error instanceof Error ? error.message : 'Approval failed';
      console.error('USDC approval error:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  return {
    sendUSDC,
    approveUSDC,
    balance: balance ? formatUnits(balance, USDC_DECIMALS) : '0',
    balanceRaw: balance,
    isTransferring,
    isConfirming,
    isConfirmed,
    refetchBalance,
  };
}
