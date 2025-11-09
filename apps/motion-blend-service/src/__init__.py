"""
Motion Blending Service

AI-powered motion sequence blending with GANimator architecture
and on-chain attestation via keccak256 hashing.

Modules:
- bvh_utils: BVH file I/O (load, save, validate)
- motion_processor: Feature extraction and hashing
- blend_engine: Core blending logic with SPADE normalization
- api: FastAPI REST endpoints

Author: Kinetic Ledger Team
License: MIT
"""

__version__ = "1.0.0"

from . import bvh_utils, motion_processor, blend_engine

__all__ = ["bvh_utils", "motion_processor", "blend_engine"]
