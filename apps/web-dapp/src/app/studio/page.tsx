'use client';

import React, { useState } from 'react';
import KineticLogo from '../../components/KineticLogo';
import MotionPreviewPanel from '../../components/MotionPreviewPanel';
import BlendConfigurationModule from '../../components/BlendConfigurationModule';
import ValidationAttestationView from '../../components/ValidationAttestationView';
import TokenMintingInterface from '../../components/TokenMintingInterface';
import WalletPaymentPanel from '../../components/WalletPaymentPanel';

// Sample data
const SAMPLE_SEGMENTS = [
  {
    id: 'seg1',
    type: 'Capoeira',
    color: '#f59e0b',
    duration: 5,
    keyframes: ['K1', 'K2', 'K3', 'K4'],
    startTime: 0,
  },
  {
    id: 'seg2',
    type: 'Breakdance',
    color: '#ef4444',
    duration: 6,
    keyframes: ['K1', 'K2', 'K3', 'K4', 'K5'],
    startTime: 5,
  },
  {
    id: 'seg3',
    type: 'Salsa',
    color: '#ec4899',
    duration: 4,
    keyframes: ['K1', 'K2', 'K3'],
    startTime: 11,
  },
];

const SAMPLE_TRANSITIONS = [
  {
    fromSegment: 'seg1',
    toSegment: 'seg2',
    startTime: 4.5,
    duration: 1,
    type: 'cross-fade' as const,
  },
  {
    fromSegment: 'seg2',
    toSegment: 'seg3',
    startTime: 10.5,
    duration: 1,
    type: 'morph' as const,
  },
];

export default function MotionStudioPage() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState('150.00');
  const [currentStep, setCurrentStep] = useState<'configure' | 'validate' | 'mint'>('configure');
  
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [transactions] = useState([
    {
      id: '1',
      type: 'mint' as const,
      description: 'Minted Motion NFT',
      amount: '−7',
      timestamp: new Date(Date.now() - 3600000),
      status: 'completed' as const,
    },
    {
      id: '2',
      type: 'reward' as const,
      description: 'Reward: Training Completion',
      amount: '+5',
      timestamp: new Date(Date.now() - 7200000),
      status: 'completed' as const,
    },
  ]);

  const handleConnect = () => {
    // Simulate wallet connection
    setWalletConnected(true);
    setWalletAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C');
  };

  const handleDisconnect = () => {
    setWalletConnected(false);
    setWalletAddress('');
  };

  const handleValidate = async () => {
    setIsValidating(true);
    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setValidationResult({
      aiQuality: 'passed',
      aiMessage: 'Motion blending is smooth and falls within allowed parameters. Quality score: 95/100.',
      compliance: 'passed',
      complianceMessage: 'Motion content is appropriate and authorized. No policy violations detected.',
      attestation: {
        oracle: 'Kinetic AI Agent',
        signature: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        timestamp: Date.now(),
        standard: 'ERC-8001',
      },
    });
    setIsValidating(false);
  };

  const handleMint = async (options: any) => {
    // Simulate minting
    await new Promise(resolve => setTimeout(resolve, 3000));
    const newBalance = (parseFloat(balance) - 7).toFixed(2);
    setBalance(newBalance);
  };

  const metadata = {
    name: 'Capoeira-Breakdance-Salsa Blend',
    description: 'A seamless fusion of three dance styles with AI-verified authenticity',
    motionFileUri: 'ipfs://QmX...abc123',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-teal-50 relative overflow-hidden">
      {/* Polkadot-inspired background pattern */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      {/* Wallet Panel */}
      <WalletPaymentPanel
        isConnected={walletConnected}
        walletAddress={walletAddress}
        balance={balance}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        transactions={transactions}
      />

      {/* Header */}
      <header className="relative z-10 p-6 border-b border-blue-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <KineticLogo size="md" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                  Kinetic Ledger
                </h1>
                <p className="text-sm text-gray-600">Motion Tokenization Studio</p>
              </div>
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center space-x-2">
            {['configure', 'validate', 'mint'].map((step, idx) => (
              <div key={step} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step as any)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    currentStep === step
                      ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow-lg'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </button>
                {idx < 2 && (
                  <div className="w-8 h-0.5 bg-gray-300 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto p-6 space-y-6">
        {/* Motion Preview (Always visible) */}
        <MotionPreviewPanel
          segments={SAMPLE_SEGMENTS}
          transitions={SAMPLE_TRANSITIONS}
          totalDuration={15}
        />

        {/* Conditional Content Based on Step */}
        {currentStep === 'configure' && (
          <div className="space-y-6">
            <BlendConfigurationModule />
            <div className="text-center">
              <button
                onClick={() => setCurrentStep('validate')}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
              >
                Proceed to Validation →
              </button>
            </div>
          </div>
        )}

        {currentStep === 'validate' && (
          <div className="space-y-6">
            <ValidationAttestationView
              result={validationResult}
              onValidate={handleValidate}
              isValidating={isValidating}
            />
            {validationResult?.attestation && (
              <div className="text-center">
                <button
                  onClick={() => setCurrentStep('mint')}
                  className="px-8 py-3 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
                >
                  Proceed to Minting →
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'mint' && (
          <TokenMintingInterface
            metadata={metadata}
            onMint={handleMint}
            isEnabled={!!validationResult?.attestation}
            estimatedFee="7.00"
          />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-12 p-6 border-t border-blue-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-600">
          <p>Built on Arc • USDC-native gas • Sub-second finality</p>
          <p className="mt-1">Powered by Circle | Arc x USDC Hackathon 2025</p>
        </div>
      </footer>
    </div>
  );
}
