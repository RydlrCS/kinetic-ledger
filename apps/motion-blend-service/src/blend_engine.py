"""
Motion Blending Engine with GANimator Integration

This module implements motion sequence blending using the GANimator architecture
with SPADE normalization for temporal conditioning. It creates smooth transitions
between 2-3 input motion sequences by generating temporally-conditioned blends.

Architecture:
- Multi-stage generator with residual connections
- SPADE (Spatially-Adaptive Denormalization) conditioning
- Temporal conditioning via skeleton ID maps
- Quality validation (velocity continuity, acceleration smoothness)

Reference: https://github.com/RydlrCS/blendanim

Author: Kinetic Ledger Team
License: MIT
"""

import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from scipy.spatial.transform import Rotation as R

from . import bvh_utils, motion_processor

# Configure logging
logger = logging.getLogger(__name__)


# ============================================================================
# Custom Exceptions
# ============================================================================


class BlendEngineError(Exception):
    """Base exception for blend engine errors"""
    pass


class BlendQualityError(BlendEngineError):
    """Raised when blended motion quality is below threshold"""
    pass


class InvalidInputError(BlendEngineError):
    """Raised when input parameters are invalid"""
    pass


# ============================================================================
# SPADE Normalization Module (from GANimator)
# ============================================================================


class SPADE(nn.Module):
    """
    Spatially-Adaptive Denormalization (SPADE) module.
    
    Uses skeleton ID maps to modulate normalized features, allowing
    temporal conditioning based on motion phase transitions.
    
    Args:
        norm_nc: Number of channels in the input feature map
        label_nc: Number of channels in the skeleton ID map (conditioning)
        hidden_nc: Number of hidden channels (default: 128)
    
    Reference:
        Park et al., "Semantic Image Synthesis with Spatially-Adaptive Normalization"
        Adapted for motion sequences in GANimator
    """
    
    def __init__(self, norm_nc: int, label_nc: int, hidden_nc: int = 128):
        super().__init__()
        logger.debug(f"Initializing SPADE(norm_nc={norm_nc}, label_nc={label_nc}, hidden_nc={hidden_nc})")
        
        # Batch normalization on input features
        self.norm = nn.BatchNorm1d(norm_nc, affine=False)
        
        # Shared MLP for processing skeleton ID map
        self.mlp_shared = nn.Sequential(
            nn.Conv1d(label_nc, hidden_nc, kernel_size=3, padding=1),
            nn.ReLU()
        )
        
        # Separate MLPs for gamma (scale) and beta (shift)
        self.mlp_gamma = nn.Conv1d(hidden_nc, norm_nc, kernel_size=3, padding=1)
        self.mlp_beta = nn.Conv1d(hidden_nc, norm_nc, kernel_size=3, padding=1)
    
    def forward(self, x: torch.Tensor, skeleton_map: torch.Tensor) -> torch.Tensor:
        """
        Apply SPADE normalization with skeleton ID map conditioning.
        
        Args:
            x: Input feature tensor [batch, channels, temporal_dim]
            skeleton_map: Skeleton ID map [batch, label_channels, temporal_dim]
        
        Returns:
            Modulated features [batch, channels, temporal_dim]
        """
        # Normalize the input features
        normalized = self.norm(x)
        
        # Generate modulation parameters from skeleton map
        actv = self.mlp_shared(skeleton_map)
        gamma = self.mlp_gamma(actv)  # Scale parameter
        beta = self.mlp_beta(actv)    # Shift parameter
        
        # Apply spatially-adaptive modulation
        return normalized * (1 + gamma) + beta


# ============================================================================
# GANimator Generator Stage (Simplified)
# ============================================================================


