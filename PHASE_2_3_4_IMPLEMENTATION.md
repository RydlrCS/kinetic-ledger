# Motion Blending: Phases 2-4 Implementation Guide

**Date**: November 9, 2025  
**Deadline**: November 9, 2025 (2:30 AM EAT) - **⚠️ CRITICAL - SAME DAY**  
**Status**: Planning Phase 2-4 parallel execution

---

## 📋 Executive Summary

**Current State**: Phase 1 (Motion Blending Service) ✅ 100% Complete
- 3,033 lines of production code
- All quality standards met (logging, types, tests)
- 6 commits pushed to GitHub
- 46/46 Hardhat tests passing ✅

**Remaining Work**: Phases 2-4 (~6-8 hours estimated)
- Phase 2: Temporal Conditioning (~2 hours)
- Phase 3: Frontend Integration (~2-3 hours)
- Phase 4: Testing & Deployment (~2 hours)
- Hackathon Submission (~1 hour)

**Parallel Strategy**: Execute phases 2-4 in parallel to meet deadline

---

## 🎯 Phase 2: Temporal Conditioning (2 hours)

### Overview
Add advanced GANimator features to improve blend quality:
- Learned skeleton ID mapping for smooth transitions
- Multi-stage generator with residual connections
- Transition quality metrics (velocity, acceleration, foot contact)

### Task 2.1: Implement Skeleton ID Map Generation

**File**: `apps/motion-blend-service/src/skeleton_id_map.py` (NEW)

```python
import numpy as np
from typing import Dict, List, Tuple
import structlog

logger = structlog.get_logger()

class SkeletonIDMap:
    """Generate learned skeleton ID maps for smooth motion transitions."""
    
    def __init__(self, num_joints: int, embedding_dim: int = 256):
        """
        Initialize skeleton ID map generator.
        
        Args:
            num_joints: Number of joints in skeleton
            embedding_dim: Dimension of learned embeddings (default 256)
        """
        logger.info(
            "🚀 ENTRY: SkeletonIDMap.__init__",
            num_joints=num_joints,
            embedding_dim=embedding_dim
        )
        
        self.num_joints = num_joints
        self.embedding_dim = embedding_dim
        
        # Initialize learnable skeleton embeddings (would be trained in production)
        self.skeleton_embeddings = np.random.randn(num_joints, embedding_dim).astype(np.float32)
        
        # Temporal smoothing coefficients
        self.temporal_smoothing = self._create_temporal_kernel()
        
        logger.info("✅ EXIT: SkeletonIDMap.__init__", status="initialized")
    
    def _create_temporal_kernel(self, window_size: int = 5) -> np.ndarray:
        """Create Gaussian temporal smoothing kernel."""
        logger.info("🚀 ENTRY: _create_temporal_kernel", window_size=window_size)
        
        sigma = window_size / 3.0
        x = np.arange(window_size) - window_size // 2
        kernel = np.exp(-(x ** 2) / (2 * sigma ** 2))
        kernel = kernel / np.sum(kernel)
        
        logger.info("✅ EXIT: _create_temporal_kernel", kernel_shape=kernel.shape)
        return kernel
    
    def generate_map(
        self,
        source_embedding: np.ndarray,
        target_embedding: np.ndarray,
        transition_frames: int = 10
    ) -> np.ndarray:
        """
        Generate smooth skeleton ID map for transition between motions.
        
        Args:
            source_embedding: Source motion embedding [joints, embedding_dim]
            target_embedding: Target motion embedding [joints, embedding_dim]
            transition_frames: Number of frames for transition
            
        Returns:
            Skeleton ID map [transition_frames, joints, embedding_dim]
            
        Raises:
            ValueError: If embeddings have incorrect shape
        """
        logger.info(
            "🚀 ENTRY: generate_map",
            source_shape=source_embedding.shape,
            target_shape=target_embedding.shape,
            transition_frames=transition_frames
        )
        
        if source_embedding.shape[1] != self.embedding_dim:
            raise ValueError(f"Expected embedding_dim={self.embedding_dim}, got {source_embedding.shape[1]}")
        
        # Create linear interpolation schedule
        t = np.linspace(0, 1, transition_frames)[:, np.newaxis, np.newaxis]
        
        # Blend embeddings with smooth sigmoid transition
        sigmoid_blend = 1.0 / (1.0 + np.exp(-10 * (t - 0.5)))
        
        # Interpolate between source and target
        skeleton_map = (1 - sigmoid_blend) * source_embedding[np.newaxis, :, :] + \
                       sigmoid_blend * target_embedding[np.newaxis, :, :]
        
        # Apply temporal smoothing
        smoothed_map = np.zeros_like(skeleton_map)
        for frame_idx in range(transition_frames):
            window_start = max(0, frame_idx - len(self.temporal_smoothing) // 2)
            window_end = min(transition_frames, frame_idx + len(self.temporal_smoothing) // 2 + 1)
            
            weights = self.temporal_smoothing[len(self.temporal_smoothing)//2 - (frame_idx - window_start):
                                              len(self.temporal_smoothing)//2 + (window_end - frame_idx)]
            
            smoothed_map[frame_idx] = np.average(
                skeleton_map[window_start:window_end],
                axis=0,
                weights=weights
            )
        
        logger.info(
            "✅ EXIT: generate_map",
            output_shape=smoothed_map.shape,
            status="generated"
        )
        return smoothed_map
    
    def compute_joint_confidence(self, skeleton_map: np.ndarray) -> np.ndarray:
        """Compute per-joint confidence scores during transition."""
        logger.info("🚀 ENTRY: compute_joint_confidence", skeleton_map_shape=skeleton_map.shape)
        
        # Confidence based on embedding stability (low variance = high confidence)
        confidence = 1.0 / (1.0 + np.var(skeleton_map, axis=0))
        
        logger.info(
            "✅ EXIT: compute_joint_confidence",
            confidence_shape=confidence.shape,
            mean_confidence=float(np.mean(confidence))
        )
        return confidence
```

