"""
Unit Tests for Motion Blending Engine

Tests cover:
- BVH loading and saving
- Motion feature extraction and hashing
- Blend engine with quality validation
- Input validation and error handling
- Hash consistency and determinism

Run with:
    pytest tests/test_blend_engine.py -v --cov=src --cov-report=term-missing

Author: Kinetic Ledger Team
License: MIT
"""

import os
import tempfile
from pathlib import Path
from typing import Dict

import numpy as np
import pytest

# Import modules under test
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from src import bvh_utils, motion_processor, blend_engine


# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def sample_bvh_data() -> Dict:
    """
    Create minimal valid BVH motion data for testing.
    
    Returns:
        Dictionary with positions, rotations, offsets, parents, names, frametime
    """
    num_frames = 100
    num_joints = 24
    
    # Create simple walking motion (sinusoidal root trajectory)
    t = np.linspace(0, 2 * np.pi, num_frames)
    
    # Positions: only root position (num_frames, 3)
    positions = np.zeros((num_frames, 3), dtype=np.float32)
    positions[:, 0] = np.sin(t) * 0.5  # Root X (lateral sway)
    positions[:, 1] = 1.0              # Root Y (height)
    positions[:, 2] = t * 0.1          # Root Z (forward motion)
    
    # Rotations: all joints (num_frames, num_joints, 3)
    rotations = np.random.randn(num_frames, num_joints, 3).astype(np.float32) * 0.1
    
    offsets = np.random.randn(num_joints, 3).astype(np.float32) * 0.1
    offsets[0] = [0, 0, 0]  # Root offset is zero
    
    parents = np.array([-1] + list(range(num_joints - 1)), dtype=np.int32)
    
    names = [f"joint_{i}" for i in range(num_joints)]
    names[0] = "Hips"  # Root joint
    names[-2] = "LeftFoot"
    names[-1] = "RightFoot"
    
    frametime = 1.0 / 30.0  # 30 FPS
    
    return {
        'positions': positions,
        'rotations': rotations,
        'offsets': offsets,
        'parents': parents,
        'names': names,
        'frametime': frametime
    }


@pytest.fixture
def temp_bvh_file(sample_bvh_data) -> str:
    """
    Create a temporary BVH file for testing.
    
    Yields:
        Path to temporary BVH file
    """
    with tempfile.NamedTemporaryFile(mode='w', suffix='.bvh', delete=False) as f:
        filepath = f.name
    
    # Save sample data to BVH
    bvh_utils.save_bvh(filepath, sample_bvh_data)
    
    yield filepath
    
    # Cleanup
    if os.path.exists(filepath):
        os.remove(filepath)


@pytest.fixture
def two_temp_bvh_files(sample_bvh_data) -> tuple:
    """
    Create two temporary BVH files with different motions.
    
    Yields:
        Tuple of (filepath1, filepath2)
    """
    # Create first file (walking)
    with tempfile.NamedTemporaryFile(mode='w', suffix='_walk.bvh', delete=False) as f:
        filepath1 = f.name
    bvh_utils.save_bvh(filepath1, sample_bvh_data)
    
    # Create second file (running - faster motion)
    run_data = sample_bvh_data.copy()
    run_data['positions'] = sample_bvh_data['positions'] * 1.5  # Larger movements
    run_data['rotations'] = sample_bvh_data['rotations'] * 1.2
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='_run.bvh', delete=False) as f:
        filepath2 = f.name
    bvh_utils.save_bvh(filepath2, run_data)
    
    yield filepath1, filepath2
    
    # Cleanup
    for fp in [filepath1, filepath2]:
        if os.path.exists(fp):
            os.remove(fp)


# ============================================================================
# BVH Utils Tests
# ============================================================================


