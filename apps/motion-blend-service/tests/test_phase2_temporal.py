"""
Phase 2: Temporal Conditioning Tests

This module tests the skeleton ID map generation and quality metrics
for motion transitions. Tests verify verbose logging, type correctness,
and correct algorithm behavior.

Test Coverage:
- SkeletonIDMap initialization and state
- Temporal kernel generation
- Skeleton map generation with various transition frames
- Joint confidence computation
- All quality metrics (velocity, acceleration, foot contact)
- Integration test: end-to-end skeleton map → quality metrics

Run with: pytest tests/test_phase2_temporal.py -v --tb=short

Author: Kinetic Ledger Team
License: MIT
"""

import sys
from pathlib import Path

import numpy as np
import pytest
import structlog

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from quality_metrics import (
    TransitionQualityMetrics,
    compute_blend_quality_comprehensive,
)
from skeleton_id_map import (
    InvalidEmbeddingError,
    SkeletonIDMap,
)

logger = structlog.get_logger(__name__)


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def skeleton_map_gen():
    """Create SkeletonIDMap generator for 24-joint skeleton."""
    logger.info("🚀 FIXTURE: skeleton_map_gen")
    gen = SkeletonIDMap(num_joints=24, embedding_dim=512, seed=42)
    logger.info("✅ FIXTURE: skeleton_map_gen created")
    return gen


@pytest.fixture
def sample_embeddings():
    """Create sample source and target embeddings."""
    logger.info("🚀 FIXTURE: sample_embeddings")
    np.random.seed(42)
    source = np.random.randn(24, 512).astype(np.float32)
    target = np.random.randn(24, 512).astype(np.float32)
    logger.info("✅ FIXTURE: sample_embeddings created")
    return {"source": source, "target": target}


@pytest.fixture
def sample_motion_positions():
    """Create sample motion positions [frames, joints, 3]."""
    logger.info("🚀 FIXTURE: sample_motion_positions")
    np.random.seed(42)
    positions = np.random.randn(100, 24, 3).astype(np.float32)
    logger.info("✅ FIXTURE: sample_motion_positions created")
    return positions


@pytest.fixture
def joint_names():
    """Create standard joint names for 24-joint skeleton."""
    logger.info("🚀 FIXTURE: joint_names")
    names = [
        "Hips",
        "Chest",
        "Neck",
        "Head",
        "LeftShoulder",
        "LeftArm",
        "LeftForeArm",
        "LeftHand",
        "RightShoulder",
        "RightArm",
        "RightForeArm",
        "RightHand",
        "LeftUpLeg",
        "LeftLeg",
        "LeftFoot",
        "LeftToeBase",
        "RightUpLeg",
        "RightLeg",
        "RightFoot",
        "RightToeBase",
        "Spine",
        "Spine1",
        "Spine2",
        "End",
    ]
    assert len(names) == 24, f"Expected 24 joint names, got {len(names)}"
    logger.info("✅ FIXTURE: joint_names created")
    return names


# ============================================================================
# SkeletonIDMap Tests
# ============================================================================


class TestSkeletonIDMapInitialization:
    """Test SkeletonIDMap initialization and state."""

    def test_initialization_default_params(self):
        """Test SkeletonIDMap initialization with default parameters."""
        logger.info("🚀 TEST: test_initialization_default_params")

        gen = SkeletonIDMap(num_joints=24)

        assert gen.num_joints == 24
        assert gen.embedding_dim == 512
        assert gen.skeleton_embeddings.shape == (24, 512)
        assert gen.skeleton_embeddings.dtype == np.float32
        assert gen.temporal_smoothing is not None
        assert len(gen.temporal_smoothing) > 0

        logger.info("✅ TEST: test_initialization_default_params passed")

    def test_initialization_custom_params(self):
        """Test SkeletonIDMap initialization with custom parameters."""
        logger.info("🚀 TEST: test_initialization_custom_params")

        gen = SkeletonIDMap(
            num_joints=16,
            embedding_dim=256,
            seed=123,
            temporal_kernel_size=7,
        )

        assert gen.num_joints == 16
        assert gen.embedding_dim == 256
        assert gen.skeleton_embeddings.shape == (16, 256)
        assert gen.temporal_kernel_size == 7

        logger.info("✅ TEST: test_initialization_custom_params passed")

    def test_initialization_deterministic(self):
        """Test that initialization with same seed is deterministic."""
        logger.info("🚀 TEST: test_initialization_deterministic")

        gen1 = SkeletonIDMap(num_joints=24, seed=42)
        gen2 = SkeletonIDMap(num_joints=24, seed=42)

        np.testing.assert_array_almost_equal(
            gen1.skeleton_embeddings,
            gen2.skeleton_embeddings,
        )

        logger.info("✅ TEST: test_initialization_deterministic passed")

    def test_invalid_num_joints(self):
        """Test that invalid num_joints raises ValueError."""
        logger.info("🚀 TEST: test_invalid_num_joints")

        with pytest.raises(ValueError):
            SkeletonIDMap(num_joints=0)

        with pytest.raises(ValueError):
            SkeletonIDMap(num_joints=-1)

        logger.info("✅ TEST: test_invalid_num_joints passed")

    def test_invalid_embedding_dim(self):
        """Test that invalid embedding_dim raises ValueError."""
        logger.info("🚀 TEST: test_invalid_embedding_dim")

        with pytest.raises(ValueError):
            SkeletonIDMap(num_joints=24, embedding_dim=0)

        with pytest.raises(ValueError):
            SkeletonIDMap(num_joints=24, embedding_dim=-1)

        logger.info("✅ TEST: test_invalid_embedding_dim passed")


