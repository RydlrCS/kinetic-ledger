"""
BVH (BioVision Hierarchy) File I/O Utilities

Handles loading and saving motion capture data in BVH format.
Supports both Euler angles and quaternion representations.

Author: Kinetic Ledger Team
Date: 2025-11-09
"""

import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from scipy.spatial.transform import Rotation as R

# Configure logger
logger = logging.getLogger(__name__)


class BVHLoadError(Exception):
    """Raised when BVH file loading fails."""
    pass


class BVHSaveError(Exception):
    """Raised when BVH file saving fails."""
    pass


def load_bvh(
    filepath: str,
    scale: float = 1.0,
) -> Dict[str, np.ndarray]:
    """
    Load BVH motion capture file and extract skeleton hierarchy and motion data.
    
    Args:
        filepath: Path to BVH file
        scale: Scaling factor for positions (default: 1.0)
        
    Returns:
        Dictionary containing:
            - positions: np.ndarray [T, 3] - Root position per frame
            - rotations: np.ndarray [T, J, 3] - Euler angles (degrees) per joint per frame
            - offsets: np.ndarray [J, 3] - Joint offsets from parent
            - parents: np.ndarray [J] - Parent joint indices (-1 for root)
            - names: List[str] - Joint names
            - frametime: float - Time per frame in seconds
            
    Raises:
        BVHLoadError: If file cannot be loaded or parsed
        FileNotFoundError: If file does not exist
        
    Example:
        >>> data = load_bvh("motion.bvh", scale=0.01)
        >>> print(f"Frames: {data['positions'].shape[0]}")
        >>> print(f"Joints: {len(data['names'])}")
    """
    logger.debug(f"🚀 ENTRY: load_bvh(filepath={filepath}, scale={scale})")
    
    filepath_obj = Path(filepath)
    if not filepath_obj.exists():
        logger.error(f"❌ EXIT: load_bvh - File not found: {filepath}")
        raise FileNotFoundError(f"BVH file not found: {filepath}")
    
    try:
        with open(filepath, 'r') as f:
            lines = f.readlines()
        
        # Parse hierarchy section
        names: List[str] = []
        offsets = np.array([]).reshape((0, 3))
        parents = np.array([], dtype=int)
        
        i = 0
        active = -1  # Current parent index
        end_site = False
        
        # Parse HIERARCHY section
        while i < len(lines):
            line = lines[i].strip()
            
            if "MOTION" in line:
                break
                
            # Parse ROOT joint
            rmatch = re.match(r"ROOT (\w+:?\w+)", line)
            if rmatch:
                names.append(rmatch.group(1))
                offsets = np.append(offsets, np.array([[0, 0, 0]]), axis=0)
                parents = np.append(parents, active)
                active = len(parents) - 1
                logger.debug(f"   Parsed ROOT: {names[-1]}, index={active}")
                i += 1
                continue
            
            # Parse JOINT
            jmatch = re.match(r"\s*JOINT (\w+:?\w+)", line)
            if jmatch:
                names.append(jmatch.group(1))
                offsets = np.append(offsets, np.array([[0, 0, 0]]), axis=0)
                parents = np.append(parents, active)
                active = len(parents) - 1
                logger.debug(f"   Parsed JOINT: {names[-1]}, parent={parents[-1]}")
                i += 1
                continue
            
            # Parse OFFSET
            offmatch = re.match(r"\s*OFFSET\s+([\-\d\.e]+)\s+([\-\d\.e]+)\s+([\-\d\.e]+)", line)
            if offmatch:
                offsets[-1] = np.array([float(offmatch.group(1)), 
                                       float(offmatch.group(2)), 
                                       float(offmatch.group(3))])
                i += 1
                continue
            
            # Handle End Site
            if "End Site" in line:
                end_site = True
                i += 1
                continue
            
            # Handle braces
            if "{" in line:
                i += 1
                continue
                
            if "}" in line:
                if end_site:
                    end_site = False
                else:
                    active = int(parents[active])
                i += 1
                continue
            
            i += 1
        
        # Parse MOTION section
        num_frames = 0
        frametime = 0.0
        
        while i < len(lines):
            line = lines[i].strip()
            
            fmatch = re.match(r"Frames:\s+(\d+)", line)
            if fmatch:
                num_frames = int(fmatch.group(1))
                logger.debug(f"   Frames: {num_frames}")
                i += 1
                continue
            
            tmatch = re.match(r"Frame Time:\s+([\d\.]+)", line)
            if tmatch:
                frametime = float(tmatch.group(1))
                logger.debug(f"   Frame Time: {frametime}s")
                i += 1
                break
        
        # Parse motion data
        positions = np.zeros((num_frames, 3))
        rotations = np.zeros((num_frames, len(names), 3))
        
        frame_idx = 0
        i += 1  # Move to first data line
        
        while i < len(lines) and frame_idx < num_frames:
            line = lines[i].strip()
            if not line:
                i += 1
                continue
                
            values = list(map(float, line.split()))
            
            # Root position (first 3 values)
            positions[frame_idx] = np.array(values[0:3]) * scale
            
            # Joint rotations (remaining values, 3 per joint)
            rot_values = values[3:]
            num_joints = len(names)
            
            for j in range(num_joints):
                start_idx = j * 3
                rotations[frame_idx, j] = rot_values[start_idx:start_idx + 3]
            
            frame_idx += 1
            i += 1
        
        logger.info(
            f"✅ EXIT: load_bvh - Loaded {frame_idx} frames, "
            f"{len(names)} joints from {filepath}"
        )
        
        return {
            'positions': positions.astype(np.float32),
            'rotations': rotations.astype(np.float32),
            'offsets': (offsets * scale).astype(np.float32),
            'parents': parents,
            'names': names,
            'frametime': frametime,
        }
        
    except Exception as e:
        logger.error(f"❌ EXIT: load_bvh - Error parsing BVH: {str(e)}")
        raise BVHLoadError(f"Failed to parse BVH file {filepath}: {str(e)}")