class TestBVHUtils:
    """Test suite for BVH loading, saving, and validation"""
    
    def test_load_bvh_success(self, temp_bvh_file):
        """Test loading a valid BVH file"""
        data = bvh_utils.load_bvh(temp_bvh_file)
        
        assert 'positions' in data
        assert 'rotations' in data
        assert 'offsets' in data
        assert 'parents' in data
        assert 'names' in data
        assert 'frametime' in data
        
        assert data['positions'].shape[0] > 0  # Has frames
        assert len(data['names']) > 0          # Has joints
    
    def test_load_bvh_nonexistent_file(self):
        """Test loading non-existent file raises error"""
        with pytest.raises(bvh_utils.BVHLoadError, match="does not exist"):
            bvh_utils.load_bvh("/nonexistent/file.bvh")
    
    def test_save_bvh_success(self, sample_bvh_data):
        """Test saving BVH data to file"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.bvh', delete=False) as f:
            filepath = f.name
        
        try:
            bvh_utils.save_bvh(filepath, sample_bvh_data)
            assert os.path.exists(filepath)
            
            # Verify can reload
            reloaded = bvh_utils.load_bvh(filepath)
            assert reloaded['positions'].shape == sample_bvh_data['positions'].shape
            assert reloaded['names'] == sample_bvh_data['names']
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    
    def test_validate_skeleton_valid(self, sample_bvh_data):
        """Test skeleton validation with valid hierarchy"""
        # Should not raise
        bvh_utils.validate_skeleton(
            sample_bvh_data['parents'],
            sample_bvh_data['names']
        )
    
    def test_validate_skeleton_invalid_root(self):
        """Test skeleton validation detects invalid root parent"""
        parents = np.array([0, 0, 1, 2])  # Root parent should be -1
        names = ["a", "b", "c", "d"]
        
        with pytest.raises(ValueError, match="Root joint.*parent.*-1"):
            bvh_utils.validate_skeleton(parents, names)
    
    def test_validate_skeleton_parent_after_child(self):
        """Test skeleton validation detects parent index >= child index"""
        parents = np.array([-1, 2, 1, 2])  # Joint 1 has parent 2 (invalid)
        names = ["a", "b", "c", "d"]
        
        with pytest.raises(ValueError, match="parent index.*must be less"):
            bvh_utils.validate_skeleton(parents, names)


# ============================================================================
# Motion Processor Tests
# ============================================================================


class TestMotionProcessor:
    """Test suite for motion feature extraction and hashing"""
    
    def test_extract_features_shape(self, sample_bvh_data):
        """Test feature extraction returns 512-D embedding"""
        velocities = motion_processor.compute_velocities(
            sample_bvh_data['positions'],
            sample_bvh_data['frametime']
        )
        
        embedding = motion_processor.extract_features(
            sample_bvh_data['positions'],
            sample_bvh_data['rotations'],
            velocities,
            sample_bvh_data['offsets']
        )
        
        assert embedding.shape == (512,)
        assert embedding.dtype == np.float32
    
    def test_extract_features_normalized(self, sample_bvh_data):
        """Test feature embedding is L2 normalized"""
        velocities = motion_processor.compute_velocities(
            sample_bvh_data['positions'],
            sample_bvh_data['frametime']
        )
        
        embedding = motion_processor.extract_features(
            sample_bvh_data['positions'],
            sample_bvh_data['rotations'],
            velocities,
            sample_bvh_data['offsets']
        )
        
        # Check L2 norm is approximately 1.0
        l2_norm = np.linalg.norm(embedding)
        assert abs(l2_norm - 1.0) < 1e-5
    
    def test_compute_hash_format(self, sample_bvh_data):
        """Test hash is 0x-prefixed hex string of correct length"""
        velocities = motion_processor.compute_velocities(
            sample_bvh_data['positions'],
            sample_bvh_data['frametime']
        )
        
        embedding = motion_processor.extract_features(
            sample_bvh_data['positions'],
            sample_bvh_data['rotations'],
            velocities,
            sample_bvh_data['offsets']
        )
        
        hash_hex = motion_processor.compute_hash(embedding)
        
        assert isinstance(hash_hex, str)
        assert hash_hex.startswith('0x')
        assert len(hash_hex) == 66  # 0x + 64 hex chars = 66
        assert all(c in '0123456789abcdef' for c in hash_hex[2:].lower())
    
    def test_compute_hash_deterministic(self, sample_bvh_data):
        """Test hash is deterministic (same input → same hash)"""
        velocities = motion_processor.compute_velocities(
            sample_bvh_data['positions'],
            sample_bvh_data['frametime']
        )
        
        embedding = motion_processor.extract_features(
            sample_bvh_data['positions'],
            sample_bvh_data['rotations'],
            velocities,
            sample_bvh_data['offsets']
        )
        
        hash1 = motion_processor.compute_hash(embedding)
        hash2 = motion_processor.compute_hash(embedding)
        
        assert hash1 == hash2
    
    def test_compute_hash_different_for_different_inputs(self, sample_bvh_data):
        """Test different embeddings produce different hashes"""
        velocities = motion_processor.compute_velocities(
            sample_bvh_data['positions'],
            sample_bvh_data['frametime']
        )
        
        embedding1 = motion_processor.extract_features(
            sample_bvh_data['positions'],
            sample_bvh_data['rotations'],
            velocities,
            sample_bvh_data['offsets']
        )
        
        # Modify positions slightly
        modified_positions = sample_bvh_data['positions'] * 1.01
        embedding2 = motion_processor.extract_features(
            modified_positions,
            sample_bvh_data['rotations'],
            velocities,
            sample_bvh_data['offsets']
        )
        
        hash1 = motion_processor.compute_hash(embedding1)
        hash2 = motion_processor.compute_hash(embedding2)
        
        assert hash1 != hash2
    
    def test_validate_sequence_valid(self, sample_bvh_data):
        """Test sequence validation with valid data"""
        # Should not raise
        is_valid = motion_processor.validate_sequence(sample_bvh_data)
        assert is_valid is True
    
    def test_validate_sequence_too_few_frames(self, sample_bvh_data):
        """Test sequence validation rejects too few frames"""
        sample_bvh_data['positions'] = sample_bvh_data['positions'][:10]  # Only 10 frames
        
        with pytest.raises(ValueError, match="frame count.*outside range"):
            motion_processor.validate_sequence(sample_bvh_data, min_frames=30)
    
    def test_validate_sequence_nan_values(self, sample_bvh_data):
        """Test sequence validation detects NaN values"""
        sample_bvh_data['positions'][0, 0, 0] = np.nan
        
        with pytest.raises(ValueError, match="NaN.*positions"):
            motion_processor.validate_sequence(sample_bvh_data)
    
    def test_compute_velocities_shape(self, sample_bvh_data):
        """Test velocity computation returns correct shape"""
        velocities = motion_processor.compute_velocities(
            sample_bvh_data['positions'],
            sample_bvh_data['frametime']
        )
        
        # Velocities should have same shape as positions
        assert velocities.shape == sample_bvh_data['positions'].shape


# ============================================================================
# Blend Engine Tests
# ============================================================================


class TestBlendEngine:
    """Test suite for motion blending with GANimator"""
    
    def test_blend_two_motions_success(self, two_temp_bvh_files):
        """Test blending two BVH files with equal weights"""
        filepath1, filepath2 = two_temp_bvh_files
        
        with tempfile.TemporaryDirectory() as temp_dir:
            result = blend_engine.blend_motions(
                source_files=[filepath1, filepath2],
                blend_weights=[0.5, 0.5],
                transition_frame=30,
                output_dir=temp_dir,
                quality_threshold=0.0  # Accept any quality for basic test
            )
            
            assert 'blended_bvh_path' in result
            assert 'embedding_hash' in result
            assert 'quality_score' in result
            assert 'metadata' in result
            
            # Verify output file exists
            assert os.path.exists(result['blended_bvh_path'])
            
            # Verify hash format
            assert result['embedding_hash'].startswith('0x')
            assert len(result['embedding_hash']) == 66
            
            # Verify quality score in range
            assert 0 <= result['quality_score'] <= 100
    
    def test_blend_hash_consistency(self, two_temp_bvh_files):
        """Test blending produces consistent hash for same inputs"""
        filepath1, filepath2 = two_temp_bvh_files
        
        with tempfile.TemporaryDirectory() as temp_dir:
            result1 = blend_engine.blend_motions(
                source_files=[filepath1, filepath2],
                blend_weights=[0.6, 0.4],
                transition_frame=40,
                output_dir=temp_dir,
                quality_threshold=0.0
            )
            
            result2 = blend_engine.blend_motions(
                source_files=[filepath1, filepath2],
                blend_weights=[0.6, 0.4],
                transition_frame=40,
                output_dir=temp_dir,
                quality_threshold=0.0
            )
            
            # Hashes should be identical for same inputs
            # Note: Due to temporal smoothing randomness, this may vary slightly
            # For exact determinism, would need to seed RNG
            assert result1['embedding_hash'] == result2['embedding_hash']
    
    def test_blend_invalid_weights_sum(self, two_temp_bvh_files):
        """Test blending rejects weights that don't sum to 1.0"""
        filepath1, filepath2 = two_temp_bvh_files
        
        with tempfile.TemporaryDirectory() as temp_dir:
            with pytest.raises(blend_engine.InvalidInputError, match="sum to 1.0"):
                blend_engine.blend_motions(
                    source_files=[filepath1, filepath2],
                    blend_weights=[0.6, 0.6],  # Sum = 1.2
                    transition_frame=30,
                    output_dir=temp_dir
                )
    
    def test_blend_invalid_weights_count(self, two_temp_bvh_files):
        """Test blending rejects mismatched weights count"""
        filepath1, filepath2 = two_temp_bvh_files
        
        with tempfile.TemporaryDirectory() as temp_dir:
            with pytest.raises(blend_engine.InvalidInputError, match="must match files"):
                blend_engine.blend_motions(
                    source_files=[filepath1, filepath2],
                    blend_weights=[1.0],  # Only 1 weight for 2 files
                    transition_frame=30,
                    output_dir=temp_dir
                )
    
    def test_blend_too_few_files(self, temp_bvh_file):
        """Test blending rejects single file (need 2-3)"""
        with tempfile.TemporaryDirectory() as temp_dir:
            with pytest.raises(blend_engine.InvalidInputError, match="2-3 source files"):
                blend_engine.blend_motions(
                    source_files=[temp_bvh_file],
                    blend_weights=[1.0],
                    transition_frame=30,
                    output_dir=temp_dir
                )
    
    def test_blend_nonexistent_file(self):
        """Test blending handles non-existent file gracefully"""
        with tempfile.TemporaryDirectory() as temp_dir:
            with pytest.raises(blend_engine.BlendEngineError, match="Failed to load"):
                blend_engine.blend_motions(
                    source_files=["/nonexistent1.bvh", "/nonexistent2.bvh"],
                    blend_weights=[0.5, 0.5],
                    transition_frame=30,
                    output_dir=temp_dir
                )
    
    def test_blend_quality_metrics_structure(self, two_temp_bvh_files):
        """Test quality metrics have expected structure"""
        filepath1, filepath2 = two_temp_bvh_files
        
        with tempfile.TemporaryDirectory() as temp_dir:
            result = blend_engine.blend_motions(
                source_files=[filepath1, filepath2],
                blend_weights=[0.5, 0.5],
                transition_frame=30,
                output_dir=temp_dir,
                quality_threshold=0.0
            )
            
            metadata = result['metadata']
            
            assert 'quality_metrics' in metadata
            metrics = metadata['quality_metrics']
            
            assert 'velocity_continuity' in metrics
            assert 'acceleration_smoothness' in metrics
            assert 'foot_contact_stability' in metrics
            assert 'overall_score' in metrics
            
            # All metrics should be non-negative
            assert metrics['velocity_continuity'] >= 0
            assert metrics['acceleration_smoothness'] >= 0
            assert metrics['foot_contact_stability'] >= 0
            assert 0 <= metrics['overall_score'] <= 100
    
    def test_create_skeleton_id_map(self):
        """Test skeleton ID map creation"""
        skeleton_map = blend_engine.create_skeleton_id_map(
            num_frames=100,
            num_joints=24,
            transition_frames=[50],
            blend_weights=[0.5, 0.5]
        )
        
        assert skeleton_map.shape == (100, 24, 2)
        assert skeleton_map.dtype == np.float32
        
        # Weights should be present
        assert np.any(skeleton_map > 0)
    
    def test_compute_blend_quality_structure(self, sample_bvh_data):
        """Test blend quality computation returns expected metrics"""
        metrics = blend_engine.compute_blend_quality(
            sample_bvh_data['positions'],
            sample_bvh_data['rotations'],
            sample_bvh_data['frametime']
        )
        
        assert 'velocity_continuity' in metrics
        assert 'acceleration_smoothness' in metrics
        assert 'foot_contact_stability' in metrics
        assert 'overall_score' in metrics
        
        assert isinstance(metrics['velocity_continuity'], float)
        assert isinstance(metrics['overall_score'], float)
        assert 0 <= metrics['overall_score'] <= 100