class TestTemporalKernelGeneration:
    """Test temporal kernel generation."""

    def test_kernel_shape(self, skeleton_map_gen):
        """Test that temporal kernel has correct shape."""
        logger.info("🚀 TEST: test_kernel_shape")

        kernel = skeleton_map_gen.temporal_smoothing

        assert kernel.ndim == 1
        assert len(kernel) == skeleton_map_gen.temporal_kernel_size

        logger.info("✅ TEST: test_kernel_shape passed")

    def test_kernel_normalization(self, skeleton_map_gen):
        """Test that temporal kernel sums to 1.0."""
        logger.info("🚀 TEST: test_kernel_normalization")

        kernel = skeleton_map_gen.temporal_smoothing
        kernel_sum = np.sum(kernel)

        np.testing.assert_almost_equal(kernel_sum, 1.0, decimal=6)

        logger.info("✅ TEST: test_kernel_normalization passed")

    def test_kernel_gaussian(self, skeleton_map_gen):
        """Test that kernel is Gaussian (symmetric, peak at center)."""
        logger.info("🚀 TEST: test_kernel_gaussian")

        kernel = skeleton_map_gen.temporal_smoothing
        center = len(kernel) // 2

        # Peak should be at center
        assert kernel[center] == np.max(kernel)

        # Symmetric
        for i in range(1, center):
            np.testing.assert_almost_equal(
                kernel[center - i],
                kernel[center + i],
                decimal=6,
            )

        logger.info("✅ TEST: test_kernel_gaussian passed")


class TestSkeletonMapGeneration:
    """Test skeleton ID map generation."""

    def test_generate_map_shape(self, skeleton_map_gen, sample_embeddings):
        """Test that generated skeleton map has correct shape."""
        logger.info("🚀 TEST: test_generate_map_shape")

        skeleton_map = skeleton_map_gen.generate_map(
            sample_embeddings["source"],
            sample_embeddings["target"],
            transition_frames=10,
        )

        assert skeleton_map.shape == (10, 24, 512)
        assert skeleton_map.dtype == np.float32

        logger.info("✅ TEST: test_generate_map_shape passed")

    def test_generate_map_deterministic(self, skeleton_map_gen, sample_embeddings):
        """Test that generating same map is deterministic."""
        logger.info("🚀 TEST: test_generate_map_deterministic")

        map1 = skeleton_map_gen.generate_map(
            sample_embeddings["source"],
            sample_embeddings["target"],
            transition_frames=10,
        )
        map2 = skeleton_map_gen.generate_map(
            sample_embeddings["source"],
            sample_embeddings["target"],
            transition_frames=10,
        )

        np.testing.assert_array_almost_equal(map1, map2, decimal=6)

        logger.info("✅ TEST: test_generate_map_deterministic passed")

    def test_generate_map_various_transition_frames(
        self,
        skeleton_map_gen,
        sample_embeddings,
    ):
        """Test skeleton map generation with various transition frames."""
        logger.info("🚀 TEST: test_generate_map_various_transition_frames")

        for transition_frames in [5, 10, 20, 50]:
            skeleton_map = skeleton_map_gen.generate_map(
                sample_embeddings["source"],
                sample_embeddings["target"],
                transition_frames=transition_frames,
            )

            assert skeleton_map.shape[0] == transition_frames
            logger.info(
                "Generated skeleton map",
                transition_frames=transition_frames,
                output_shape=skeleton_map.shape,
            )

        logger.info(
            "✅ TEST: test_generate_map_various_transition_frames passed"
        )

    def test_generate_map_invalid_embedding_shape(self, skeleton_map_gen):
        """Test that invalid embedding shape raises InvalidEmbeddingError."""
        logger.info("🚀 TEST: test_generate_map_invalid_embedding_shape")

        # Wrong dimensionality
        with pytest.raises(InvalidEmbeddingError):
            skeleton_map_gen.generate_map(
                np.random.randn(24),  # 1D instead of 2D
                np.random.randn(24, 512),
                transition_frames=10,
            )

        # Wrong embedding dimension
        with pytest.raises(InvalidEmbeddingError):
            skeleton_map_gen.generate_map(
                np.random.randn(24, 256),  # 256 instead of 512
                np.random.randn(24, 512),
                transition_frames=10,
            )

        # NaN values
        source_with_nan = np.random.randn(24, 512)
        source_with_nan[0, 0] = np.nan
        with pytest.raises(InvalidEmbeddingError):
            skeleton_map_gen.generate_map(
                source_with_nan,
                np.random.randn(24, 512),
                transition_frames=10,
            )

        logger.info("✅ TEST: test_generate_map_invalid_embedding_shape passed")

    def test_generate_map_invalid_transition_frames(
        self,
        skeleton_map_gen,
        sample_embeddings,
    ):
        """Test that invalid transition_frames raises ValueError."""
        logger.info("🚀 TEST: test_generate_map_invalid_transition_frames")

        with pytest.raises(ValueError):
            skeleton_map_gen.generate_map(
                sample_embeddings["source"],
                sample_embeddings["target"],
                transition_frames=0,
            )

        with pytest.raises(ValueError):
            skeleton_map_gen.generate_map(
                sample_embeddings["source"],
                sample_embeddings["target"],
                transition_frames=-1,
            )

        logger.info(
            "✅ TEST: test_generate_map_invalid_transition_frames passed"
        )


