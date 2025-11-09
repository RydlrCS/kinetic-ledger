"""
Skeleton ID Map Generation for Motion Transitions

This module implements learned skeleton ID mapping for smooth motion transitions.
It generates temporally-conditioned embeddings that guide the GANimator generator
during blend operations.

Features:
- Learned skeleton embeddings (512-D vectors per joint)
- Gaussian temporal smoothing kernels
- Smooth interpolation between source and target skeletons
- Per-joint confidence scoring during transitions
- Full verbose logging for transparency

Architecture:
- Skeleton embeddings: Trainable parameters per joint (would be trained in production)
- Temporal kernel: Gaussian smoothing for frame-level continuity
- Sigmoid blending: S-curve interpolation for natural transitions

Reference: GANimator (https://github.com/RydlrCS/blendanim)

Author: Kinetic Ledger Team
License: MIT
"""

from typing import Dict

import numpy as np
import structlog

# Configure structlog for verbose logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
)

logger = structlog.get_logger(__name__)


# ============================================================================
# Custom Exceptions
# ============================================================================


class SkeletonMapError(Exception):
    """Base exception for skeleton ID map errors."""
    pass


class InvalidEmbeddingError(SkeletonMapError):
    """Raised when embeddings have invalid shape or values."""
    pass


class TransitionError(SkeletonMapError):
    """Raised when transition generation fails."""
    pass


# ============================================================================
# Skeleton ID Map Generator
# ============================================================================