# ============================================================================
# Integration Tests
# ============================================================================


class TestIntegration:
    """End-to-end integration tests"""
    
    def test_full_pipeline_two_files(self, two_temp_bvh_files):
        """Test complete pipeline: load → blend → extract → hash → save"""
        filepath1, filepath2 = two_temp_bvh_files
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Execute full blend
            result = blend_engine.blend_motions(
                source_files=[filepath1, filepath2],
                blend_weights=[0.7, 0.3],
                transition_frame=35,
                output_dir=temp_dir,
                quality_threshold=50.0  # Moderate quality threshold
            )
            
            # Verify all outputs
            assert os.path.exists(result['blended_bvh_path'])
            assert result['embedding_hash'].startswith('0x')
            assert result['quality_score'] >= 50.0
            
            # Verify can reload blended file
            reloaded = bvh_utils.load_bvh(result['blended_bvh_path'])
            assert reloaded['positions'].shape[0] > 0
            
            # Extract embedding from reloaded and verify hash matches
            velocities = motion_processor.compute_velocities(
                reloaded['positions'],
                reloaded['frametime']
            )
            
            embedding = motion_processor.extract_features(
                reloaded['positions'],
                reloaded['rotations'],
                velocities,
                reloaded['offsets']
            )
            
            rehashed = motion_processor.compute_hash(embedding)
            
            # Hash should match (deterministic)
            assert rehashed == result['embedding_hash']
    
    def test_metadata_completeness(self, two_temp_bvh_files):
        """Test metadata contains all required fields"""
        filepath1, filepath2 = two_temp_bvh_files
        
        with tempfile.TemporaryDirectory() as temp_dir:
            result = blend_engine.blend_motions(
                source_files=[filepath1, filepath2],
                blend_weights=[0.5, 0.5],
                transition_frame=30,
                output_dir=temp_dir,
                quality_threshold=0.0
            )
            
            metadata = result['metadata']
            
            # Required metadata fields
            required_fields = [
                'num_sources',
                'blend_weights',
                'frame_count',
                'joint_count',
                'frametime',
                'quality_metrics',
                'processing_time_seconds'
            ]
            
            for field in required_fields:
                assert field in metadata, f"Missing metadata field: {field}"
            
            assert metadata['num_sources'] == 2
            assert metadata['blend_weights'] == [0.5, 0.5]
            assert metadata['processing_time_seconds'] > 0