class TestJointConfidence:
    """Test joint confidence computation."""

    def test_confidence_shape(self, skeleton_map_gen, sample_embeddings):
        """Test that confidence has correct shape."""
        logger.info("🚀 TEST: test_confidence_shape")

        skeleton_map = skeleton_map_gen.generate_map(
            sample_embeddings["source"],
            sample_embeddings["target"],
            transition_frames=10,
        )

        confidence = skeleton_map_gen.compute_joint_confidence(skeleton_map)

        assert confidence.shape == (24,)
        assert confidence.dtype == np.float32

        logger.info("✅ TEST: test_confidence_shape passed")

    def test_confidence_range(self, skeleton_map_gen, sample_embeddings):
        """Test that confidence values are in valid range."""
        logger.info("🚀 TEST: test_confidence_range")

        skeleton_map = skeleton_map_gen.generate_map(
            sample_embeddings["source"],
            sample_embeddings["target"],
            transition_frames=10,
        )

        confidence = skeleton_map_gen.compute_joint_confidence(skeleton_map)

        assert np.all(confidence > 0.0), "Confidence should be > 0"
        assert np.all(confidence <= 1.0), "Confidence should be <= 1"

        logger.info("✅ TEST: test_confidence_range passed")

    def test_confidence_inverse_variance(self, skeleton_map_gen):
        """Test that confidence is inversely related to variance."""
        logger.info("🚀 TEST: test_confidence_inverse_variance")

        # Create skeleton map with high variance in first joint
        skeleton_map = np.random.randn(10, 24, 512).astype(np.float32)
        skeleton_map[:, 0, :] = skeleton_map[:, 0, :] * 100  # High variance
        skeleton_map[:, 1, :] = np.mean(skeleton_map[:, 1, :])  # Low variance

        confidence = skeleton_map_gen.compute_joint_confidence(skeleton_map)

        # Joint 1 (low variance) should have higher confidence than joint 0
        assert confidence[1] > confidence[0]

        logger.info("✅ TEST: test_confidence_inverse_variance passed")


# ============================================================================
# Quality Metrics Tests
# ============================================================================