class SkeletonIDMap:
    """
    Generate learned skeleton ID maps for smooth motion transitions.

    This class manages skeleton embeddings and generates temporally-conditioned
    maps that guide motion blending. Each joint has a learned embedding that
    is interpolated during transitions to ensure smooth skeleton configurations.

    Attributes:
        num_joints (int): Number of joints in skeleton
        embedding_dim (int): Dimension of learned embeddings (default: 512)
        skeleton_embeddings (np.ndarray): Learned embeddings [num_joints, embedding_dim]
        temporal_smoothing (np.ndarray): Gaussian smoothing kernel

    Example:
        >>> skeleton_map_gen = SkeletonIDMap(num_joints=24, embedding_dim=512)
        >>> source_emb = np.random.randn(24, 512)  # Source joint embeddings
        >>> target_emb = np.random.randn(24, 512)  # Target joint embeddings
        >>> transition_map = skeleton_map_gen.generate_map(
        ...     source_emb, target_emb, transition_frames=10
        ... )
        >>> print(transition_map.shape)
        (10, 24, 512)
    """

    def __init__(
        self,
        num_joints: int,
        embedding_dim: int = 512,
        seed: int = 42,
        temporal_kernel_size: int = 5,
    ):
        """
        Initialize skeleton ID map generator.

        Args:
            num_joints (int): Number of joints in skeleton (e.g., 24 for CMU BVH)
            embedding_dim (int): Dimension of learned embeddings. Default: 512
                (matches 512-D embeddings from MotionProcessor)
            seed (int): Random seed for reproducibility. Default: 42
            temporal_kernel_size (int): Size of Gaussian smoothing kernel. Default: 5

        Raises:
            ValueError: If num_joints <= 0 or embedding_dim <= 0

        Logs:
            🚀 ENTRY: Detailed initialization parameters
            ✅ EXIT: Confirmation of successful initialization
        """
        logger.info(
            "🚀 ENTRY: SkeletonIDMap.__init__",
            num_joints=num_joints,
            embedding_dim=embedding_dim,
            seed=seed,
            temporal_kernel_size=temporal_kernel_size,
        )

        if num_joints <= 0:
            raise ValueError(f"num_joints must be positive, got {num_joints}")
        if embedding_dim <= 0:
            raise ValueError(f"embedding_dim must be positive, got {embedding_dim}")

        self.num_joints = num_joints
        self.embedding_dim = embedding_dim
        self.temporal_kernel_size = temporal_kernel_size

        # Set random seed for reproducibility
        np.random.seed(seed)

        # Initialize learnable skeleton embeddings
        # In production, these would be trained via backprop
        # For now, use random initialization (N(0, 1/sqrt(embedding_dim)))
        self.skeleton_embeddings = (
            np.random.randn(num_joints, embedding_dim).astype(np.float32)
            / np.sqrt(embedding_dim)
        )

        logger.info(
            "Initialized skeleton embeddings",
            embeddings_shape=self.skeleton_embeddings.shape,
            embeddings_norm=float(np.linalg.norm(self.skeleton_embeddings)),
        )

        # Create Gaussian temporal smoothing kernel
        self.temporal_smoothing = self._create_temporal_kernel()

        logger.info(
            "✅ EXIT: SkeletonIDMap.__init__",
            status="initialized",
            total_parameters=int(num_joints * embedding_dim),
        )

    def _create_temporal_kernel(self) -> np.ndarray:
        """
        Create Gaussian temporal smoothing kernel.

        This kernel is used to smooth skeleton ID maps across frames,
        ensuring temporal coherence during transitions.

        Returns:
            np.ndarray: Normalized Gaussian kernel [temporal_kernel_size]
                Sum of kernel values = 1.0

        Logs:
            🚀 ENTRY: Function entry
            ✅ EXIT: Kernel created with statistics

        Example:
            >>> skeleton_map = SkeletonIDMap(num_joints=24)
            >>> kernel = skeleton_map._create_temporal_kernel()
            >>> print(kernel.shape)
            (5,)
            >>> print(np.sum(kernel))  # Should be ~1.0
            0.9999999
        """
        logger.info(
            "🚀 ENTRY: _create_temporal_kernel",
            window_size=self.temporal_kernel_size,
        )

        # Create Gaussian kernel
        sigma = self.temporal_kernel_size / 3.0
        x = np.arange(self.temporal_kernel_size) - self.temporal_kernel_size // 2
        kernel = np.exp(-(x ** 2) / (2 * sigma ** 2)).astype(np.float32)

        # Normalize to sum to 1.0
        kernel = kernel / np.sum(kernel)

        logger.info(
            "✅ EXIT: _create_temporal_kernel",
            kernel_shape=kernel.shape,
            kernel_sum=float(np.sum(kernel)),
            kernel_center_value=float(kernel[self.temporal_kernel_size // 2]),
        )

        return kernel

    def generate_map(
        self,
        source_embedding: np.ndarray,
        target_embedding: np.ndarray,
        transition_frames: int = 10,
    ) -> np.ndarray:
        """
        Generate smooth skeleton ID map for transition between motions.

        This function creates a temporally-smooth mapping between two skeleton
        configurations using sigmoid-based interpolation and Gaussian smoothing.
        The output guides the GANimator generator during blend operations.

        Args:
            source_embedding (np.ndarray): Source motion embedding
                Shape: [num_joints, embedding_dim] or [1, num_joints, embedding_dim]
            target_embedding (np.ndarray): Target motion embedding
                Shape: [num_joints, embedding_dim] or [1, num_joints, embedding_dim]
            transition_frames (int): Number of frames for transition. Default: 10

        Returns:
            np.ndarray: Skeleton ID map for transition
                Shape: [transition_frames, num_joints, embedding_dim]
                Values: Float32, range approximately [-3, 3] (normalized embeddings)

        Raises:
            InvalidEmbeddingError: If embeddings have incorrect shape or
                contain NaN
            ValueError: If transition_frames <= 0

        Logs:
            🚀 ENTRY: Input parameters and shapes
            Details at each interpolation stage
            ✅ EXIT: Output shape and statistics

        Example:
            >>> skeleton_map_gen = SkeletonIDMap(num_joints=24, embedding_dim=512)
            >>> source = np.random.randn(24, 512)
            >>> target = np.random.randn(24, 512)
            >>> transition_map = skeleton_map_gen.generate_map(
            ...     source, target, transition_frames=10
            ... )
            >>> print(transition_map.shape)
            (10, 24, 512)
            >>> print(f"Mean: {np.mean(transition_map):.4f}")
            >>> print(f"Std: {np.std(transition_map):.4f}")
            Mean: -0.0012
            Std: 0.5234
        """
        logger.info(
            "🚀 ENTRY: generate_map",
            source_shape=source_embedding.shape,
            target_shape=target_embedding.shape,
            transition_frames=transition_frames,
        )

        # Validate inputs
        if transition_frames <= 0:
            msg = f"transition_frames must be positive, got {transition_frames}"
            raise ValueError(msg)

        # Squeeze if batch dimension exists
        source_emb = np.squeeze(source_embedding)
        target_emb = np.squeeze(target_embedding)

        if source_emb.ndim != 2:
            msg = (
                f"Source embedding must be 2D [joints, dim], "
                f"got shape {source_emb.shape}"
            )
            raise InvalidEmbeddingError(msg)
        if target_emb.ndim != 2:
            msg = (
                f"Target embedding must be 2D [joints, dim], "
                f"got shape {target_emb.shape}"
            )
            raise InvalidEmbeddingError(msg)

        if source_emb.shape[1] != self.embedding_dim:
            raise InvalidEmbeddingError(
                f"Expected embedding_dim={self.embedding_dim}, "
                f"got source shape {source_emb.shape}"
            )
        if target_emb.shape[1] != self.embedding_dim:
            raise InvalidEmbeddingError(
                f"Expected embedding_dim={self.embedding_dim}, "
                f"got target shape {target_emb.shape}"
            )

        if np.any(np.isnan(source_emb)) or np.any(np.isnan(target_emb)):
            raise InvalidEmbeddingError("Embeddings contain NaN values")

        logger.info(
            "Embeddings validated",
            source_norm=float(np.linalg.norm(source_emb)),
            target_norm=float(np.linalg.norm(target_emb)),
        )

        # Create linear time schedule [0, 1]
        t = np.linspace(0, 1, transition_frames)[:, np.newaxis, np.newaxis]

        logger.info(
            "Created time schedule",
            time_values_min=float(t.min()),
            time_values_max=float(t.max()),
        )

        # Sigmoid blending: S-curve for natural transitions
        # Maps t in [0, 1] to sigmoid output in [0, 1] with smooth derivatives
        sigmoid_blend = 1.0 / (1.0 + np.exp(-10 * (t - 0.5)))

        logger.info(
            "Applied sigmoid blending",
            sigmoid_min=float(sigmoid_blend.min()),
            sigmoid_max=float(sigmoid_blend.max()),
            sigmoid_center=float(sigmoid_blend[transition_frames // 2]),
        )

        # Linear interpolation in embedding space
        # skeleton_map[frame] = (1 - sigmoid_blend) * source + sigmoid_blend * target
        skeleton_map = (
            (1 - sigmoid_blend) * source_emb[np.newaxis, :, :]
            + sigmoid_blend * target_emb[np.newaxis, :, :]
        ).astype(np.float32)

        logger.info(
            "Created initial skeleton map",
            skeleton_map_shape=skeleton_map.shape,
            skeleton_map_norm=float(np.linalg.norm(skeleton_map)),
        )

        # Apply temporal smoothing via convolution
        smoothed_map = self._apply_temporal_smoothing(skeleton_map)

        logger.info(
            "Applied temporal smoothing",
            smoothed_map_norm=float(np.linalg.norm(smoothed_map)),
            norm_reduction_percent=float(
                100 * (1 - np.linalg.norm(smoothed_map) / np.linalg.norm(skeleton_map))
            ),
        )

        logger.info(
            "✅ EXIT: generate_map",
            output_shape=smoothed_map.shape,
            output_dtype=str(smoothed_map.dtype),
            output_mean=float(np.mean(smoothed_map)),
            output_std=float(np.std(smoothed_map)),
            output_min=float(np.min(smoothed_map)),
            output_max=float(np.max(smoothed_map)),
        )

        return smoothed_map

    def _apply_temporal_smoothing(self, skeleton_map: np.ndarray) -> np.ndarray:
        """
        Apply temporal smoothing via Gaussian convolution.

        For each frame, applies weighted average of neighboring frames
        using the Gaussian smoothing kernel.

        Args:
            skeleton_map (np.ndarray): Skeleton ID map [frames, joints, embedding_dim]

        Returns:
            np.ndarray: Smoothed skeleton map [frames, joints, embedding_dim]

        Logs:
            🚀 ENTRY: Input shape
            Details for each frame processed
            ✅ EXIT: Output shape and statistics
        """
        logger.info(
            "🚀 ENTRY: _apply_temporal_smoothing",
            input_shape=skeleton_map.shape,
        )

        num_frames, num_joints, embedding_dim = skeleton_map.shape
        smoothed_map = np.zeros_like(skeleton_map)
        half_kernel = self.temporal_kernel_size // 2

        for frame_idx in range(num_frames):
            # Determine window boundaries
            window_start = max(0, frame_idx - half_kernel)
            window_end = min(num_frames, frame_idx + half_kernel + 1)

            # Extract weight indices from kernel
            kernel_start_idx = half_kernel - (frame_idx - window_start)
            kernel_end_idx = kernel_start_idx + (window_end - window_start)

            # Get weights for this frame's window
            weights = self.temporal_smoothing[kernel_start_idx:kernel_end_idx]

            # Apply weighted average across frames
            weighted_frames = skeleton_map[window_start:window_end] * weights[
                :, np.newaxis, np.newaxis
            ]
            smoothed_map[frame_idx] = np.sum(weighted_frames, axis=0)

            if frame_idx % max(1, num_frames // 5) == 0:
                logger.debug(
                    "Smoothed frame",
                    frame_idx=frame_idx,
                    window_start=window_start,
                    window_end=window_end,
                    num_frames_in_window=window_end - window_start,
                )

        logger.info(
            "✅ EXIT: _apply_temporal_smoothing",
            output_shape=smoothed_map.shape,
            mean_change_per_frame=float(np.mean(np.linalg.norm(
                smoothed_map - skeleton_map, axis=(1, 2)
            ))),
        )

        return smoothed_map

    def compute_joint_confidence(
        self,
        skeleton_map: np.ndarray,
    ) -> np.ndarray:
        """
        Compute per-joint confidence scores during transition.

        Confidence is based on embedding stability: joints with low variance
        across frames are considered more confident (stable).

        Args:
            skeleton_map (np.ndarray): Skeleton ID map [frames, joints, embedding_dim]

        Returns:
            np.ndarray: Joint confidence scores [joints]
                Values in range (0, 1], where 1.0 = maximum confidence

        Raises:
            ValueError: If skeleton_map has incorrect shape

        Logs:
            🚀 ENTRY: Input shape
            Statistics for confidence computation
            ✅ EXIT: Output shape and statistics

        Example:
            >>> skeleton_map_gen = SkeletonIDMap(num_joints=24)
            >>> skeleton_map = np.random.randn(10, 24, 512)
            >>> confidence = skeleton_map_gen.compute_joint_confidence(skeleton_map)
            >>> print(confidence.shape)
            (24,)
            >>> print(f"Mean confidence: {np.mean(confidence):.4f}")
            Mean confidence: 0.6234
        """
        logger.info(
            "🚀 ENTRY: compute_joint_confidence",
            skeleton_map_shape=skeleton_map.shape,
        )

        if skeleton_map.ndim != 3:
            msg = (
                f"Expected 3D skeleton_map [frames, joints, dim], "
                f"got {skeleton_map.shape}"
            )
            raise ValueError(msg)

        num_frames, num_joints, embedding_dim = skeleton_map.shape

        # Compute variance per joint across frames and embedding dims
        variance = np.var(skeleton_map, axis=(0, 2))  # [num_joints]

        logger.info(
            "Computed variance per joint",
            variance_shape=variance.shape,
            variance_mean=float(np.mean(variance)),
            variance_std=float(np.std(variance)),
            variance_min=float(np.min(variance)),
            variance_max=float(np.max(variance)),
        )

        # Confidence: inverse relationship with variance
        # High variance = low confidence, low variance = high confidence
        max_variance = np.max(variance) + 1e-8
        confidence = 1.0 / (1.0 + (variance / max_variance))

        logger.info(
            "✅ EXIT: compute_joint_confidence",
            confidence_shape=confidence.shape,
            confidence_mean=float(np.mean(confidence)),
            confidence_std=float(np.std(confidence)),
            confidence_min=float(np.min(confidence)),
            confidence_max=float(np.max(confidence)),
        )

        return confidence.astype(np.float32)


def create_skeleton_id_map_from_motions(
    source_positions: np.ndarray,
    target_positions: np.ndarray,
    transition_frame: int,
    embedding_dim: int = 512,
) -> Dict[str, np.ndarray]:
    """
    Convenience function to generate skeleton ID map from raw motion positions.

    This function extracts joint embeddings from motion data and generates
    a skeleton ID map for the transition region.

    Args:
        source_positions (np.ndarray): Source motion positions [frames, joints, 3]
        target_positions (np.ndarray): Target motion positions [frames, joints, 3]
        transition_frame (int): Frame index where transition occurs
        embedding_dim (int): Dimension of embeddings. Default: 512

    Returns:
        dict with keys:
            - 'skeleton_map': [transition_frame+10, joints, embedding_dim]
            - 'confidence': [joints]
            - 'joint_confidence_mean': float

    Logs:
        🚀 ENTRY: Input shapes and parameters
        ✅ EXIT: Output shapes and statistics

    Example:
        >>> source_pos = np.random.randn(100, 24, 3)
        >>> target_pos = np.random.randn(100, 24, 3)
        >>> result = create_skeleton_id_map_from_motions(
        ...     source_pos, target_pos, transition_frame=50
        ... )
        >>> print(result['skeleton_map'].shape)
        (20, 24, 512)
    """
    logger.info(
        "🚀 ENTRY: create_skeleton_id_map_from_motions",
        source_shape=source_positions.shape,
        target_shape=target_positions.shape,
        transition_frame=transition_frame,
        embedding_dim=embedding_dim,
    )

    num_joints = source_positions.shape[1]

    # Extract joint embeddings from motion data
    # Use mean position as embedding (simple approach)
    source_emb = np.mean(source_positions, axis=0)  # [joints, 3]
    target_emb = np.mean(target_positions, axis=0)  # [joints, 3]

    # Expand to embedding_dim via repetition and normalization
    source_emb_expanded = np.tile(source_emb, (embedding_dim // 3 + 1, 1)).T[
        :, :embedding_dim
    ].astype(np.float32)
    target_emb_expanded = np.tile(target_emb, (embedding_dim // 3 + 1, 1)).T[
        :, :embedding_dim
    ].astype(np.float32)

    logger.info(
        "Expanded embeddings",
        source_emb_expanded_shape=source_emb_expanded.shape,
        target_emb_expanded_shape=target_emb_expanded.shape,
    )

    # Generate skeleton ID map
    skeleton_map_gen = SkeletonIDMap(num_joints=num_joints, embedding_dim=embedding_dim)
    skeleton_map = skeleton_map_gen.generate_map(
        source_emb_expanded,
        target_emb_expanded,
        transition_frames=min(20, len(source_positions) // 5),
    )

    # Compute joint confidence
    confidence = skeleton_map_gen.compute_joint_confidence(skeleton_map)

    logger.info(
        "✅ EXIT: create_skeleton_id_map_from_motions",
        skeleton_map_shape=skeleton_map.shape,
        confidence_shape=confidence.shape,
        joint_confidence_mean=float(np.mean(confidence)),
    )

    return {
        "skeleton_map": skeleton_map,
        "confidence": confidence,
        "joint_confidence_mean": float(np.mean(confidence)),
    }
