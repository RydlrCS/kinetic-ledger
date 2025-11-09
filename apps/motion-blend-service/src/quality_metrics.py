"""
Advanced Motion Quality Metrics for Transition Validation

This module computes comprehensive quality metrics for motion transitions,
ensuring blend quality meets minimum thresholds before on-chain registration.

Metrics:
- Velocity Continuity: Smoothness of joint velocities across transition
- Acceleration Smoothness: Consistency of joint accelerations
- Foot Contact Stability: Prevents foot penetration and unnatural liftoff
- Overall Score: Weighted combination (0-100)

All functions include verbose entry/exit logging and detailed statistics.

Reference: GANimator, BlendAnim

Author: Kinetic Ledger Team
License: MIT
"""

from typing import Dict, List, Tuple

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


class QualityMetricsError(Exception):
    """Base exception for quality metrics errors."""
    pass


class InvalidMetricsInputError(QualityMetricsError):
    """Raised when input data has invalid shape or values."""
    pass


class MetricsComputationError(QualityMetricsError):
    """Raised when metric computation fails."""
    pass


# ============================================================================
# Quality Metrics Computer
# ============================================================================


class TransitionQualityMetrics:
    """
    Compute quality metrics for motion transitions.

    This class provides static methods for computing various quality metrics
    on motion sequences. Metrics are designed to capture smoothness, continuity,
    and physical plausibility of motion blends.

    Methods:
        compute_velocity_continuity: Joint velocity smoothness at transition
        compute_acceleration_smoothness: Acceleration magnitude consistency
        compute_foot_contact_stability: Penalize foot penetration/liftoff
    """

    # Configurable thresholds
    GROUND_Y_THRESHOLD = 0.01  # Minimum Y-coordinate for ground contact
    MAX_VELOCITY_CHANGE = 2.0  # Maximum acceptable velocity magnitude change
    MAX_ACCELERATION_CHANGE = 2.0  # Maximum acceptable acceleration change

    @staticmethod
    def compute_velocity_continuity(
        positions: np.ndarray,
        transition_frame: int,
        window: int = 5,
    ) -> float:
        """
        Compute velocity continuity score at transition.

        Measures whether joint velocities are consistent before and after
        the transition. High continuity (close to 1.0) indicates smooth motion.

        Algorithm:
        1. Compute velocity as first derivative of position
        2. Measure velocity magnitude before transition
        3. Measure velocity magnitude after transition
        4. Score based on magnitude difference (lower difference = higher score)

        Args:
            positions (np.ndarray): Motion positions [frames, joints, 3]
            transition_frame (int): Frame index of transition (0-based)
            window (int): Frames before/after transition to examine. Default: 5

        Returns:
            float: Continuity score in range [0, 1]
                1.0 = perfect continuity (velocities identical)
                0.0 = complete discontinuity (velocities very different)

        Raises:
            InvalidMetricsInputError: If positions has wrong shape or
                transition_frame is invalid

        Logs:
            🚀 ENTRY: Input parameters
            Details of velocity computation
            ✅ EXIT: Computed score and statistics

        Example:
            >>> positions = np.random.randn(100, 24, 3)
            >>> score = TransitionQualityMetrics.compute_velocity_continuity(
            ...     positions, transition_frame=50
            ... )
            >>> print(f"Continuity: {score:.4f}")
            Continuity: 0.8234
        """
        logger.info(
            "🚀 ENTRY: compute_velocity_continuity",
            positions_shape=positions.shape,
            transition_frame=transition_frame,
            window=window,
        )

        # Validate inputs
        if positions.ndim != 3:
            raise InvalidMetricsInputError(
                f"positions must be 3D [frames, joints, 3], got {positions.shape}"
            )
        if transition_frame < 0 or transition_frame >= positions.shape[0]:
            max_frame = positions.shape[0]
            raise InvalidMetricsInputError(
                f"transition_frame {transition_frame} out of range [0, {max_frame})"
            )

        # Compute velocities (first derivative along frame axis)
        velocities = np.diff(positions, axis=0)  # [frames-1, joints, 3]

        logger.info(
            "Computed velocities",
            velocities_shape=velocities.shape,
            velocities_mean_norm=float(np.mean(np.linalg.norm(velocities, axis=-1))),
        )

        # Extract windows before and after transition
        before_start = max(0, transition_frame - window)
        after_end = min(len(velocities), transition_frame + window)

        before_vel = velocities[before_start:transition_frame]
        after_vel = velocities[transition_frame:after_end]

        logger.info(
            "Extracted velocity windows",
            before_start=before_start,
            transition_frame=transition_frame,
            after_end=after_end,
            before_vel_shape=before_vel.shape,
            after_vel_shape=after_vel.shape,
        )

        # Compute magnitude of velocities per frame
        before_mag = np.linalg.norm(before_vel, axis=-1)  # [frames, joints]
        after_mag = np.linalg.norm(after_vel, axis=-1)

        # Reduce to single value per phase (mean magnitude)
        before_mag_mean = np.mean(before_mag) if len(before_mag) > 0 else 0.0
        after_mag_mean = np.mean(after_mag) if len(after_mag) > 0 else 0.0

        logger.info(
            "Computed mean velocity magnitudes",
            before_mag_mean=float(before_mag_mean),
            after_mag_mean=float(after_mag_mean),
            before_mag_std=float(np.std(before_mag)) if len(before_mag) > 0 else 0.0,
            after_mag_std=float(np.std(after_mag)) if len(after_mag) > 0 else 0.0,
        )

        # Score: 1.0 if velocities match, 0.0 if very different
        # Use normalized difference
        denominator = max(before_mag_mean, after_mag_mean) + 1e-8
        velocity_diff = np.abs(before_mag_mean - after_mag_mean) / denominator

        continuity = 1.0 - np.clip(velocity_diff, 0, 1)

        logger.info(
            "✅ EXIT: compute_velocity_continuity",
            score=float(continuity),
            velocity_diff=float(velocity_diff),
            status="computed",
        )

        return float(continuity)

    @staticmethod
    def compute_acceleration_smoothness(
        positions: np.ndarray,
        transition_frame: int,
        window: int = 5,
    ) -> float:
        """
        Compute acceleration smoothness (second derivative consistency).

        Measures whether joint accelerations are smooth across the transition.
        Smooth acceleration ensures natural, non-jerky motion.

        Algorithm:
        1. Compute acceleration as second derivative of position
        2. Measure acceleration magnitude before transition
        3. Measure acceleration magnitude after transition
        4. Score based on magnitude difference

        Args:
            positions (np.ndarray): Motion positions [frames, joints, 3]
            transition_frame (int): Frame index of transition
            window (int): Frames before/after transition. Default: 5

        Returns:
            float: Smoothness score in range [0, 1]
                1.0 = smooth acceleration (consistent)
                0.0 = jerky acceleration (inconsistent)

        Raises:
            InvalidMetricsInputError: If positions has wrong shape

        Logs:
            🚀 ENTRY: Input parameters
            Acceleration computation details
            ✅ EXIT: Computed smoothness score

        Example:
            >>> positions = np.random.randn(100, 24, 3)
            >>> score = TransitionQualityMetrics.compute_acceleration_smoothness(
            ...     positions, transition_frame=50
            ... )
            >>> print(f"Smoothness: {score:.4f}")
            Smoothness: 0.7123
        """
        logger.info(
            "🚀 ENTRY: compute_acceleration_smoothness",
            positions_shape=positions.shape,
            transition_frame=transition_frame,
            window=window,
        )

        if positions.ndim != 3:
            raise InvalidMetricsInputError(
                f"positions must be 3D [frames, joints, 3], got {positions.shape}"
            )

        # Compute velocities (first derivative)
        velocities = np.diff(positions, axis=0)  # [frames-1, joints, 3]

        # Compute accelerations (second derivative)
        accelerations = np.diff(velocities, axis=0)  # [frames-2, joints, 3]

        logger.info(
            "Computed accelerations",
            accelerations_shape=accelerations.shape,
        )

        # Extract windows
        before_start = max(0, transition_frame - window - 1)
        after_end = min(len(accelerations), transition_frame + window)

        before_acc = accelerations[before_start : transition_frame - 1]
        after_acc = accelerations[transition_frame : after_end]

        logger.info(
            "Extracted acceleration windows",
            before_acc_shape=before_acc.shape,
            after_acc_shape=after_acc.shape,
        )

        # Compute mean acceleration magnitudes
        before_mag = (
            np.mean(np.linalg.norm(before_acc, axis=-1))
            if len(before_acc) > 0
            else 0.0
        )
        after_mag = (
            np.mean(np.linalg.norm(after_acc, axis=-1))
            if len(after_acc) > 0
            else 0.0
        )

        logger.info(
            "Computed mean acceleration magnitudes",
            before_mag=float(before_mag),
            after_mag=float(after_mag),
        )

        # Normalize and clip difference
        max_acc = max(before_mag, after_mag)
        if max_acc < 1e-8:
            smoothness = 1.0  # Both near-zero is smooth
        else:
            smoothness = 1.0 - np.clip(np.abs(before_mag - after_mag) / max_acc, 0, 1)

        logger.info(
            "✅ EXIT: compute_acceleration_smoothness",
            score=float(smoothness),
            status="computed",
        )

        return float(smoothness)

    @staticmethod
    def compute_foot_contact_stability(
        positions: np.ndarray,
        joint_names: List[str],
        transition_frame: int,
        window: int = 5,
        threshold: float = 0.01,
    ) -> float:
        """
        Compute foot contact stability (penalize foot penetration/liftoff).

        Ensures that feet don't penetrate the ground (Y < threshold) or
        display unnatural liftoff patterns during transitions.

        Algorithm:
        1. Find foot/ankle joints by name matching
        2. Check Y-coordinate (vertical) in transition window
        3. Penalize frames where feet go below ground
        4. Compute stability as ratio of valid frames

        Args:
            positions (np.ndarray): Motion positions [frames, joints, 3]
            joint_names (List[str]): Name of each joint
            transition_frame (int): Frame index of transition
            window (int): Frames before/after transition. Default: 5
            threshold (float): Ground Y-coordinate threshold. Default: 0.01

        Returns:
            float: Stability score in range [0, 1]
                1.0 = no foot penetration (stable)
                0.0 = complete foot penetration (unstable)

        Raises:
            InvalidMetricsInputError: If positions/joint_names have mismatched shapes

        Logs:
            🚀 ENTRY: Input parameters and detected foot joints
            Ground contact analysis
            ✅ EXIT: Computed stability score

        Example:
            >>> positions = np.random.randn(100, 24, 3)
            >>> joints = ['Hip', 'Chest', ..., 'LeftFoot', 'RightFoot']  # 24 joints
            >>> score = TransitionQualityMetrics.compute_foot_contact_stability(
            ...     positions, joints, transition_frame=50
            ... )
            >>> print(f"Stability: {score:.4f}")
            Stability: 0.9234
        """
        logger.info(
            "🚀 ENTRY: compute_foot_contact_stability",
            positions_shape=positions.shape,
            joint_names_count=len(joint_names),
            transition_frame=transition_frame,
            window=window,
            threshold=threshold,
        )

        if positions.ndim != 3:
            raise InvalidMetricsInputError(
                f"positions must be 3D [frames, joints, 3], got {positions.shape}"
            )
        if positions.shape[1] != len(joint_names):
            num_pos = positions.shape[1]
            num_names = len(joint_names)
            raise InvalidMetricsInputError(
                f"positions has {num_pos} joints but got {num_names} names"
            )

        # Find foot joints by name matching
        foot_keywords = ["foot", "ankle", "toe"]
        foot_indices = [
            i
            for i, name in enumerate(joint_names)
            if any(kw in name.lower() for kw in foot_keywords)
        ]

        logger.info(
            "Detected foot joints",
            foot_joint_count=len(foot_indices),
            foot_joint_names=[joint_names[i] for i in foot_indices],
        )

        if not foot_indices:
            logger.info(
                "No foot joints detected, returning neutral score",
                status="no_feet",
            )
            return 0.5  # Neutral score when no feet found

        # Extract transition window
        window_start = max(0, transition_frame - window)
        window_end = min(len(positions), transition_frame + window)
        transition_window = positions[window_start:window_end]

        logger.info(
            "Extracted transition window",
            window_start=window_start,
            window_end=window_end,
            window_size=window_end - window_start,
        )

        # Check foot Y-coordinates (vertical axis)
        foot_positions = transition_window[:, foot_indices, 1]  # [frames, feet]

        logger.info(
            "Extracted foot positions",
            foot_positions_shape=foot_positions.shape,
            foot_y_mean=float(np.mean(foot_positions)),
            foot_y_min=float(np.min(foot_positions)),
            foot_y_max=float(np.max(foot_positions)),
        )

        # Count penetrations (Y < threshold)
        ground_penetrations = np.sum(foot_positions < threshold)
        total_foot_samples = foot_positions.size

        logger.info(
            "Computed ground contact",
            ground_penetrations=int(ground_penetrations),
            total_foot_samples=int(total_foot_samples),
            penetration_ratio=float(ground_penetrations / total_foot_samples),
        )

        # Stability = 1 - penetration_ratio
        stability = 1.0 - (ground_penetrations / (total_foot_samples + 1e-8))

        logger.info(
            "✅ EXIT: compute_foot_contact_stability",
            score=float(stability),
            status="computed",
        )

        return float(stability)