**Create file**: Create this Python file in the motion-blend-service

### Task 2.2: Integrate Multi-Stage Generator

**File**: `apps/motion-blend-service/src/blend_engine.py` (UPDATE)

Update the `blend_motions` function to use skeleton ID map:

```python
# Add to blend_motions function after line 150 (after temporal smoothing)

# Generate skeleton ID map for smooth transition
logger.info(
    "🚀 Generating skeleton ID map",
    transition_frame=transition_frame,
    source_joints=source_data["names"].__len__()
)

from skeleton_id_map import SkeletonIDMap
skeleton_map_gen = SkeletonIDMap(
    num_joints=len(source_data["names"]),
    embedding_dim=256
)

# Extract joint embeddings from motion data
source_joints_emb = np.mean(source_data["positions"], axis=0, keepdims=True)
target_joints_emb = np.mean(target_data["positions"], axis=0, keepdims=True)

skeleton_map = skeleton_map_gen.generate_map(
    source_joints_emb,
    target_joints_emb,
    transition_frame
)

logger.info(
    "✅ Skeleton ID map generated",
    skeleton_map_shape=skeleton_map.shape
)

# Apply multi-stage blending using skeleton ID guidance
blended_positions[transition_frame-5:transition_frame+5] = \
    apply_skeleton_guided_blending(
        source_data["positions"],
        target_data["positions"],
        skeleton_map
    )
```

### Task 2.3: Create Transition Quality Metrics

**File**: `apps/motion-blend-service/src/quality_metrics.py` (NEW)

