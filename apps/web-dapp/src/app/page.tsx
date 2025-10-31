'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { MotionAttestation } from '@/components/MotionAttestation';
import { USDCBalance } from '@/components/USDCBalance';
import { NFTGallery } from '@/components/NFTGallery';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <nav className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-arc-blue to-arc-purple rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">K</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Kinetic Ledger
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Powered by Arc Blockchain
                </p>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!isConnected ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-arc-blue to-arc-purple rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto">
              Connect your wallet to submit motion attestations and view your NFTs on Arc testnet.
            </p>
            <div className="inline-block">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* USDC Balance Card */}
            <USDCBalance />

            {/* Motion Attestation Form */}
            <MotionAttestation />

            {/* NFT Gallery */}
            <NFTGallery />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                About
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Kinetic Ledger uses RkCNN novelty detection to verify unique motion data on Arc blockchain with USDC-native gas.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Resources
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>
                  <a href="https://docs.circle.com/arc" target="_blank" rel="noopener noreferrer" className="hover:text-arc-blue">
                    Arc Documentation
                  </a>
                </li>
                <li>
                  <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="hover:text-arc-blue">
                    Testnet Faucet
                  </a>
                </li>
                <li>
                  <a href="https://github.com/RydlrCS/kinetic-ledger" target="_blank" rel="noopener noreferrer" className="hover:text-arc-blue">
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Built For
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Arc x USDC Hackathon (Oct 27 - Nov 9, 2025)
              </p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