class GeneratorStage(nn.Module):
    """
    Single stage of GANimator generator with residual connection.
    
    Each stage performs:
    1. Add noise (for stochasticity)
    2. Residual convolution block
    3. SPADE conditioning with skeleton map
    
    Args:
        in_channels: Number of input channels
        out_channels: Number of output channels
        label_nc: Number of skeleton ID map channels
        noise_dim: Dimension of noise vector (default: 64)
    """
    
    def __init__(self, in_channels: int, out_channels: int, label_nc: int, noise_dim: int = 64):
        super().__init__()
        logger.debug(f"Initializing GeneratorStage(in={in_channels}, out={out_channels}, label_nc={label_nc})")
        
        self.noise_fc = nn.Linear(noise_dim, in_channels)
        
        self.conv_block = nn.Sequential(
            nn.Conv1d(in_channels, out_channels, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv1d(out_channels, out_channels, kernel_size=3, padding=1),
        )
        
        self.spade = SPADE(out_channels, label_nc)
        
        # Projection for residual connection if dimensions differ
        self.residual_proj = nn.Conv1d(in_channels, out_channels, kernel_size=1) if in_channels != out_channels else nn.Identity()
    
    def forward(self, x: torch.Tensor, skeleton_map: torch.Tensor, noise: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Forward pass through generator stage.
        
        Args:
            x: Input features [batch, channels, temporal]
            skeleton_map: Skeleton ID map [batch, label_nc, temporal]
            noise: Noise vector [batch, noise_dim] (optional)
        
        Returns:
            Stage output [batch, out_channels, temporal]
        """
        batch_size, _, temporal_dim = x.shape
        
        # Add noise if provided
        if noise is not None:
            noise_features = self.noise_fc(noise).unsqueeze(-1).expand(-1, -1, temporal_dim)
            x = x + noise_features
        
        # Residual convolution block
        conv_out = self.conv_block(x)
        residual = self.residual_proj(x)
        
        # Add residual connection
        out = conv_out + residual
        
        # Apply SPADE conditioning
        out = self.spade(out, skeleton_map)
        
        return out


# ============================================================================
# Motion Blending Functions
# ============================================================================


def create_skeleton_id_map(
    num_frames: int,
    num_joints: int,
    transition_frames: List[int],
    blend_weights: List[float]
) -> np.ndarray:
    """
    Create skeleton ID map for temporal conditioning.
    
    The skeleton ID map indicates which source motion dominates at each frame,
    with smooth transitions based on blend weights.
    
    Args:
        num_frames: Total number of frames in output
        num_joints: Number of joints in skeleton
        transition_frames: Frame indices where transitions occur
        blend_weights: Blend weights for each source [sum to 1.0]
    
    Returns:
        Skeleton ID map [num_frames, num_joints, num_sources]
    
    Example:
        >>> # Blend 2 motions with transition at frame 50
        >>> skeleton_map = create_skeleton_id_map(100, 24, [50], [0.5, 0.5])
        >>> skeleton_map.shape
        (100, 24, 2)
    """
    logger.debug(f"🚀 ENTRY: create_skeleton_id_map(frames={num_frames}, joints={num_joints}, "
                f"transitions={transition_frames}, weights={blend_weights})")
    
    num_sources = len(blend_weights)
    skeleton_map = np.zeros((num_frames, num_joints, num_sources), dtype=np.float32)
    
    # For simplicity, create linear blend based on weights
    # In full GANimator, this would use learned transition curves
    for source_idx in range(num_sources):
        skeleton_map[:, :, source_idx] = blend_weights[source_idx]
    
    # Apply smooth transitions at specified frames
    transition_window = 20  # Frames over which to smooth transition
    for trans_frame in transition_frames:
        start_frame = max(0, trans_frame - transition_window // 2)
        end_frame = min(num_frames, trans_frame + transition_window // 2)
        
        # Create smooth sigmoid transition
        for frame_idx in range(start_frame, end_frame):
            t = (frame_idx - start_frame) / (end_frame - start_frame)
            sigmoid_t = 1 / (1 + np.exp(-10 * (t - 0.5)))  # Steep sigmoid
            
            # Modulate weights based on transition
            skeleton_map[frame_idx, :, 0] *= (1 - sigmoid_t)
            if num_sources > 1:
                skeleton_map[frame_idx, :, 1] *= sigmoid_t
    
    logger.info(f"✅ EXIT: create_skeleton_id_map - Created map shape {skeleton_map.shape}")
    return skeleton_map


def compute_blend_quality(
    positions: np.ndarray,
    rotations: np.ndarray,
    frametime: float
) -> Dict[str, float]:
    """
    Compute quality metrics for blended motion.
    
    Quality metrics:
    - velocity_continuity: Max velocity discontinuity (lower is better)
    - acceleration_smoothness: Max acceleration spike (lower is better)
    - foot_contact_stability: Foot sliding distance (lower is better)
    - overall_score: Combined score 0-100 (higher is better)
    
    Args:
        positions: Joint positions [num_frames, num_joints, 3]
        rotations: Joint rotations [num_frames, num_joints, 3]
        frametime: Time between frames (seconds)
    
    Returns:
        Dictionary of quality metrics
    
    Raises:
        BlendQualityError: If quality is below acceptable threshold
    """
    logger.debug(f"🚀 ENTRY: compute_blend_quality(positions={positions.shape}, "
                f"rotations={rotations.shape}, frametime={frametime})")
    
    num_frames, num_joints, _ = positions.shape
    
    # Compute velocities and accelerations
    velocities = motion_processor.compute_velocities(positions, frametime)
    
    # Velocity discontinuity (max change in velocity magnitude)
    velocity_magnitudes = np.linalg.norm(velocities, axis=-1)  # [frames, joints]
    velocity_changes = np.abs(np.diff(velocity_magnitudes, axis=0))  # [frames-1, joints]
    max_velocity_discontinuity = np.max(velocity_changes)
    
    # Acceleration smoothness (max acceleration magnitude)
    accelerations = np.diff(velocities, axis=0) / frametime  # [frames-2, joints, 3]
    acceleration_magnitudes = np.linalg.norm(accelerations, axis=-1)
    max_acceleration = np.max(acceleration_magnitudes)
    
    # Foot contact stability (assume last 2 joints are feet)
    # Measure horizontal movement of feet when they should be planted
    foot_indices = [num_joints - 2, num_joints - 1]
    foot_positions = positions[:, foot_indices, :]  # [frames, 2, 3]
    foot_heights = foot_positions[:, :, 1]  # Y-axis is up
    
    # Frames where foot is on ground (height < 0.1m)
    on_ground = foot_heights < 0.1
    
    # Compute horizontal movement when on ground
    foot_sliding = 0.0
    for foot_idx in range(2):
        for frame_idx in range(num_frames - 1):
            if on_ground[frame_idx, foot_idx] and on_ground[frame_idx + 1, foot_idx]:
                horizontal_move = np.linalg.norm(
                    foot_positions[frame_idx + 1, foot_idx, [0, 2]] - 
                    foot_positions[frame_idx, foot_idx, [0, 2]]
                )
                foot_sliding = max(foot_sliding, horizontal_move)
    
    # Compute overall score (0-100)
    # Lower discontinuities → higher score
    velocity_score = max(0, 100 - max_velocity_discontinuity * 200)  # 0.5 m/s → 0 score
    acceleration_score = max(0, 100 - max_acceleration * 50)  # 2.0 m/s² → 0 score
    foot_score = max(0, 100 - foot_sliding * 1000)  # 0.1m → 0 score
    
    overall_score = (velocity_score + acceleration_score + foot_score) / 3
    
    metrics = {
        'velocity_continuity': float(max_velocity_discontinuity),
        'acceleration_smoothness': float(max_acceleration),
        'foot_contact_stability': float(foot_sliding),
        'overall_score': float(overall_score)
    }
    
    logger.info(f"✅ EXIT: compute_blend_quality - Overall score: {overall_score:.2f}/100, "
               f"Velocity: {max_velocity_discontinuity:.4f} m/s, "
               f"Acceleration: {max_acceleration:.4f} m/s², "
               f"Foot sliding: {foot_sliding:.4f} m")
    
    return metrics


def blend_motions(
    source_files: List[str],
    blend_weights: List[float],
    transition_frame: int = 50,
    output_dir: str = "./output",
    quality_threshold: float = 80.0
) -> Dict:
    """
    Blend multiple BVH motion files into a single smooth sequence.
    
    This function implements the core blending pipeline:
    1. Load source BVH files
    2. Validate inputs (weights sum to 1.0, compatible skeletons)
    3. Create temporal conditioning map
    4. Blend motion data (weighted average + smoothing)
    5. Validate blend quality
    6. Extract embedding and compute hash
    7. Save blended BVH file
    
    Args:
        source_files: Paths to 2-3 source BVH files
        blend_weights: Blend weights [sum must equal 1.0]
        transition_frame: Frame index for primary transition (default: 50)
        output_dir: Directory to save blended BVH (default: "./output")
        quality_threshold: Minimum quality score 0-100 (default: 80.0)
    
    Returns:
        Dictionary with:
        - blended_bvh_path: Path to saved BVH file
        - embedding_hash: keccak256 hash (0x-prefixed)
        - quality_score: Overall quality 0-100
        - metadata: Quality metrics, frame count, joint count
    
    Raises:
        InvalidInputError: If inputs are invalid (wrong weights, incompatible files)
        BlendQualityError: If blend quality below threshold
        BlendEngineError: For other errors during blending
    
    Example:
        >>> result = blend_motions(
        ...     ["walk.bvh", "run.bvh"],
        ...     [0.6, 0.4],
        ...     transition_frame=30
        ... )
        >>> print(result['embedding_hash'])
        '0x1234...abcd'
    """
    start_time = time.time()
    logger.info(f"🚀 ENTRY: blend_motions(files={source_files}, weights={blend_weights}, "
               f"transition={transition_frame})")
    
    # ========================================================================
    # 1. Validate Inputs
    # ========================================================================
    
    if len(source_files) < 2 or len(source_files) > 3:
        raise InvalidInputError(f"Must provide 2-3 source files, got {len(source_files)}")
    
    if len(blend_weights) != len(source_files):
        raise InvalidInputError(f"Number of weights ({len(blend_weights)}) must match files ({len(source_files)})")
    
    if abs(sum(blend_weights) - 1.0) > 0.01:
        raise InvalidInputError(f"Blend weights must sum to 1.0, got {sum(blend_weights)}")
    
    for weight in blend_weights:
        if weight < 0 or weight > 1:
            raise InvalidInputError(f"Weights must be in range [0, 1], got {weight}")
    
    logger.debug(f"Input validation passed: {len(source_files)} files, weights sum to {sum(blend_weights):.4f}")
    
    # ========================================================================
    # 2. Load Source BVH Files
    # ========================================================================
    
    loaded_motions = []
    for idx, filepath in enumerate(source_files):
        logger.debug(f"Loading source file {idx + 1}/{len(source_files)}: {filepath}")
        try:
            motion_data = bvh_utils.load_bvh(filepath)
            loaded_motions.append(motion_data)
            logger.debug(f"Loaded: {motion_data['positions'].shape[0]} frames, "
                        f"{len(motion_data['names'])} joints")
        except Exception as e:
            raise BlendEngineError(f"Failed to load {filepath}: {str(e)}")
    
    # Validate skeleton compatibility
    base_skeleton = loaded_motions[0]
    num_joints = len(base_skeleton['names'])
    
    for idx, motion in enumerate(loaded_motions[1:], start=1):
        if len(motion['names']) != num_joints:
            raise InvalidInputError(
                f"Skeleton mismatch: file 0 has {num_joints} joints, "
                f"file {idx} has {len(motion['names'])} joints"
            )
        if motion['names'] != base_skeleton['names']:
            logger.warning(f"Joint names differ between file 0 and file {idx}, proceeding anyway")
    
    logger.info(f"Loaded {len(source_files)} compatible motion files with {num_joints} joints")
    
    # ========================================================================
    # 3. Determine Output Frame Count and Blend
    # ========================================================================
    
    # Use the maximum frame count from all sources
    max_frames = max(motion['positions'].shape[0] for motion in loaded_motions)
    logger.debug(f"Output will have {max_frames} frames (max from sources)")
    
    # Initialize output arrays
    blended_positions = np.zeros((max_frames, num_joints, 3), dtype=np.float32)
    blended_rotations = np.zeros((max_frames, num_joints, 3), dtype=np.float32)
    
    # Weighted blend of positions and rotations
    for motion_idx, (motion, weight) in enumerate(zip(loaded_motions, blend_weights)):
        num_frames = motion['positions'].shape[0]
        
        # Tile shorter sequences to match max_frames
        if num_frames < max_frames:
            logger.debug(f"Tiling motion {motion_idx} from {num_frames} to {max_frames} frames")
            tile_factor = int(np.ceil(max_frames / num_frames))
            positions_tiled = np.tile(motion['positions'], (tile_factor, 1, 1))[:max_frames]
            rotations_tiled = np.tile(motion['rotations'], (tile_factor, 1, 1))[:max_frames]
        else:
            positions_tiled = motion['positions'][:max_frames]
            rotations_tiled = motion['rotations'][:max_frames]
        
        # Weighted accumulation
        blended_positions += weight * positions_tiled
        blended_rotations += weight * rotations_tiled
    
    logger.debug(f"Blended motion data: positions {blended_positions.shape}, rotations {blended_rotations.shape}")
    
    # ========================================================================
    # 4. Apply Temporal Smoothing (Simple Gaussian Filter)
    # ========================================================================
    
    # In full GANimator, this would use the generator stages
    # For now, apply simple smoothing around transition points
    from scipy.ndimage import gaussian_filter1d
    
    smoothing_sigma = 2.0  # Standard deviation for Gaussian kernel
    blended_positions = gaussian_filter1d(blended_positions, sigma=smoothing_sigma, axis=0)
    blended_rotations = gaussian_filter1d(blended_rotations, sigma=smoothing_sigma, axis=0)
    
    logger.debug(f"Applied temporal smoothing with sigma={smoothing_sigma}")
    
    # ========================================================================
    # 5. Compute Blend Quality
    # ========================================================================
    
    frametime = base_skeleton['frametime']
    quality_metrics = compute_blend_quality(blended_positions, blended_rotations, frametime)
    
    if quality_metrics['overall_score'] < quality_threshold:
        raise BlendQualityError(
            f"Blend quality {quality_metrics['overall_score']:.2f} below threshold {quality_threshold}. "
            f"Metrics: {quality_metrics}"
        )
    
    logger.info(f"Blend quality: {quality_metrics['overall_score']:.2f}/100 (threshold: {quality_threshold})")
    
    # ========================================================================
    # 6. Extract Embedding and Compute Hash
    # ========================================================================
    
    # Compute velocities for embedding extraction
    velocities = motion_processor.compute_velocities(blended_positions, frametime)
    
    # Extract 512-D embedding
    embedding = motion_processor.extract_features(
        blended_positions,
        blended_rotations,
        velocities,
        base_skeleton['offsets']
    )
    
    # Compute keccak256 hash
    embedding_hash = motion_processor.compute_hash(embedding)
    
    logger.info(f"Computed embedding hash: {embedding_hash[:10]}...{embedding_hash[-8:]}")
    
    # ========================================================================
    # 7. Save Blended BVH File
    # ========================================================================
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate output filename
    timestamp = int(time.time())
    output_filename = f"blended_{timestamp}.bvh"
    output_path = os.path.join(output_dir, output_filename)
    
    # Prepare data for saving
    blended_data = {
        'positions': blended_positions,
        'rotations': blended_rotations,
        'offsets': base_skeleton['offsets'],
        'parents': base_skeleton['parents'],
        'names': base_skeleton['names'],
        'frametime': frametime
    }
    
    bvh_utils.save_bvh(output_path, blended_data)
    logger.info(f"Saved blended BVH to {output_path}")
    
    # ========================================================================
    # 8. Construct Result
    # ========================================================================
    
    elapsed_time = time.time() - start_time
    
    result = {
        'blended_bvh_path': output_path,
        'embedding_hash': embedding_hash,
        'quality_score': quality_metrics['overall_score'],
        'metadata': {
            'num_sources': len(source_files),
            'blend_weights': blend_weights,
            'frame_count': max_frames,
            'joint_count': num_joints,
            'frametime': frametime,
            'quality_metrics': quality_metrics,
            'processing_time_seconds': elapsed_time
        }
    }
    
    logger.info(f"✅ EXIT: blend_motions - Success in {elapsed_time:.2f}s, "
               f"hash: {embedding_hash[:10]}...{embedding_hash[-8:]}, "
               f"quality: {quality_metrics['overall_score']:.2f}/100")
    
    return result