```python
import numpy as np
from typing import Dict, Tuple
import structlog

logger = structlog.get_logger()

class TransitionQualityMetrics:
    """Compute quality metrics for motion transitions."""
    
    @staticmethod
    def compute_velocity_continuity(
        positions: np.ndarray,
        transition_frame: int,
        window: int = 5
    ) -> float:
        """
        Compute velocity continuity score at transition.
        
        Args:
            positions: Motion positions [frames, joints, 3]
            transition_frame: Frame index of transition
            window: Window size around transition
            
        Returns:
            Continuity score (0-1, higher is smoother)
        """
        logger.info(
            "🚀 ENTRY: compute_velocity_continuity",
            transition_frame=transition_frame,
            window=window
        )
        
        # Compute velocities before and after transition
        velocities = np.diff(positions, axis=0)
        
        before_idx = max(0, transition_frame - window)
        after_idx = min(len(velocities), transition_frame + window)
        
        before_vel = velocities[before_idx:transition_frame]
        after_vel = velocities[transition_frame:after_idx]
        
        # Compute magnitude difference
        before_mag = np.linalg.norm(before_vel, axis=-1)
        after_mag = np.linalg.norm(after_vel, axis=-1)
        
        # Score: 1.0 if velocities match, 0.0 if very different
        max_before = np.max(before_mag) if len(before_mag) > 0 else 1.0
        max_after = np.max(after_mag) if len(after_mag) > 0 else 1.0
        
        continuity = 1.0 - np.clip(np.abs(max_before - max_after) / (max_before + max_after + 1e-6), 0, 1)
        
        logger.info(
            "✅ EXIT: compute_velocity_continuity",
            score=continuity,
            before_max_vel=float(max_before),
            after_max_vel=float(max_after)
        )
        return float(continuity)
    
    @staticmethod
    def compute_acceleration_smoothness(
        positions: np.ndarray,
        transition_frame: int,
        window: int = 5
    ) -> float:
        """Compute acceleration smoothness (second derivative)."""
        logger.info(
            "🚀 ENTRY: compute_acceleration_smoothness",
            transition_frame=transition_frame
        )
        
        # Compute accelerations (second derivative)
        velocities = np.diff(positions, axis=0)
        accelerations = np.diff(velocities, axis=0)
        
        before_idx = max(0, transition_frame - window - 1)
        after_idx = min(len(accelerations), transition_frame + window)
        
        before_acc = accelerations[before_idx:transition_frame-1]
        after_acc = accelerations[transition_frame:after_idx]
        
        # Score based on acceleration magnitude changes
        before_mag = np.mean(np.linalg.norm(before_acc, axis=-1)) if len(before_acc) > 0 else 0.0
        after_mag = np.mean(np.linalg.norm(after_acc, axis=-1)) if len(after_acc) > 0 else 0.0
        
        smoothness = 1.0 - np.clip(np.abs(before_mag - after_mag), 0, 2.0) / 2.0
        
        logger.info(
            "✅ EXIT: compute_acceleration_smoothness",
            score=smoothness
        )
        return float(smoothness)
    
    @staticmethod
    def compute_foot_contact_stability(
        positions: np.ndarray,
        joint_names: List[str],
        transition_frame: int,
        threshold: float = 0.01
    ) -> float:
        """
        Compute foot contact stability (penalize foot penetration/liftoff).
        
        Args:
            positions: Motion positions
            joint_names: Names of joints
            transition_frame: Transition frame index
            threshold: Ground penetration threshold
            
        Returns:
            Stability score (0-1)
        """
        logger.info(
            "🚀 ENTRY: compute_foot_contact_stability",
            transition_frame=transition_frame,
            num_joints=len(joint_names)
        )
        
        # Find foot joints (heuristic: contains 'foot' or 'ankle')
        foot_indices = [i for i, name in enumerate(joint_names) 
                       if 'foot' in name.lower() or 'ankle' in name.lower()]
        
        if not foot_indices:
            logger.info("✅ EXIT: No foot joints found, returning neutral score")
            return 0.5
        
        # Check for ground penetration (y-coordinate < threshold)
        transition_window = positions[max(0, transition_frame-5):min(len(positions), transition_frame+5)]
        
        foot_positions = transition_window[:, foot_indices, 1]  # y-coordinate
        ground_penetrations = np.sum(foot_positions < threshold)
        
        stability = 1.0 - (ground_penetrations / (foot_positions.size + 1e-6))
        
        logger.info(
            "✅ EXIT: compute_foot_contact_stability",
            score=stability,
            penetrations=int(ground_penetrations)
        )
        return float(stability)


def compute_blend_quality_advanced(
    blended_positions: np.ndarray,
    joint_names: List[str],
    transition_frame: int,
    embedding_hash: str
) -> Dict[str, float]:
    """
    Compute comprehensive blend quality metrics.
    
    Returns dict with:
    - velocity_continuity: 0-1
    - acceleration_smoothness: 0-1
    - foot_contact_stability: 0-1
    - overall_score: 0-100 (weighted average)
    """
    logger.info(
        "🚀 ENTRY: compute_blend_quality_advanced",
        positions_shape=blended_positions.shape,
        embedding_hash=embedding_hash
    )
    
    metrics = TransitionQualityMetrics()
    
    velocity = metrics.compute_velocity_continuity(blended_positions, transition_frame)
    acceleration = metrics.compute_acceleration_smoothness(blended_positions, transition_frame)
    foot_contact = metrics.compute_foot_contact_stability(blended_positions, joint_names, transition_frame)
    
    # Weighted combination
    overall = (velocity * 0.4 + acceleration * 0.35 + foot_contact * 0.25) * 100
    
    result = {
        "velocity_continuity": velocity,
        "acceleration_smoothness": acceleration,
        "foot_contact_stability": foot_contact,
        "overall_score": overall,
    }
    
    logger.info(
        "✅ EXIT: compute_blend_quality_advanced",
        metrics=result
    )
    
    return result
```

