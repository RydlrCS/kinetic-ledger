import React, { useState } from 'react';
import { Coins, CheckCircle2, Loader2, ExternalLink, Info } from 'lucide-react';

interface TokenMetadata {
  name: string;
  description: string;
  motionFileUri: string;
}

interface MintOptions {
  standard: 'ERC-721' | 'ERC-1155';
  quantity: number;
  includeAttestation: boolean;
}

interface TokenMintingProps {
  metadata: TokenMetadata;
  onMint: (options: MintOptions) => Promise<void>;
  isEnabled: boolean;
  estimatedFee: string;
}

export default function TokenMintingInterface({ metadata, onMint, isEnabled, estimatedFee }: TokenMintingProps) {
  const [options, setOptions] = useState<MintOptions>({
    standard: 'ERC-721',
    quantity: 1,
    includeAttestation: true,
  });
  
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<{
    tokenId: string;
    txHash: string;
  } | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleMint = async () => {
    setIsMinting(true);
    try {
      await onMint(options);
      // Simulate successful mint
      setMintResult({
        tokenId: `#${Math.floor(Math.random() * 10000)}`,
        txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      });
      setShowConfirmation(false);
    } catch (error) {
      console.error('Minting failed:', error);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-blue-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-600 flex items-center justify-center">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Token Minting</h2>
            <p className="text-sm text-gray-500">Create motion NFT on Arc blockchain</p>
          </div>
        </div>
      </div>

      {!mintResult ? (
        <div className="space-y-6">
          {/* Metadata Preview */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Token Metadata</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <span className="ml-2 font-medium text-gray-900">{metadata.name}</span>
              </div>
              <div>
                <span className="text-gray-600">Description:</span>
                <span className="ml-2 text-gray-900">{metadata.description}</span>
              </div>
              <div>
                <span className="text-gray-600">Motion File:</span>
                <span className="ml-2 font-mono text-xs text-blue-600">{metadata.motionFileUri}</span>
              </div>
            </div>
          </div>

          {/* Token Standard Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Token Standard
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOptions({ ...options, standard: 'ERC-721', quantity: 1 })}
                className={`p-4 rounded-xl border-2 transition-all ${
                  options.standard === 'ERC-721'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">ERC-721</div>
                <div className="text-xs text-gray-600 mt-1">Unique NFT (1 of 1)</div>
              </button>
              
              <button
                onClick={() => setOptions({ ...options, standard: 'ERC-1155' })}
                className={`p-4 rounded-xl border-2 transition-all ${
                  options.standard === 'ERC-1155'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">ERC-1155</div>
                <div className="text-xs text-gray-600 mt-1">Multi-edition NFT</div>
              </button>
            </div>
          </div>

          {/* Quantity (for ERC-1155) */}
          {options.standard === 'ERC-1155' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={options.quantity}
                onChange={(e) => setOptions({ ...options, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Attestation Inclusion */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="includeAttestation"
                checked={options.includeAttestation}
                onChange={(e) => setOptions({ ...options, includeAttestation: e.target.checked })}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="includeAttestation" className="text-sm font-medium text-gray-900 cursor-pointer">
                  Include Attestation Signature (EIP-712)
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  Attach oracle's cryptographic attestation to verify motion validity on-chain
                </p>
              </div>
              <button className="text-blue-600 hover:text-blue-700">
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fee Display */}
          <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Mint Fee (USDC)</div>
                <div className="text-2xl font-bold text-gray-900">{estimatedFee}</div>
                <div className="text-xs text-gray-500 mt-1">Arc blockchain • Sub-second finality</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-600">Compared to Ethereum L1</div>
                <div className="text-lg font-bold text-green-600">99% cheaper</div>
              </div>
            </div>
          </div>

          {/* Mint Button */}
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!isEnabled || isMinting}
            className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isMinting ? (
              <span className="flex items-center justify-center space-x-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Minting on Arc...</span>
              </span>
            ) : (
              'Mint Motion Token'
            )}
          </button>

          {!isEnabled && (
            <p className="text-center text-sm text-red-600">
              Complete validation and attestation before minting
            </p>
          )}
        </div>
      ) : (
        /* Mint Success */
        <div className="text-center py-8">
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-blue-500 rounded-full animate-pulse opacity-50" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center shadow-2xl">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Motion NFT Minted!</h3>
          <p className="text-gray-600 mb-6">Your motion has been tokenized on Arc blockchain</p>
          
          <div className="max-w-md mx-auto space-y-3 mb-6">
            <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border border-green-200">
              <div className="text-xs text-gray-600 mb-1">Token ID</div>
              <div className="text-xl font-mono font-bold text-gray-900">{mintResult.tokenId}</div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Transaction Hash</div>
              <div className="font-mono text-xs text-gray-900 break-all">{mintResult.txHash}</div>
            </div>
          </div>
          
          <div className="flex justify-center space-x-3">
            <button className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow-lg transition-all duration-200">
              <ExternalLink className="w-4 h-4" />
              <span>View on Arc Explorer</span>
            </button>
            
            <button 
              onClick={() => setMintResult(null)}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-all duration-200"
            >
              Mint Another
            </button>
          </div>

          {/* Celebratory animation */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-br from-blue-400 to-teal-400 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-10%',
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Minting</h3>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Standard:</span>
                <span className="font-medium">{options.standard}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Quantity:</span>
                <span className="font-medium">{options.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Attestation:</span>
                <span className="font-medium">{options.includeAttestation ? 'Included' : 'Not included'}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t">
                <span>Total Fee:</span>
                <span className="text-blue-600">{estimatedFee} USDC</span>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMint}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold rounded-full transition-all duration-200"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes float {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(150vh) rotate(360deg); opacity: 0; }
        }
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </div>
  );
}
