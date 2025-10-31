import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Shield, FileCheck, ExternalLink, Info } from 'lucide-react';

interface ValidationResult {
  aiQuality: 'passed' | 'warning' | 'failed';
  aiMessage: string;
  compliance: 'passed' | 'warning' | 'failed';
  complianceMessage: string;
  attestation?: {
    oracle: string;
    signature: string;
    timestamp: number;
    standard: string;
  };
}

interface ValidationProps {
  result: ValidationResult | null;
  onValidate: () => void;
  isValidating: boolean;
}

export default function ValidationAttestationView({ result, onValidate, isValidating }: ValidationProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusIcon = (status: 'passed' | 'warning' | 'failed') => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
    }
  };

  const getStatusColor = (status: 'passed' | 'warning' | 'failed') => {
    switch (status) {
      case 'passed':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'failed':
        return 'bg-red-50 border-red-200 text-red-700';
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-blue-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Validation & Attestation</h2>
            <p className="text-sm text-gray-500">AI quality check and oracle verification</p>
          </div>
        </div>
        
        {result?.attestation && (
          <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-50 to-teal-50 rounded-full border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">Attested ✅ {result.attestation.standard}</span>
          </div>
        )}
      </div>

      {!result ? (
        /* No validation yet */
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <FileCheck className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Ready to Validate</h3>
          <p className="text-sm text-gray-600 mb-6">Run AI quality checks and compliance validation</p>
          <button
            onClick={onValidate}
            disabled={isValidating}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? (
              <span className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Validating...</span>
              </span>
            ) : (
              'Validate Motion'
            )}
          </button>
        </div>
      ) : (
        /* Validation results */
        <div className="space-y-4">
          {/* AI Quality Check */}
          <div className={`p-4 rounded-xl border-2 ${getStatusColor(result.aiQuality)}`}>
            <div className="flex items-start space-x-3">
              {getStatusIcon(result.aiQuality)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">AI Quality Check</h4>
                  <span className="text-xs font-mono px-2 py-1 bg-white/50 rounded">
                    {result.aiQuality.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm mt-1">{result.aiMessage}</p>
              </div>
            </div>
          </div>

          {/* Compliance Check */}
          <div className={`p-4 rounded-xl border-2 ${getStatusColor(result.compliance)}`}>
            <div className="flex items-start space-x-3">
              <Shield className={`w-6 h-6 ${
                result.compliance === 'passed' ? 'text-green-500' :
                result.compliance === 'warning' ? 'text-yellow-500' : 'text-red-500'
              }`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">Compliance Verification</h4>
                  <span className="text-xs font-mono px-2 py-1 bg-white/50 rounded">
                    {result.compliance.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm mt-1">{result.complianceMessage}</p>
              </div>
            </div>
          </div>

          {/* Oracle Attestation Badge */}
          {result.attestation && (
            <div className="p-6 bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 rounded-2xl border-2 border-blue-200 relative overflow-hidden">
              {/* Polkadot-style dot pattern */}
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'radial-gradient(circle, #3b82f6 1.5px, transparent 1.5px)',
                backgroundSize: '25px 25px'
              }} />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {/* Attestation badge - circular like Polkadot */}
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      </div>
                      {/* Pulsing ring animation */}
                      <div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-ping opacity-30" />
                    </div>
                    
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">Oracle Attestation</h4>
                      <p className="text-sm text-gray-600">Cryptographically verified on-chain</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Info className="w-4 h-4" />
                    <span>{showDetails ? 'Hide' : 'View'} Details</span>
                  </button>
                </div>

                {showDetails && (
                  <div className="space-y-3 p-4 bg-white/60 rounded-xl border border-blue-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Attesting Oracle</div>
                        <div className="font-mono text-sm text-gray-900">{result.attestation.oracle}</div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Standard</div>
                        <div className="font-mono text-sm text-gray-900">{result.attestation.standard}</div>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="text-xs text-gray-600 mb-1">Signature (EIP-712)</div>
                        <div className="font-mono text-xs text-gray-900 bg-gray-100 p-2 rounded break-all">
                          {result.attestation.signature}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Timestamp</div>
                        <div className="text-sm text-gray-900">
                          {new Date(result.attestation.timestamp).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="flex items-end">
                        <button className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                          <ExternalLink className="w-4 h-4" />
                          <span>View on Arc Explorer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Revalidate button */}
          <div className="text-center pt-4">
            <button
              onClick={onValidate}
              disabled={isValidating}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium underline"
            >
              Run Validation Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