### Task 2.4: Update Blend Quality Validation

**File**: `apps/motion-blend-service/src/blend_engine.py` (UPDATE)

Replace the existing `compute_blend_quality` function with advanced metrics:

```python
from quality_metrics import compute_blend_quality_advanced

def compute_blend_quality(
    blended_positions: np.ndarray,
    joint_names: List[str],
    transition_frame: int,
    embedding_hash: str,
    quality_threshold: float = 80.0
) -> Tuple[Dict, bool]:
    """
    Compute blend quality using advanced metrics.
    
    Returns:
        (metrics_dict, is_acceptable)
    """
    logger.info(
        "🚀 ENTRY: compute_blend_quality",
        threshold=quality_threshold,
        embedding_hash=embedding_hash
    )
    
    metrics = compute_blend_quality_advanced(
        blended_positions,
        joint_names,
        transition_frame,
        embedding_hash
    )
    
    is_acceptable = metrics["overall_score"] >= quality_threshold
    
    logger.info(
        "✅ EXIT: compute_blend_quality",
        overall_score=metrics["overall_score"],
        is_acceptable=is_acceptable
    )
    
    return metrics, is_acceptable
```

**Estimated Time**: 1.5-2 hours

---

## 🎨 Phase 3: Frontend Integration (2-3 hours)

### Overview
Add motion blending UI to web-dapp with 3D preview and minting flow

### Task 3.1: Create MotionBlendingStudio Component

**File**: `apps/web-dapp/src/components/MotionBlendingStudio.tsx` (NEW)

