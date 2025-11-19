# Motion Capture BVH Samples

This directory contains sample BVH (BioVision Hierarchy) motion capture files used for testing and demonstration in the Kinetic Ledger data pipeline.

## Files

### Seed Motions (Base Motion Sequences)

- **seed_walking_forward.bvh** - Basic walking locomotion (30 frames, 30 FPS)
  - Category: locomotion
  - Intensity: 0.3 (low)
  - Joints: 7 (Hips, Spine, Chest, Left/Right Legs and Feet)

### Build Motions (Processed)

- **build_running_sprint.bvh** - High-intensity running motion
  - Category: athletic
  - Intensity: 0.85 (high)

### Blend SNN (Neural Network Blends)

- **blend_walk_to_run.bvh** - Transition from walking to running
  - Created by blending seed_walking and build_running
  - Blend ratio: 0.6

## BVH Format

BVH files contain:
- **HIERARCHY**: Joint structure and offsets
- **MOTION**: Frame data with rotations and positions

### Structure

```
HIERARCHY
ROOT Hips
{
    CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
    JOINT LeftUpLeg { ... }
    JOINT RightUpLeg { ... }
}
MOTION
Frames: 30
Frame Time: 0.033333
[Frame data...]
```

## Usage in Pipeline

### 1. Fivetran Connector

The connector can reference BVH files in motion event metadata:

```json
{
  "metadata": {
    "mocapValidation": {
      "motionFile": "seed_walking_forward.bvh",
      "frames": 30,
      "joints": 7,
      "category": "locomotion"
    }
  }
}
```

### 2. Elasticsearch Indexing

BVH metadata is indexed for semantic search:

```python
# Search for similar motions
results = indexer.search_by_motion("walking forward locomotion")
```

### 3. Quality Metrics

BVH files can be analyzed for blend quality:

```bash
python analysis/compute_blend_metrics.py --blend-file blend_walk_to_run.bvh
```

## Creating Custom BVH Files

### Minimal Template

```
HIERARCHY
ROOT Hips
{
    OFFSET 0.00 0.00 0.00
    CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
    End Site { OFFSET 0.00 0.00 0.00 }
}
MOTION
Frames: 10
Frame Time: 0.033333
[10 lines of frame data, 6 values each]
```

### Tools

- **Blender**: Import/export BVH with animations
- **MotionBuilder**: Professional mocap editing
- **Python BVH libraries**: `bvh-python`, `pymo`

## References

- [BVH Format Specification](http://research.cs.wisc.edu/graphics/Courses/cs-838-1999/Jeff/BVH.html)
- [MotionBlendAI BVH Export](https://github.com/RydlrCS/MotionBlendAI/blob/main/project/blending/bvh_export.py)
- [Kinetic Ledger Motion Processing](../../docs/USDC_IMPLEMENTATION.md)
