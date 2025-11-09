"""
Motion Embedding Processor

Extracts motion features and generates cryptographic hashes for on-chain attestation.
Converts BVH motion data to 512-dimensional embeddings compatible with novelty detection.

Author: Kinetic Ledger Team
Date: 2025-11-09
"""

import logging
from typing import Dict, List

import numpy as np
from eth_utils import keccak
from web3 import Web3

# Configure logger
logger = logging.getLogger(__name__)


class MotionProcessingError(Exception):
    """Raised when motion processing fails."""
    pass


def extract_features(
    positions: np.ndarray,
    rotations: np.ndarray,
    velocities: np.ndarray,
    offsets: np.ndarray,
) -> np.ndarray:
    """
    Extract 512-dimensional feature embedding from motion data.
    
    This function converts raw BVH motion data into a fixed-size embedding
    suitable for novelty detection and on-chain verification.
    
    Args:
        positions: np.ndarray [T, 3] - Root positions over time
        rotations: np.ndarray [T, J, 3] - Joint rotations (euler angles in degrees)
        velocities: np.ndarray [T, J, 3] - Joint velocities
        offsets: np.ndarray [J, 3] - Joint offsets from parent
        
    Returns:
        np.ndarray [512] - Feature embedding vector
        
    Raises:
        MotionProcessingError: If feature extraction fails
        ValueError: If input dimensions are invalid
        
    Example:
        >>> embedding = extract_features(positions, rotations, velocities, offsets)
        >>> assert embedding.shape == (512,)
    """
    logger.debug(
        f"🚀 ENTRY: extract_features("
        f"positions={positions.shape}, "
        f"rotations={rotations.shape}, "
        f"velocities={velocities.shape}, "
        f"offsets={offsets.shape})"
    )
    
    try:
        num_frames, num_joints, _ = rotations.shape
        
        # Validate inputs
        if positions.shape[0] != num_frames:
            raise ValueError(f"Position frames {positions.shape[0]} != rotation frames {num_frames}")
        if velocities.shape != rotations.shape:
            raise ValueError(f"Velocity shape {velocities.shape} != rotation shape {rotations.shape}")
        if offsets.shape[0] != num_joints:
            raise ValueError(f"Offset joints {offsets.shape[0]} != rotation joints {num_joints}")
        
        logger.trace(f"   Validated inputs: {num_frames} frames, {num_joints} joints")
        
        # Extract temporal features (mean, std, min, max over time)
        features = []
        
        # 1. Root trajectory features (12 dims)
        # Mean, std, min, max for x, y, z
        for dim in range(3):
            features.extend([
                np.mean(positions[:, dim]),
                np.std(positions[:, dim]),
                np.min(positions[:, dim]),
                np.max(positions[:, dim]),
            ])
        logger.trace(f"   Extracted root trajectory features: {len(features)} dims")
        
        # 2. Joint rotation statistics (per joint: 12 dims x num_joints)
        for joint in range(num_joints):
            for dim in range(3):  # x, y, z rotations
                rot_values = rotations[:, joint, dim]
                features.extend([
                    np.mean(rot_values),
                    np.std(rot_values),
                    np.min(rot_values),
                    np.max(rot_values),
                ])
        logger.trace(f"   Extracted joint rotation features: {len(features)} dims")
        
        # 3. Velocity features (per joint: 12 dims x num_joints)
        for joint in range(num_joints):
            for dim in range(3):
                vel_values = velocities[:, joint, dim]
                features.extend([
                    np.mean(vel_values),
                    np.std(vel_values),
                    np.min(vel_values),
                    np.max(vel_values),
                ])
        logger.trace(f"   Extracted velocity features: {len(features)} dims")
        
        # 4. Skeleton structure features (num_joints x 3 for offsets)
        features.extend(offsets.flatten().tolist())
        logger.trace(f"   Extracted skeleton features: {len(features)} dims")
        
        # Convert to numpy array
        feature_array = np.array(features, dtype=np.float32)
        
        # Pad or truncate to exactly 512 dimensions
        if len(feature_array) < 512:
            # Pad with zeros
            padding = np.zeros(512 - len(feature_array), dtype=np.float32)
            feature_array = np.concatenate([feature_array, padding])
            logger.debug(f"   Padded features to 512 dims (was {len(features)})")
        elif len(feature_array) > 512:
            # Truncate
            feature_array = feature_array[:512]
            logger.debug(f"   Truncated features to 512 dims (was {len(features)})")
        
        # Normalize to unit length (L2 norm)
        norm = np.linalg.norm(feature_array)
        if norm > 0:
            feature_array = feature_array / norm
            logger.trace(f"   Normalized features (L2 norm = 1.0)")
        
        logger.info(
            f"✅ EXIT: extract_features - "
            f"Extracted {feature_array.shape[0]}-D embedding from "
            f"{num_frames} frames, {num_joints} joints"
        )
        
        return feature_array
        
    except Exception as e:
        logger.error(f"❌ EXIT: extract_features - Error: {str(e)}")
        raise MotionProcessingError(f"Feature extraction failed: {str(e)}")


