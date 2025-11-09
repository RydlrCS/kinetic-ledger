# Motion Blend Service

AI-powered motion blending service using GANimator architecture for seamless animation transitions.

## Overview

This service implements controllable single-shot animation blending with temporal conditioning, based on the BlendAnim framework. It takes 2-3 motion sequences (BVH format) and generates a seamlessly blended output with smooth transitions.

## Architecture

- **Blend Engine**: GANimator-based multi-stage generator with SPADE normalization
- **Temporal Conditioning**: Skeleton ID maps guide blending at transition points
- **Quality Validation**: Metrics for velocity continuity, acceleration smoothness, foot contact stability
- **Hash Generation**: Deterministic keccak256 hashing for on-chain attestation

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download model weights (if needed)
# wget https://example.com/ganimator_weights.pth -O models/ganimator.pth

# Start service
python src/api.py
```

## API Endpoints

### POST /blend
Blend 2-3 motion sequences with configurable weights.

**Request**:
```json
{
  "source_files": ["path/to/motion1.bvh", "path/to/motion2.bvh"],
  "blend_weights": [0.5, 0.5],
  "transition_frame": 50,
  "quality_threshold": 80
}
```

**Response**:
```json
{
  "blended_bvh_path": "/tmp/blended_motion_123.bvh",
  "embedding_hash": "0x1234567890abcdef...",
  "quality_score": 92,
  "metadata": {
    "frame_count": 120,
    "joint_count": 29,
    "blend_duration_ms": 2340
  }
}
```

### GET /health
Health check endpoint.

## Environment Variables

- `MODEL_PATH`: Path to GANimator model weights (default: `models/ganimator.pth`)
- `LOG_LEVEL`: Logging level (default: `INFO`, set to `DEBUG` for verbose)
- `MAX_BLEND_DURATION`: Maximum blend processing time in seconds (default: 30)

## Testing

```bash
# Run unit tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=src --cov-report=html

# Lint check
ruff check src/ tests/
mypy src/ tests/
```

## Quality Metrics

Blended motions are validated against:
- **Velocity Continuity**: < 0.5 m/s jump at transitions
- **Acceleration Smoothness**: < 2.0 m/s² spike at transitions
- **Foot Contact Stability**: < 0.1 m slip during ground contact
- **Overall Quality Score**: Minimum 80/100 for on-chain registration

## Integration with Kinetic Ledger

1. Agent service calls `/blend` endpoint with source BVH files
2. Blend service generates blended motion + embedding hash
3. Agent service signs hash with EIP-712
4. BlendedMotionRegistry.sol stores blend metadata on Arc blockchain
5. MotionMintOrchestrator.sol verifies novelty and mints NFT

## References

- [BlendAnim Repository](https://github.com/RydlrCS/blendanim)
- [GANimator Paper](https://arxiv.org/abs/2203.07840)
- [SPADE Normalization](https://arxiv.org/abs/1903.07291)

## License

MIT License - See LICENSE file for details