class TestQualityMetrics:
    """Test quality metric computation."""

    def test_velocity_continuity_high(self, sample_motion_positions):
        """Test velocity continuity with smooth motion."""
        logger.info("🚀 TEST: test_velocity_continuity_high")

        # Create smooth motion (low velocity changes)
        smooth_positions = sample_motion_positions.copy()
        smooth_positions[50:55] = np.linspace(
            smooth_positions[49],
            smooth_positions[56],
            5,
        )

        score = TransitionQualityMetrics.compute_velocity_continuity(
            smooth_positions,
            transition_frame=52,
            window=5,
        )

        assert 0.0 <= score <= 1.0
        logger.info("Velocity continuity score", score=float(score))

        logger.info("✅ TEST: test_velocity_continuity_high passed")

    def test_acceleration_smoothness(self, sample_motion_positions):
        """Test acceleration smoothness computation."""
        logger.info("🚀 TEST: test_acceleration_smoothness")

        score = TransitionQualityMetrics.compute_acceleration_smoothness(
            sample_motion_positions,
            transition_frame=50,
            window=5,
        )

        assert 0.0 <= score <= 1.0
        logger.info("Acceleration smoothness score", score=float(score))

        logger.info("✅ TEST: test_acceleration_smoothness passed")

    def test_foot_contact_stability(self, sample_motion_positions, joint_names):
        """Test foot contact stability computation."""
        logger.info("🚀 TEST: test_foot_contact_stability")

        # Set foot positions above ground (Y > 0.01)
        sample_motion_positions[:, 14, 1] = 0.1  # LeftFoot
        sample_motion_positions[:, 18, 1] = 0.1  # RightFoot

        score = TransitionQualityMetrics.compute_foot_contact_stability(
            sample_motion_positions,
            joint_names,
            transition_frame=50,
            window=5,
            threshold=0.01,
        )

        assert 0.0 <= score <= 1.0
        assert score > 0.7  # Should be high (feet above ground)

        logger.info("Foot contact stability score", score=float(score))
        logger.info("✅ TEST: test_foot_contact_stability passed")

    def test_foot_contact_stability_no_feet(self, sample_motion_positions):
        """Test foot contact stability with joints that don't have feet."""
        logger.info("🚀 TEST: test_foot_contact_stability_no_feet")

        # Joint names without 'foot' or 'ankle'
        joint_names_no_feet = [f"Joint_{i}" for i in range(24)]

        score = TransitionQualityMetrics.compute_foot_contact_stability(
            sample_motion_positions,
            joint_names_no_feet,
            transition_frame=50,
        )

        # Should return neutral score when no feet found
        assert score == 0.5

        logger.info("✅ TEST: test_foot_contact_stability_no_feet passed")


class TestComprehensiveQuality:
    """Test comprehensive quality metric computation."""

    def test_comprehensive_quality(
        self,
        sample_motion_positions,
        joint_names,
    ):
        """Test comprehensive quality metric computation."""
        logger.info("🚀 TEST: test_comprehensive_quality")

        metrics, is_acceptable = compute_blend_quality_comprehensive(
            sample_motion_positions,
            joint_names,
            transition_frame=50,
            embedding_hash="0xabc123",
            quality_threshold=50.0,
        )

        # Verify all metrics are present
        assert "velocity_continuity" in metrics
        assert "acceleration_smoothness" in metrics
        assert "foot_contact_stability" in metrics
        assert "overall_score" in metrics

        # Verify value ranges
        assert 0.0 <= metrics["velocity_continuity"] <= 1.0
        assert 0.0 <= metrics["acceleration_smoothness"] <= 1.0
        assert 0.0 <= metrics["foot_contact_stability"] <= 1.0
        assert 0.0 <= metrics["overall_score"] <= 100.0

        # Verify is_acceptable logic
        if metrics["overall_score"] >= 50.0:
            assert is_acceptable
        else:
            assert not is_acceptable

        logger.info(
            "Comprehensive quality metrics",
            metrics=metrics,
            is_acceptable=is_acceptable,
        )
        logger.info("✅ TEST: test_comprehensive_quality passed")


# ============================================================================
# Integration Tests
# ============================================================================


class TestIntegration:
    """End-to-end integration tests."""

    def test_skeleton_map_to_quality_pipeline(
        self,
        skeleton_map_gen,
        sample_embeddings,
        sample_motion_positions,
        joint_names,
    ):
        """Test full pipeline: skeleton map → quality metrics."""
        logger.info("🚀 TEST: test_skeleton_map_to_quality_pipeline")

        # Generate skeleton map
        skeleton_map = skeleton_map_gen.generate_map(
            sample_embeddings["source"],
            sample_embeddings["target"],
            transition_frames=20,
        )

        logger.info("Generated skeleton map", skeleton_map_shape=skeleton_map.shape)

        # Compute confidence
        confidence = skeleton_map_gen.compute_joint_confidence(skeleton_map)

        logger.info(
            "Computed confidence",
            confidence_mean=float(np.mean(confidence)),
        )

        # Compute quality metrics on blended motion
        metrics, is_acceptable = compute_blend_quality_comprehensive(
            sample_motion_positions,
            joint_names,
            transition_frame=50,
            embedding_hash="0xintegration_test",
            quality_threshold=30.0,  # Low threshold to ensure acceptance
        )

        logger.info(
            "✅ TEST: test_skeleton_map_to_quality_pipeline passed",
            overall_quality=metrics["overall_score"],
        )


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
