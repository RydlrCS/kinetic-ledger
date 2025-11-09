/**
 * Motion Blending Studio Component
 *
 * Main UI for motion blending operations with:
 * - Motion file selection and configuration
 * - Real-time blend preview
 * - Quality metrics display
 * - USDC payment integration for NFT minting
 *
 * Architecture:
 * - Controlled component with React hooks
 * - Structured logging via console (frontend equivalent)
 * - wagmi integration for wallet interactions
 * - Proper error handling and loading states
 *
 * Author: Kinetic Ledger Team
 * License: MIT
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useUSDCTransfer } from '@/hooks/useUSDCTransfer';
import MotionPreview from './MotionPreview';
import QualityMetricsDisplay from './QualityMetricsDisplay';

/**
 * Configuration for blend operation
 */
interface BlendConfig {
  source1: string;
  source2: string;
  blendWeight: number;
  transitionFrames: number;
}

/**
 * Blend result from API
 */
interface BlendResult {
  embedding_hash: string;
  blended_bvh_path: string;
  quality_score: number;
  velocity_continuity: number;
  acceleration_smoothness: number;
  foot_contact_stability: number;
}

/**
 * Motion Blending Studio Component
 *
 * Provides complete UI for:
 * 1. Selecting source motions
 * 2. Configuring blend parameters
 * 3. Initiating blend operation
 * 4. Viewing quality metrics
 * 5. Minting as NFT with USDC payment
 *
 * @returns JSX component
 */