```typescript
import React, { useState } from 'react';
import { useUSDCTransfer } from '@/hooks/useUSDCTransfer';
import structlog from 'structlog';

const logger = structlog.get_logger();

interface BlendConfig {
  source1: string;
  source2: string;
  blendWeight: number;
  transitionFrames: number;
}

export default function MotionBlendingStudio() {
  logger.info('🚀 ENTRY: MotionBlendingStudio');
  
  const [config, setConfig] = useState<BlendConfig>({
    source1: '',
    source2: '',
    blendWeight: 0.5,
    transitionFrames: 10,
  });

  const [blendStatus, setBlendStatus] = useState<'idle' | 'blending' | 'success' | 'error'>('idle');
  const [blendMetadata, setBlendMetadata] = useState<any>(null);
  const { sendUSDC, isTransferring } = useUSDCTransfer();

  const handleBlend = async () => {
    logger.info('🚀 Initiating blend operation', config);

    try {
      setBlendStatus('blending');

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

      const result = await response.json();
      logger.info('✅ Blend completed', result);

      setBlendMetadata(result);
      setBlendStatus('success');
    } catch (error) {
      logger.error('❌ Blend failed', { error });
      setBlendStatus('error');
    }
  };

  const handleMint = async () => {
    logger.info('🚀 Minting blended motion NFT');

    if (!blendMetadata) {
      logger.error('No blend metadata available');
      return;
    }

    try {
      // Register blend on-chain
      const registerResponse = await fetch('/api/motion-blend/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedding_hash: blendMetadata.embedding_hash,
          quality_score: blendMetadata.quality_score,
          metadata: blendMetadata,
        }),
      });

      const registerResult = await registerResponse.json();
      logger.info('✅ Blend registered on-chain', registerResult);

      // Send USDC payment for minting
      const txResult = await sendUSDC(
        registerResult.registry_address,
        '7.0' // 7 USDC minting fee
      );

      logger.info('✅ USDC payment successful', txResult);
      setBlendStatus('success');
    } catch (error) {
      logger.error('❌ Minting failed', { error });
      setBlendStatus('error');
    }
  };

  return (
    <div className="motion-blending-studio">
      <h1>🎬 Motion Blending Studio</h1>

      <div className="blend-config">
        <label>
          Source Motion 1:
          <input
            type="text"
            value={config.source1}
            onChange={(e) => setConfig({ ...config, source1: e.target.value })}
            placeholder="path/to/motion1.bvh"
          />
        </label>

        <label>
          Source Motion 2:
          <input
            type="text"
            value={config.source2}
            onChange={(e) => setConfig({ ...config, source2: e.target.value })}
            placeholder="path/to/motion2.bvh"
          />
        </label>

        <label>
          Blend Weight (Source 1):
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.blendWeight}
            onChange={(e) => setConfig({ ...config, blendWeight: parseFloat(e.target.value) })}
          />
          <span>{(config.blendWeight * 100).toFixed(0)}%</span>
        </label>

        <label>
          Transition Frames:
          <input
            type="number"
            min="5"
            max="30"
            value={config.transitionFrames}
            onChange={(e) => setConfig({ ...config, transitionFrames: parseInt(e.target.value) })}
          />
        </label>

        <button onClick={handleBlend} disabled={blendStatus === 'blending'}>
          {blendStatus === 'blending' ? '⏳ Blending...' : '🚀 Start Blending'}
        </button>
      </div>

      {blendMetadata && (
        <div className="blend-result">
          <h2>✅ Blend Successful</h2>

          <div className="metadata">
            <p>
              <strong>Embedding Hash:</strong> {blendMetadata.embedding_hash.slice(0, 16)}...
            </p>
            <p>
              <strong>Quality Score:</strong> {blendMetadata.quality_score.toFixed(2)}/100
            </p>
            <p>
              <strong>Velocity Continuity:</strong> {blendMetadata.velocity_continuity?.toFixed(3)}
            </p>
            <p>
              <strong>Acceleration Smoothness:</strong> {blendMetadata.acceleration_smoothness?.toFixed(3)}
            </p>
            <p>
              <strong>Foot Contact Stability:</strong> {blendMetadata.foot_contact_stability?.toFixed(3)}
            </p>
          </div>

          <button onClick={handleMint} disabled={isTransferring}>
            {isTransferring ? '⏳ Minting...' : '🎁 Mint as NFT (7 USDC)'}
          </button>
        </div>
      )}

      {blendStatus === 'error' && (
        <div className="error-message">
          ❌ Blending failed. Please check your inputs and try again.
        </div>
      )}

      <style jsx>{`
        .motion-blending-studio {
          max-width: 600px;
          margin: 2rem auto;
          padding: 2rem;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
        }

        .blend-config {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin: 1rem 0;
        }

        .blend-config label {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .blend-config input {
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }

        .blend-config button {
          padding: 0.75rem 1.5rem;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }

        .blend-result {
          background: #f0f0f0;
          padding: 1rem;
          border-radius: 4px;
          margin-top: 1rem;
        }

        .metadata {
          margin: 1rem 0;
          font-size: 0.9rem;
        }

        .error-message {
          color: #e74c3c;
          padding: 1rem;
          background: #fadbd8;
          border-radius: 4px;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
}
```

### Task 3.2: Add 3D Motion Preview with Three.js

**File**: `apps/web-dapp/src/components/MotionPreview.tsx` (NEW)

```typescript
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface MotionPreviewProps {
  bvhPath: string;
  autoPlay?: boolean;
}

export default function MotionPreview({ bvhPath, autoPlay = true }: MotionPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(800, 600);
    mountRef.current.appendChild(renderer.domElement);

    // Add basic skeleton visualization (would load BVH in production)
    const skeletonGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      0, 0, 0, // Root
      0, 1, 0, // Hip
      -0.5, 0.5, 0, // Left shoulder
      0.5, 0.5, 0, // Right shoulder
    ]);
    skeletonGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({ color: 0x0088ff });
    const skeleton = new THREE.LineSegments(skeletonGeometry, material);
    scene.add(skeleton);

    // Lighting
    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);

    // Animation loop
    let frame = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      frame += 0.016; // ~60fps
      skeleton.rotation.y += 0.005;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [bvhPath]);

  return <div ref={mountRef} style={{ width: '100%', height: '600px' }} />;
}
```

### Task 3.3: Add API Routes for Blend Service

**File**: `apps/web-dapp/src/pages/api/motion-blend/blend.ts` (NEW)

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Forward to motion-blend-service
    const blendServiceUrl = process.env.MOTION_BLEND_SERVICE_URL || 'http://localhost:8000';
    
    const response = await fetch(`${blendServiceUrl}/blend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Blend service error:', error);
    res.status(500).json({ error: 'Blend operation failed' });
  }
}
```

**Estimated Time**: 1.5-2 hours

---

## 🧪 Phase 4: Testing & Deployment (2 hours)

### Task 4.1: Integration Tests

**File**: `apps/motion-blend-service/tests/test_integration_e2e.py` (NEW)

```python
import pytest
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from bvh_utils import load_bvh, save_bvh
from motion_processor import extract_features, compute_hash
from blend_engine import blend_motions
import structlog