# ============================================================================
# Performance Tests
# ============================================================================


class TestPerformance:
    """Performance and edge case tests"""
    
    def test_large_frame_count(self, sample_bvh_data):
        """Test blending handles large frame counts"""
        # Create large motion (500 frames)
        large_data = sample_bvh_data.copy()
        large_data['positions'] = np.tile(sample_bvh_data['positions'], (5, 1, 1))
        large_data['rotations'] = np.tile(sample_bvh_data['rotations'], (5, 1, 1))
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save to temp files
            filepath1 = os.path.join(temp_dir, "large1.bvh")
            filepath2 = os.path.join(temp_dir, "large2.bvh")
            
            bvh_utils.save_bvh(filepath1, large_data)
            bvh_utils.save_bvh(filepath2, large_data)
            
            # Should complete without error
            result = blend_engine.blend_motions(
                source_files=[filepath1, filepath2],
                blend_weights=[0.5, 0.5],
                transition_frame=100,
                output_dir=temp_dir,
                quality_threshold=0.0
            )
            
            assert result['metadata']['frame_count'] >= 500
    
    def test_different_frame_counts(self, sample_bvh_data):
        """Test blending motions with different frame counts"""
        # Create short and long motions
        short_data = sample_bvh_data.copy()
        short_data['positions'] = sample_bvh_data['positions'][:50]
        short_data['rotations'] = sample_bvh_data['rotations'][:50]
        
        long_data = sample_bvh_data.copy()
        long_data['positions'] = np.tile(sample_bvh_data['positions'], (2, 1, 1))
        long_data['rotations'] = np.tile(sample_bvh_data['rotations'], (2, 1, 1))
        
        with tempfile.TemporaryDirectory() as temp_dir:
            filepath1 = os.path.join(temp_dir, "short.bvh")
            filepath2 = os.path.join(temp_dir, "long.bvh")
            
            bvh_utils.save_bvh(filepath1, short_data)
            bvh_utils.save_bvh(filepath2, long_data)
            
            # Should blend by tiling short motion
            result = blend_engine.blend_motions(
                source_files=[filepath1, filepath2],
                blend_weights=[0.5, 0.5],
                transition_frame=30,
                output_dir=temp_dir,
                quality_threshold=0.0
            )
            
            # Output should have length of longer motion
            assert result['metadata']['frame_count'] >= 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=src", "--cov-report=term-missing"])
