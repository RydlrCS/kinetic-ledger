'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/wagmi';

const ORCHESTRATOR_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'embedding', type: 'uint256[]' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
      {
        name: 'complianceMetadata',
        type: 'tuple',
        components: [
          { name: 'jurisdiction', type: 'string' },
          { name: 'vaspLicense', type: 'string' },
          { name: 'userConsent', type: 'string' },
        ],
      },
    ],
    name: 'verifyAndMint',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export function MotionAttestation() {
  const { address } = useAccount();
  const [activityType, setActivityType] = useState('running');
  const [isGenerating, setIsGenerating] = useState(false);

  const { writeContract, data: hash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setIsGenerating(true);

    try {
      // Generate mock embedding (128 dimensions)
      const embedding = Array(128)
        .fill(0)
        .map(() => BigInt(Math.floor(Math.random() * 1000000)));

      // In production, this would call the API gateway to get a signed attestation
      // For demo purposes, we're using mock data
      const nonce = BigInt(Date.now());
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

      // Mock signature (in production, comes from agent service)
      const signature = '0x' + '0'.repeat(130);

      const complianceMetadata = {
        jurisdiction: 'KE',
        vaspLicense: 'KE-VASP-2025-001',
        userConsent: 'motion_data_processing_v1',
      };

      writeContract({
        address: CONTRACT_ADDRESSES.orchestrator,
        abi: ORCHESTRATOR_ABI,
        functionName: 'verifyAndMint',
        args: [address, embedding, nonce, expiry, signature as `0x${string}`, complianceMetadata],
      });
    } catch (error) {
      console.error('Error submitting attestation:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Submit Motion Attestation
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Activity Type
          </label>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-arc-blue focus:border-transparent"
          >
            <option value="running">Running</option>
            <option value="walking">Walking</option>
            <option value="cycling">Cycling</option>
            <option value="swimming">Swimming</option>
            <option value="custom">Custom Motion</option>
          </select>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Note:</strong> This demo uses mock motion data. In production, connect your fitness tracker or motion capture device.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending || isConfirming || isGenerating}
          className="w-full bg-gradient-to-r from-arc-blue to-arc-purple text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating
            ? 'Generating Embedding...'
            : isPending
            ? 'Confirming...'
            : isConfirming
            ? 'Processing...'
            : 'Submit Attestation'}
        </button>

        {isSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-800 dark:text-green-300">
              ✅ Motion NFT minted successfully! Check your NFT gallery below.
            </p>
            {hash && (
              <a
                href={`https://explorer.arc-testnet.circle.com/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-arc-blue hover:underline mt-2 block"
              >
                View transaction →
              </a>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