logger = structlog.get_logger()

class TestIntegrationE2E:
    """End-to-end integration tests: BVH → Blend → Register → Mint"""

    def test_full_pipeline_walk_to_walk(self):
        """Test full pipeline: load → blend → hash → save"""
        logger.info("🚀 ENTRY: test_full_pipeline_walk_to_walk")

        try:
            # 1. Load source BVH files
            source_file1 = "test-data/bvh/walk_01.bvh"
            source_file2 = "test-data/bvh/walk_02.bvh"

            source1 = load_bvh(source_file1)
            source2 = load_bvh(source_file2)

            assert source1 is not None, "Failed to load source1"
            assert source2 is not None, "Failed to load source2"

            logger.info("✅ Loaded BVH files")

            # 2. Blend motions
            output_dir = "/tmp/blend_test"
            os.makedirs(output_dir, exist_ok=True)

            result = blend_motions(
                source_files=[source_file1, source_file2],
                blend_weights=[0.5, 0.5],
                transition_frame=5,
                output_dir=output_dir,
                quality_threshold=0.0  # Accept any quality for test
            )

            assert result is not None, "Blend failed"
            assert "embedding_hash" in result
            assert "blended_bvh_path" in result
            assert "quality_score" in result

            logger.info("✅ Blending successful", quality_score=result["quality_score"])

            # 3. Verify hash is deterministic
            result2 = blend_motions(
                source_files=[source_file1, source_file2],
                blend_weights=[0.5, 0.5],
                transition_frame=5,
                output_dir=output_dir,
                quality_threshold=0.0
            )

            assert result["embedding_hash"] == result2["embedding_hash"], "Hash not deterministic"

            logger.info("✅ Hash determinism verified")

            # 4. Verify quality metrics
            assert 0 <= result["quality_score"] <= 100, "Invalid quality score"
            assert "velocity_continuity" in result
            assert "acceleration_smoothness" in result
            assert "foot_contact_stability" in result

            logger.info(
                "✅ EXIT: test_full_pipeline_walk_to_walk",
                overall_score=result["quality_score"]
            )

        except Exception as e:
            logger.error("❌ Test failed", error=str(e))
            raise


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
```

### Task 4.2: Deploy BlendedMotionRegistry

Already configured! Just run:

```bash
cd packages/contracts

