'use client';

import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/wagmi';

const ATTESTED_MOTION_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function NFTGallery() {
  const { address } = useAccount();

  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.attestedMotion,
    abi: ATTESTED_MOTION_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const nftCount = balance ? Number(balance) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Your Motion NFTs
      </h2>

      {nftCount === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            No NFTs yet. Submit your first motion attestation above!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: nftCount }).map((_, index) => (
            <NFTCard key={index} owner={address!} index={BigInt(index)} />
          ))}
        </div>
      )}
    </div>
  );
}

function NFTCard({ owner, index }: { owner: `0x${string}`; index: bigint }) {
  const { data: tokenId } = useReadContract({
    address: CONTRACT_ADDRESSES.attestedMotion,
    abi: ATTESTED_MOTION_ABI,
    functionName: 'tokenOfOwnerByIndex',
    args: [owner, index],
  });

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-gradient-to-br from-arc-blue/20 to-arc-purple/20 rounded-lg mb-4 flex items-center justify-center">
        <svg
          className="w-16 h-16 text-arc-purple"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Motion #{tokenId?.toString() || '...'}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Verified by RkCNN novelty detection
        </p>
        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
            Novel
          </span>
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
            Attested
          </span>
        </div>
      </div>
    </div>
  );
}
