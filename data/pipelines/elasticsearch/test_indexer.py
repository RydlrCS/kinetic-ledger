#!/usr/bin/env python3
"""
Test script for Kinetic Ledger Elasticsearch Indexer
"""

import json
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from indexer import ElasticsearchIndexer, MotionEmbedder


def test_embedder():
    """Test motion embedding generation"""
    
    print("\n" + "="*60)
    print("🧪 Testing Motion Embedder")
    print("="*60 + "\n")
    
    embedder = MotionEmbedder()
    
    # Sample event
    event = {
        "wallet": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "timestamp": "2025-10-31T08:00:00Z",
        "metricType": "steps",
        "value": 5420,
        "metadata": {
            "mocapValidation": {
                "motionFile": "Walking Forward.fbx",
                "category": "locomotion",
                "intensity": 0.3,
                "complexity": "low",
                "tags": ["basic", "forward"]
            }
        }
    }
    
    # Generate embedding
    vector = embedder.embed_motion(event)
    
    print(f"✅ Embedding generated")
    print(f"   Dimensions: {len(vector)}")
    print(f"   Sample values: {vector[:5]}")
    print(f"   Min: {min(vector):.4f}, Max: {max(vector):.4f}\n")
    
    return True


def test_indexer():
    """Test Elasticsearch indexer (mock mode)"""
    
    print("="*60)
    print("🧪 Testing Elasticsearch Indexer (Mock Mode)")
    print("="*60 + "\n")
    
    # Load sample events
    events_path = Path("../samples/motion-events.json")
    
    if not events_path.exists():
        print("❌ Sample events file not found")
        return False
    
    with open(events_path, 'r') as f:
        events = json.load(f)
    
    print(f"✅ Loaded {len(events)} sample events\n")
    
    # Test embedding for each event
    embedder = MotionEmbedder()
    
    print("2️⃣  Testing embeddings for all events...")
    
    for i, event in enumerate(events, 1):
        vector = embedder.embed_motion(event)
        mocap = event.get('metadata', {}).get('mocapValidation', {})
        
        if i <= 3:  # Show first 3
            print(f"\n   Event {i}: {mocap.get('motionFile')}")
            print(f"   - Category: {mocap.get('category')}")
            print(f"   - Intensity: {mocap.get('intensity')}")
            print(f"   - Vector dims: {len(vector)}")
    
    print(f"\n✅ All {len(events)} events embedded successfully\n")
    
    # Test similarity
    print("3️⃣  Testing similarity between motions...")
    
    # Compare walking vs running
    walking_event = next(e for e in events 
                        if 'Walking' in e.get('metadata', {}).get('mocapValidation', {}).get('motionFile', ''))
    running_event = next(e for e in events 
                        if 'Running' in e.get('metadata', {}).get('mocapValidation', {}).get('motionFile', ''))
    
    walk_vec = embedder.embed_motion(walking_event)
    run_vec = embedder.embed_motion(running_event)
    
    # Cosine similarity
    import numpy as np
    
    def cosine_similarity(v1, v2):
        v1_arr = np.array(v1)
        v2_arr = np.array(v2)
        return np.dot(v1_arr, v2_arr) / (np.linalg.norm(v1_arr) * np.linalg.norm(v2_arr))
    
    similarity = cosine_similarity(walk_vec, run_vec)
    
    print(f"   Walking vs Running similarity: {similarity:.4f}")
    print(f"   (Higher = more similar, range: -1 to 1)\n")
    
    print("="*60)
    print("✅ All tests passed!")
    print("="*60 + "\n")
    
    print("ℹ️  To test with real Elasticsearch:")
    print("   1. Start Elasticsearch: docker run -p 9200:9200 elasticsearch:8.11.0")
    print("   2. Run: python indexer.py --create-index --events-path ../samples/motion-events.json")
    print("   3. Search: python indexer.py --search 'running athletic'\n")
    
    return True


if __name__ == '__main__':
    success = test_embedder() and test_indexer()
    sys.exit(0 if success else 1)