export default function MotionBlendingStudio() {
  // Component logging utility
  const log = (message: string, data?: Record<string, unknown>) => {
    console.warn(
      `🚀 MotionBlendingStudio: ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  };

  log('ENTRY: MotionBlendingStudio render');

  // State management
  const [config, setConfig] = useState<BlendConfig>({
    source1: '',
    source2: '',
    blendWeight: 0.5,
    transitionFrames: 10,
  });

  const [blendStatus, setBlendStatus] = useState<
    'idle' | 'blending' | 'success' | 'error'
  >('idle');
  const [blendResult, setBlendResult] = useState<BlendResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [mintingStatus, setMintingStatus] = useState<
    'idle' | 'registering' | 'paying' | 'success' | 'error'
  >('idle');

  // USDC transfer hook
  const { sendUSDC, balance, isTransferring } = useUSDCTransfer();

  /**
   * Handle blend configuration changes
   */
  const handleConfigChange = useCallback(
    (field: keyof BlendConfig, value: unknown) => {
      log('Config changed', { field, value });
      setConfig((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  /**
   * Initiate blend operation
   *
   * Flow:
   * 1. Validate inputs
   * 2. Call motion-blend-service API
   * 3. Update UI with results
   * 4. Display quality metrics
   */
  const handleBlend = useCallback(async () => {
    log('🚀 ENTRY: handleBlend', config as unknown as Record<string, unknown>);

    // Validation
    if (!config.source1 || !config.source2) {
      setErrorMessage('Please select both source motions');
      log('❌ Validation failed: missing source motions');
      return;
    }

    if (config.transitionFrames < 5 || config.transitionFrames > 50) {
      setErrorMessage('Transition frames must be between 5 and 50');
      log('❌ Validation failed: invalid transition frames');
      return;
    }

    setBlendStatus('blending');
    setErrorMessage('');

    try {
      log('Calling blend API', { endpoint: '/api/motion-blend/blend' });

      // Call blend service
      const response = await fetch('/api/motion-blend/blend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_files: [config.source1, config.source2],
          blend_weights: [config.blendWeight, 1 - config.blendWeight],
          transition_frame: config.transitionFrames,
          output_dir: './output',
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();
      log('✅ Blend completed', result);

      setBlendResult(result);
      setBlendStatus('success');
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      log('❌ EXIT: handleBlend failed', { error: errorMsg });
      setErrorMessage(errorMsg);
      setBlendStatus('error');
    }
  }, [config]);

  /**
   * Mint blended motion as NFT
   *
   * Flow:
   * 1. Register blend on-chain (BlendedMotionRegistry)
   * 2. Send USDC payment for minting fee
   * 3. Create NFT token with blend metadata
   */
  const handleMint = useCallback(async () => {
    log('🚀 ENTRY: handleMint');

    if (!blendResult) {
      setErrorMessage('No blend result available');
      return;
    }

    setMintingStatus('registering');

    try {
      log('Registering blend on-chain', {
        embedding_hash: blendResult.embedding_hash,
        quality_score: blendResult.quality_score,
      });

      // Register blend on-chain
      const registerResponse = await fetch('/api/motion-blend/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedding_hash: blendResult.embedding_hash,
          quality_score: blendResult.quality_score,
          metadata: blendResult,
        }),
      });

      if (!registerResponse.ok) {
        throw new Error(`Registration failed: ${registerResponse.status}`);
      }

      const registerResult = await registerResponse.json();
      log('✅ Blend registered on-chain', registerResult);

      // Send USDC payment for minting
      setMintingStatus('paying');
      log('Sending 7 USDC payment for NFT minting');

      const txResult = await sendUSDC(
        registerResult.registry_address,
        '7.0' // 7 USDC minting fee
      );

      log('✅ USDC payment successful', txResult as unknown as Record<string, unknown>);
      setMintingStatus('success');
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      log('❌ EXIT: handleMint failed', { error: errorMsg });
      setErrorMessage(errorMsg);
      setMintingStatus('error');
    }
  }, [blendResult, sendUSDC]);

  log('✅ EXIT: MotionBlendingStudio render');

  return (
    <div className="motion-blending-studio">
      <div className="studio-header">
        <h1>🎬 Motion Blending Studio</h1>
        <p className="subtitle">
          Blend motion sequences with AI and mint as NFTs on Arc
        </p>
      </div>

      {/* Blend Configuration Panel */}
      <div className="blend-config-panel">
        <h2>⚙️ Blend Configuration</h2>

        <div className="config-form">
          {/* Source Motion 1 */}
          <div className="form-group">
            <label htmlFor="source1">
              Source Motion 1
              <span className="required">*</span>
            </label>
            <input
              id="source1"
              type="text"
              value={config.source1}
              onChange={(e) => handleConfigChange('source1', e.target.value)}
              placeholder="path/to/motion1.bvh"
              className="input-field"
            />
            <small>BVH file path for first motion sequence</small>
          </div>

          {/* Source Motion 2 */}
          <div className="form-group">
            <label htmlFor="source2">
              Source Motion 2
              <span className="required">*</span>
            </label>
            <input
              id="source2"
              type="text"
              value={config.source2}
              onChange={(e) => handleConfigChange('source2', e.target.value)}
              placeholder="path/to/motion2.bvh"
              className="input-field"
            />
            <small>BVH file path for second motion sequence</small>
          </div>

          {/* Blend Weight Slider */}
          <div className="form-group">
            <label htmlFor="weight">
              Blend Weight (Source 1)
              <span className="weight-label">
                {(config.blendWeight * 100).toFixed(0)}%
              </span>
            </label>
            <input
              id="weight"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.blendWeight}
              onChange={(e) =>
                handleConfigChange('blendWeight', parseFloat(e.target.value))
              }
              className="slider"
            />
            <div className="weight-labels">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Transition Frames */}
          <div className="form-group">
            <label htmlFor="transition">
              Transition Frames ({config.transitionFrames})
            </label>
            <input
              id="transition"
              type="range"
              min="5"
              max="50"
              step="1"
              value={config.transitionFrames}
              onChange={(e) =>
                handleConfigChange('transitionFrames', parseInt(e.target.value))
              }
              className="slider"
            />
            <small>Number of frames for smooth transition (5-50)</small>
          </div>

          {/* Blend Button */}
          <button
            onClick={handleBlend}
            disabled={blendStatus === 'blending'}
            className="btn btn-primary"
          >
            {blendStatus === 'blending' ? (
              <>
                <span className="spinner">⏳</span> Blending...
              </>
            ) : (
              <>
                <span>🚀</span> Start Blending
              </>
            )}
          </button>
        </div>
      </div>

      {/* Motion Preview */}
      {blendResult && (
        <div className="preview-panel">
          <h2>👁️ Motion Preview</h2>
          <MotionPreview bvhPath={blendResult.blended_bvh_path} autoPlay />
        </div>
      )}

      {/* Quality Metrics Display */}
      {blendResult && (
        <div className="metrics-panel">
          <h2>📊 Blend Quality Metrics</h2>
          <QualityMetricsDisplay
            metrics={{
              velocity_continuity: blendResult.velocity_continuity,
              acceleration_smoothness: blendResult.acceleration_smoothness,
              foot_contact_stability: blendResult.foot_contact_stability,
              overall_score: blendResult.quality_score,
            }}
          />
        </div>
      )}

      {/* Minting Panel */}
      {blendResult && blendStatus === 'success' && (
        <div className="minting-panel">
          <h2>🎁 Mint as NFT</h2>

          <div className="blend-metadata">
            <div className="metadata-item">
              <label>Embedding Hash</label>
              <code>{blendResult.embedding_hash.slice(0, 32)}...</code>
            </div>

            <div className="metadata-item">
              <label>Quality Score</label>
              <span className="quality-badge">
                {blendResult.quality_score.toFixed(1)}/100
              </span>
            </div>

            <div className="metadata-item">
              <label>Your USDC Balance</label>
              <span className="balance">
                {balance ? `${balance} USDC` : 'Loading...'}
              </span>
            </div>

            <div className="metadata-item">
              <label>Minting Fee</label>
              <span className="fee">7.0 USDC</span>
            </div>
          </div>

          <button
            onClick={handleMint}
            disabled={isTransferring || mintingStatus !== 'idle'}
            className="btn btn-success"
          >
            {mintingStatus === 'registering' && (
              <>
                <span>📝</span> Registering on-chain...
              </>
            )}
            {mintingStatus === 'paying' && (
              <>
                <span>💸</span> Sending USDC payment...
              </>
            )}
            {mintingStatus === 'success' && (
              <>
                <span>✅</span> Minted successfully!
              </>
            )}
            {mintingStatus === 'idle' && (
              <>
                <span>🎁</span> Mint NFT (7 USDC)
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="error-message">
          <span>❌</span>
          <p>{errorMessage}</p>
          <button
            onClick={() => setErrorMessage('')}
            className="btn-close"
          >
            ✕
          </button>
        </div>
      )}

      {/* Styles */}
      <style jsx>{`
        .motion-blending-studio {
          max-width: 1200px;
          margin: 2rem auto;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            sans-serif;
        }

        .studio-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .studio-header h1 {
          font-size: 2.5rem;
          margin: 0 0 0.5rem;
          background: linear-gradient(135deg, #3498db 0%, #9b59b6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          color: #666;
          font-size: 1rem;
          margin: 0;
        }

        .blend-config-panel,
        .preview-panel,
        .metrics-panel,
        .minting-panel {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .blend-config-panel h2,
        .preview-panel h2,
        .metrics-panel h2,
        .minting-panel h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          color: #333;
        }

        .config-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .required {
          color: #e74c3c;
          margin-left: 0.25rem;
        }

        .weight-label {
          font-weight: 700;
          color: #3498db;
          font-size: 1.1rem;
        }

        .input-field,
        .slider {
          padding: 0.75rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 1rem;
          font-family: monospace;
        }

        .input-field {
          background: white;
        }

        .input-field:focus {
          outline: none;
          border-color: #3498db;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }

        .slider {
          height: 6px;
          appearance: none;
          background: #ddd;
          outline: none;
          border: none;
          padding: 0;
        }

        .weight-labels,
        .slider + .weight-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: #999;
        }

        small {
          color: #999;
          font-size: 0.85rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
        }

        .btn-success {
          background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
        }

        .spinner {
          display: inline-block;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .blend-metadata {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .metadata-item {
          background: white;
          padding: 1rem;
          border-radius: 4px;
          border-left: 4px solid #3498db;
        }

        .metadata-item label {
          display: block;
          font-weight: 600;
          color: #666;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .metadata-item code {
          display: block;
          background: #f5f5f5;
          padding: 0.5rem;
          border-radius: 2px;
          font-size: 0.85rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .quality-badge {
          display: inline-block;
          background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .balance {
          font-weight: 700;
          color: #3498db;
          font-size: 1.1rem;
        }

        .fee {
          font-weight: 700;
          color: #e74c3c;
          font-size: 1.1rem;
        }

        .error-message {
          background: #fadbd8;
          border: 1px solid #e74c3c;
          border-radius: 4px;
          padding: 1rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          color: #c0392b;
        }

        .error-message p {
          margin: 0;
          flex: 1;
        }

        .btn-close {
          background: none;
          border: none;
          color: #c0392b;
          cursor: pointer;
          font-size: 1.5rem;
          padding: 0;
          line-height: 1;
        }

        @media (max-width: 768px) {
          .motion-blending-studio {
            padding: 1rem;
          }

          .studio-header h1 {
            font-size: 1.75rem;
          }

          .config-form {
            gap: 1rem;
          }

          .blend-metadata {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
