'use client';

import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACT_ADDRESSES } from '@/config/wagmi';

const USDC_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function USDCBalance() {
  const { address } = useAccount();

  const { data: balance, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            USDC Balance
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <span className="text-gray-400">Loading...</span>
            ) : balance !== undefined ? (
              `${formatUnits(balance, 6)} USDC`
            ) : (
              '0.00 USDC'
            )}
          </p>
        </div>
        <div className="w-16 h-16 bg-gradient-to-br from-arc-blue to-arc-purple rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        Arc uses USDC as the native gas token
      </p>
    </div>
  );
}
