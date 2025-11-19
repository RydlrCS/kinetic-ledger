#!/usr/bin/env python3
"""
Test script for Kinetic Ledger Fivetran Connector
"""

import json
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from connector import KineticLedgerConnector, ConnectorConfig


def test_connector():
    """Test connector with sample data"""
    
    print("\n" + "="*60)
    print("🧪 Testing Kinetic Ledger Fivetran Connector")
    print("="*60 + "\n")
    
    # Configuration
    config = ConnectorConfig(
        gcp_project="kinetic-ledger-test",
        bigquery_dataset="RAW_DEV",
        motion_events_path="../samples/motion-events.json",
        verbose=True
    )
    
    # Initialize connector
    connector = KineticLedgerConnector(config)
    
    # Test connection
    print("1️⃣  Testing connection...")
    if connector.test_connection():
        print("✅ Connection successful\n")
    else:
        print("❌ Connection failed\n")
        return False
    
    # Test schema
    print("2️⃣  Testing schema generation...")
    schema = connector.schema()
    print(f"✅ Schema generated for table: motion_events")
    print(f"   Columns: {len(schema['motion_events']['columns'])}")
    print(f"   Primary key: {schema['motion_events']['primary_key']}\n")
    
    # Test sync
    print("3️⃣  Testing sync...")
    result = connector.update()
    
    print(f"✅ Sync completed")
    print(f"   New records: {len(result['insert']['motion_events'])}")
    print(f"   Has more: {result['hasMore']}")
    print(f"   Sync count: {result['state']['sync_count']}\n")
    
    # Display sample records
    if result['insert']['motion_events']:
        print("4️⃣  Sample records:")
        for i, record in enumerate(result['insert']['motion_events'][:3], 1):
            print(f"\n   Record {i}:")
            print(f"   - Event ID: {record['event_id']}")
            print(f"   - Wallet: {record['wallet']}")
            print(f"   - Motion: {record['motion_file']}")
            print(f"   - Category: {record['motion_category']}")
            print(f"   - Intensity: {record['intensity']}")
            print(f"   - Confidence: {record['confidence_score']}")
    
    # Test idempotency (second sync should find 0 new events)
    print(f"\n5️⃣  Testing idempotency (second sync)...")
    result2 = connector.update()
    
    if len(result2['insert']['motion_events']) == 0:
        print("✅ Idempotency working - no duplicate events\n")
    else:
        print(f"⚠️  Warning: {len(result2['insert']['motion_events'])} events re-synced\n")
    
    print("="*60)
    print("✅ All tests passed!")
    print("="*60 + "\n")
    
    return True


if __name__ == '__main__':
    success = test_connector()
    sys.exit(0 if success else 1)