# Check wallet balance
pnpm hardhat run scripts/check-balance.ts --network arcTestnet

# Once funded, deploy
pnpm hardhat run scripts/deploy-blended-motion-registry.ts --network arcTestnet
```

### Task 4.3: Deploy motion-blend-service to Railway

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login to Railway
railway login

# 3. Create new Railway project
railway init

# 4. Create Dockerfile for motion-blend-service
cat > apps/motion-blend-service/Dockerfile << 'EOF'
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ src/

# Run API
CMD ["python", "-m", "uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

# 5. Deploy
railway up

# 6. Get URL and update .env
# MOTION_BLEND_SERVICE_URL=https://your-railway-app.railway.app
```

### Task 4.4: Sample BVH Files

Already available! Located in: `packages/contracts/test-data/bvh/`
- walk_01.bvh, walk_02.bvh
- build_01.bvh, build_02.bvh
- blend_01.bvh, blend_02.bvh

---

## 📝 Hackathon Submission Checklist

### ✅ Deliverables Status

- [x] **Motion Minting Example Tested**
  - TX: 0x018980876106a70f... (USDC transfer verified ✅)
  - Smart contracts: 46/46 tests passing ✅
  - Motion blending service: Phase 1 complete ✅

- [x] **Vercel Deployment Updated**
  - WalletConnect MCP configured ✅
  - Circle MCP configured ✅
  - Environment variables ready ⏳

- [ ] **Demo Video Recorded** (⏳ Pending - 2-3 hours)
  - Script ready (see DEMO_SCRIPT.md)
  - Use OBS Studio for recording
  - Edit in DaVinci Resolve
  - Upload to YouTube (unlisted)
  - Add URL to Devpost

- [ ] **Devpost Submission** (⏳ Pending - 1 hour)
  - Title: "Kinetic Ledger: AI-Powered Motion Attestation on Arc"
  - Description: Copy from DEVPOST_SUBMISSION.md
  - Add all media (cover, screenshots, video)
  - Submit before Nov 8, 23:59 (1-day buffer before deadline)

### 🎯 Submission Requirements

**Required Materials**:
1. ✅ **Problem Statement** - 4M Kenyans uninsured, $9B opportunity
2. ✅ **Solution** - Motion NFTs + AI attestation for fitness/health
3. ✅ **Technology** - Arc + USDC + GANimator + RkCNN
4. ⏳ **Demo Video** - 3-5 minutes showing full flow
5. ✅ **Code** - 25,000+ lines, GitHub public repo
6. ⏳ **Live Demo** - Vercel URL for dApp
7. ⏳ **Cover Image** - Kinetic Ledger branding

**Tracks**:
- ✅ On-chain Actions (AI agents interact with DeFi)
- ✅ Payments for RWA (fitness credentials)
- ✅ Payments for Content (motion NFTs)

---

## ⏱️ Execution Timeline

**Today (Nov 9, 2025)**:
- Phase 2: 2 hours (1-3 AM)
- Phase 3: 2.5 hours (3-5:30 AM)
- Phase 4: 1 hour (5:30-6:30 AM)
- Buffer: 30 minutes

**Deadline**: 2:30 AM EAT (Nov 9 evening UTC-3 / morning UTC)

---

## 🚀 Quick Start Commands

```bash
# Phase 2: Temporal Conditioning
cd apps/motion-blend-service
pnpm add scikit-learn  # For advanced metrics
pip install -r requirements.txt

# Phase 3: Frontend Integration
cd apps/web-dapp
pnpm add three
pnpm dev  # Test locally

# Phase 4: Testing & Deployment
cd packages/contracts
pnpm hardhat run scripts/deploy-blended-motion-registry.ts --network arcTestnet

# Railway deployment
railway login
railway up
```

---

**Status**: Ready for immediate execution  
**Owner**: Kinetic Ledger Team  
**Next Action**: Begin Phase 2 implementation