def save_bvh(
    filepath: str,
    data: Dict[str, np.ndarray],
    precision: int = 6,
) -> None:
    """
    Save motion data to BVH file format.
    
    Args:
        filepath: Output file path
        data: Dictionary with keys: positions, rotations, offsets, parents, names, frametime
        precision: Decimal places for floating point values
        
    Raises:
        BVHSaveError: If file cannot be written
        
    Example:
        >>> save_bvh("output.bvh", motion_data, precision=4)
    """
    logger.debug(f"🚀 ENTRY: save_bvh(filepath={filepath}, precision={precision})")
    
    try:
        positions = data['positions']
        rotations = data['rotations']
        offsets = data['offsets']
        parents = data['parents']
        names = data['names']
        frametime = data['frametime']
        
        num_frames = positions.shape[0]
        num_joints = len(names)
        
        logger.debug(f"   Writing {num_frames} frames, {num_joints} joints")
        
        with open(filepath, 'w') as f:
            # Write HIERARCHY section
            f.write("HIERARCHY\n")
            _write_hierarchy(f, 0, names, parents, offsets, precision)
            
            # Write MOTION section
            f.write("MOTION\n")
            f.write(f"Frames: {num_frames}\n")
            f.write(f"Frame Time: {frametime}\n")
            
            # Write motion data
            for frame in range(num_frames):
                # Root position
                pos = positions[frame]
                f.write(f"{float(pos[0]):.{precision}f} {float(pos[1]):.{precision}f} {float(pos[2]):.{precision}f} ")
                
                # Joint rotations
                for joint in range(num_joints):
                    rot = rotations[frame, joint]
                    f.write(f"{float(rot[0]):.{precision}f} {float(rot[1]):.{precision}f} {float(rot[2]):.{precision}f} ")
                
                f.write("\n")
        
        logger.info(f"✅ EXIT: save_bvh - Saved to {filepath}")
        
    except Exception as e:
        logger.error(f"❌ EXIT: save_bvh - Error writing BVH: {str(e)}")
        raise BVHSaveError(f"Failed to save BVH file {filepath}: {str(e)}")


def _write_hierarchy(
    f,
    joint_idx: int,
    names: List[str],
    parents: np.ndarray,
    offsets: np.ndarray,
    precision: int,
    indent: int = 0,
) -> None:
    """Recursively write joint hierarchy."""
    indent_str = "  " * indent
    
    # Write ROOT or JOINT
    if joint_idx == 0:
        f.write(f"{indent_str}ROOT {names[joint_idx]}\n")
    else:
        f.write(f"{indent_str}JOINT {names[joint_idx]}\n")
    
    f.write(f"{indent_str}{{\n")
    
    # Write OFFSET
    off = offsets[joint_idx]
    f.write(f"{indent_str}  OFFSET {off[0]:.{precision}f} {off[1]:.{precision}f} {off[2]:.{precision}f}\n")
    
    # Write CHANNELS
    if joint_idx == 0:
        f.write(f"{indent_str}  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation\n")
    else:
        f.write(f"{indent_str}  CHANNELS 3 Zrotation Xrotation Yrotation\n")
    
    # Find and write children
    children = np.where(parents == joint_idx)[0]
    for child_idx in children:
        _write_hierarchy(f, child_idx, names, parents, offsets, precision, indent + 1)
    
    # Write End Site if leaf node
    if len(children) == 0:
        f.write(f"{indent_str}  End Site\n")
        f.write(f"{indent_str}  {{\n")
        f.write(f"{indent_str}    OFFSET 0.0 0.0 0.0\n")
        f.write(f"{indent_str}  }}\n")
    
    f.write(f"{indent_str}}}\n")


def validate_skeleton(
    parents: np.ndarray,
    names: List[str],
) -> bool:
    """
    Validate skeleton hierarchy consistency.
    
    Args:
        parents: Parent joint indices
        names: Joint names
        
    Returns:
        True if valid, False otherwise
        
    Raises:
        ValueError: If skeleton is invalid
    """
    logger.debug(f"🚀 ENTRY: validate_skeleton(num_joints={len(names)})")
    
    num_joints = len(names)
    
    # Check lengths match
    if len(parents) != num_joints:
        logger.error(f"❌ EXIT: validate_skeleton - Length mismatch: {len(parents)} vs {num_joints}")
        raise ValueError(f"Parents array length {len(parents)} != names length {num_joints}")
    
    # Check root parent is -1
    if parents[0] != -1:
        logger.error(f"❌ EXIT: validate_skeleton - Root parent must be -1, got {parents[0]}")
        raise ValueError(f"Root joint parent must be -1, got {parents[0]}")
    
    # Check all parent indices are valid
    for i, parent in enumerate(parents):
        if parent >= num_joints:
            logger.error(f"❌ EXIT: validate_skeleton - Invalid parent index {parent} for joint {i}")
            raise ValueError(f"Parent index {parent} out of range for joint {i}")
        if parent >= i and parent != -1:
            logger.error(f"❌ EXIT: validate_skeleton - Parent {parent} >= child {i}")
            raise ValueError(f"Parent index {parent} must be < child index {i}")
    
    logger.info(f"✅ EXIT: validate_skeleton - Skeleton is valid ({num_joints} joints)")
    return True