def compute_hash(embedding: np.ndarray) -> str:
    """
    Compute keccak256 hash of motion embedding for on-chain verification.
    
    Args:
        embedding: np.ndarray [512] - Feature embedding vector
        
    Returns:
        str - Hex-encoded hash with '0x' prefix (66 characters)
        
    Raises:
        ValueError: If embedding has wrong shape
        
    Example:
        >>> embedding = np.random.rand(512).astype(np.float32)
        >>> hash_value = compute_hash(embedding)
        >>> assert hash_value.startswith('0x')
        >>> assert len(hash_value) == 66  # 0x + 64 hex chars
    """
    logger.debug(f"🚀 ENTRY: compute_hash(embedding.shape={embedding.shape})")
    
    if embedding.shape != (512,):
        logger.error(f"❌ EXIT: compute_hash - Invalid shape {embedding.shape}, expected (512,)")
        raise ValueError(f"Embedding must be shape (512,), got {embedding.shape}")
    
    try:
        # Convert float32 array to bytes
        # Scale to integers to preserve precision (multiply by 1e6)
        scaled = (embedding * 1e6).astype(np.int64)
        
        # Pack as bytes (8 bytes per int64)
        embedding_bytes = scaled.tobytes()
        
        # Compute keccak256 hash
        hash_bytes = keccak(embedding_bytes)
        
        # Convert to hex with 0x prefix
        hash_hex = '0x' + hash_bytes.hex()
        
        logger.info(
            f"✅ EXIT: compute_hash - "
            f"Hash: {hash_hex[:10]}...{hash_hex[-8:]} "
            f"(from {len(embedding_bytes)} bytes)"
        )
        
        return hash_hex
        
    except Exception as e:
        logger.error(f"❌ EXIT: compute_hash - Error: {str(e)}")
        raise MotionProcessingError(f"Hash computation failed: {str(e)}")