def compute_blend_quality_comprehensive(
    blended_positions: np.ndarray,
    joint_names: List[str],
    transition_frame: int,
    embedding_hash: str,
    quality_threshold: float = 80.0,
    weights: Dict[str, float] | None = None,
) -> Tuple[Dict[str, float], bool]:
    """
    Compute comprehensive blend quality metrics.

    Combines multiple quality metrics into a single overall score (0-100).
    Returns both the detailed metrics and a pass/fail determination.

    Metrics included:
    - velocity_continuity (40% weight): Smooth joint velocities at transition
    - acceleration_smoothness (35% weight): Smooth accelerations
    - foot_contact_stability (25% weight): Prevent foot penetration

    Args:
        blended_positions (np.ndarray): Blended motion positions [frames, joints, 3]
        joint_names (List[str]): Names of joints
        transition_frame (int): Frame index where blend transition occurs
        embedding_hash (str): Embedding hash (for logging/tracing)
        quality_threshold (float): Minimum acceptable overall score
            (0-100). Default: 80.0
        weights (Dict[str, float]): Custom metric weights. Default: None (use standard)
            If provided, should have keys: velocity_continuity, acceleration_smoothness,
            foot_contact_stability and sum to 1.0

    Returns:
        tuple with:
            - metrics_dict (dict): Detailed metrics with keys:
                - velocity_continuity: float [0, 1]
                - acceleration_smoothness: float [0, 1]
                - foot_contact_stability: float [0, 1]
                - overall_score: float [0, 100]
            - is_acceptable (bool): True if overall_score >= quality_threshold

    Raises:
        InvalidMetricsInputError: If input has invalid shape

    Logs:
        🚀 ENTRY: Input parameters and configuration
        Per-metric computation status
        ✅ EXIT: Overall result with pass/fail status

    Example:
        >>> blended_pos = np.random.randn(100, 24, 3)
        >>> joint_names = ['Hip', 'Chest', ..., 'LeftFoot', 'RightFoot']
        >>> metrics, is_acceptable = compute_blend_quality_comprehensive(
        ...     blended_pos, joint_names, transition_frame=50,
        ...     embedding_hash='0xabc123', quality_threshold=80.0
        ... )
        >>> print(f"Quality: {metrics['overall_score']:.1f}/100")
        >>> print(f"Acceptable: {is_acceptable}")
        Quality: 85.3/100
        Acceptable: True
    """
    logger.info(
        "🚀 ENTRY: compute_blend_quality_comprehensive",
        blended_positions_shape=blended_positions.shape,
        joint_names_count=len(joint_names),
        transition_frame=transition_frame,
        embedding_hash=embedding_hash,
        quality_threshold=quality_threshold,
    )

    # Default weights
    if weights is None:
        weights = {
            "velocity_continuity": 0.40,
            "acceleration_smoothness": 0.35,
            "foot_contact_stability": 0.25,
        }

    logger.info(
        "Using metric weights",
        velocity_continuity_weight=weights.get("velocity_continuity", 0),
        acceleration_smoothness_weight=weights.get("acceleration_smoothness", 0),
        foot_contact_stability_weight=weights.get("foot_contact_stability", 0),
    )

    # Compute individual metrics
    try:
        velocity = TransitionQualityMetrics.compute_velocity_continuity(
            blended_positions,
            transition_frame,
        )
        logger.info("Computed velocity continuity", score=float(velocity))

        acceleration = TransitionQualityMetrics.compute_acceleration_smoothness(
            blended_positions,
            transition_frame,
        )
        logger.info("Computed acceleration smoothness", score=float(acceleration))

        foot_contact = TransitionQualityMetrics.compute_foot_contact_stability(
            blended_positions,
            joint_names,
            transition_frame,
        )
        logger.info("Computed foot contact stability", score=float(foot_contact))

    except Exception as e:
        logger.error(
            "Metric computation failed",
            error=str(e),
            embedding_hash=embedding_hash,
        )
        msg = f"Failed to compute blend quality metrics: {e}"
        raise MetricsComputationError(msg) from e

    # Weighted combination (scale to 0-100)
    overall = (
        velocity * weights["velocity_continuity"]
        + acceleration * weights["acceleration_smoothness"]
        + foot_contact * weights["foot_contact_stability"]
    ) * 100.0

    # Determine pass/fail
    is_acceptable = overall >= quality_threshold

    # Build result dict
    result = {
        "velocity_continuity": velocity,
        "acceleration_smoothness": acceleration,
        "foot_contact_stability": foot_contact,
        "overall_score": overall,
    }

    logger.info(
        "✅ EXIT: compute_blend_quality_comprehensive",
        velocity_continuity=float(velocity),
        acceleration_smoothness=float(acceleration),
        foot_contact_stability=float(foot_contact),
        overall_score=float(overall),
        is_acceptable=is_acceptable,
        status="computed",
    )

    return result, is_acceptable