def validate_sequence(
    data: Dict[str, np.ndarray],
    min_frames: int = 30,
    max_frames: int = 600,
    required_joints: int = 20,
) -> bool:
    """
    Validate motion sequence meets quality and format requirements.
    
    Args:
        data: Motion data dictionary with keys: positions, rotations, names, parents
        min_frames: Minimum number of frames required
        max_frames: Maximum number of frames allowed
        required_joints: Minimum number of joints required
        
    Returns:
        bool - True if valid
        
    Raises:
        ValueError: If validation fails with specific reason
        
    Example:
        >>> is_valid = validate_sequence(motion_data, min_frames=60)
        >>> assert is_valid == True
    """
    logger.debug(
        f"🚀 ENTRY: validate_sequence("
        f"min_frames={min_frames}, "
        f"max_frames={max_frames}, "
        f"required_joints={required_joints})"
    )
    
    try:
        # Check required keys
        required_keys = ['positions', 'rotations', 'names', 'parents']
        for key in required_keys:
            if key not in data:
                logger.error(f"❌ EXIT: validate_sequence - Missing key: {key}")
                raise ValueError(f"Motion data missing required key: {key}")
        
        positions = data['positions']
        rotations = data['rotations']
        names = data['names']
        parents = data['parents']
        
        # Validate frame count
        num_frames = positions.shape[0]
        if num_frames < min_frames:
            logger.error(
                f"❌ EXIT: validate_sequence - "
                f"Too few frames: {num_frames} < {min_frames}"
            )
            raise ValueError(f"Motion has only {num_frames} frames, minimum is {min_frames}")
        
        if num_frames > max_frames:
            logger.error(
                f"❌ EXIT: validate_sequence - "
                f"Too many frames: {num_frames} > {max_frames}"
            )
            raise ValueError(f"Motion has {num_frames} frames, maximum is {max_frames}")
        
        logger.trace(f"   Frame count OK: {num_frames}")
        
        # Validate joint count
        num_joints = len(names)
        if num_joints < required_joints:
            logger.error(
                f"❌ EXIT: validate_sequence - "
                f"Too few joints: {num_joints} < {required_joints}"
            )
            raise ValueError(f"Motion has only {num_joints} joints, minimum is {required_joints}")
        
        logger.trace(f"   Joint count OK: {num_joints}")
        
        # Validate rotation shape matches
        expected_rot_shape = (num_frames, num_joints, 3)
        if rotations.shape != expected_rot_shape:
            logger.error(
                f"❌ EXIT: validate_sequence - "
                f"Rotation shape mismatch: {rotations.shape} != {expected_rot_shape}"
            )
            raise ValueError(
                f"Rotation shape {rotations.shape} doesn't match expected {expected_rot_shape}"
            )
        
        logger.trace(f"   Rotation shape OK: {rotations.shape}")
        
        # Validate parent array length
        if len(parents) != num_joints:
            logger.error(
                f"❌ EXIT: validate_sequence - "
                f"Parent array length {len(parents)} != joints {num_joints}"
            )
            raise ValueError(
                f"Parent array length {len(parents)} doesn't match joint count {num_joints}"
            )
        
        logger.trace(f"   Parent array OK: {len(parents)} entries")
        
        # Check for NaN or Inf values
        if np.any(np.isnan(positions)) or np.any(np.isinf(positions)):
            logger.error(f"❌ EXIT: validate_sequence - Positions contain NaN or Inf")
            raise ValueError("Positions contain NaN or Inf values")
        
        if np.any(np.isnan(rotations)) or np.any(np.isinf(rotations)):
            logger.error(f"❌ EXIT: validate_sequence - Rotations contain NaN or Inf")
            raise ValueError("Rotations contain NaN or Inf values")
        
        logger.trace(f"   No NaN/Inf values detected")
        
        logger.info(
            f"✅ EXIT: validate_sequence - "
            f"Sequence is valid ({num_frames} frames, {num_joints} joints)"
        )
        
        return True
        
    except Exception as e:
        logger.error(f"❌ EXIT: validate_sequence - Validation error: {str(e)}")
        raise


def compute_velocities(
    positions: np.ndarray,
    frametime: float,
) -> np.ndarray:
    """
    Compute velocities from positions using finite differences.
    
    Args:
        positions: np.ndarray [T, J, 3] - Joint positions over time
        frametime: float - Time between frames in seconds
        
    Returns:
        np.ndarray [T, J, 3] - Joint velocities
        
    Example:
        >>> velocities = compute_velocities(positions, frametime=1/30)
        >>> assert velocities.shape == positions.shape
    """
    logger.debug(f"🚀 ENTRY: compute_velocities(shape={positions.shape}, frametime={frametime})")
    
    try:
        # Compute finite differences
        velocities = np.zeros_like(positions)
        
        # Forward difference for all frames except last
        velocities[:-1] = (positions[1:] - positions[:-1]) / frametime
        
        # Copy last velocity for final frame
        velocities[-1] = velocities[-2]
        
        logger.info(
            f"✅ EXIT: compute_velocities - "
            f"Computed velocities for {positions.shape[0]} frames"
        )
        
        return velocities
        
    except Exception as e:
        logger.error(f"❌ EXIT: compute_velocities - Error: {str(e)}")
        raise MotionProcessingError(f"Velocity computation failed: {str(e)}")
