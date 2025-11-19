#!/usr/bin/env python3
"""
Kinetic Ledger Fivetran Connector
==================================

Streams motion event data from local JSON files and blockchain to BigQuery
for analytics and data warehouse integration.

Based on MotionBlendAI connector patterns with Web3 integration.
"""

import json
import os
import sys
import time
import hashlib
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass

import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
)

logger = structlog.get_logger()


@dataclass
class ConnectorConfig:
    """Configuration for Kinetic Ledger connector"""
    gcp_project: str
    bigquery_dataset: str
    motion_events_path: str
    state_path: str = "state.json"
    batch_limit: int = 100
    verbose: bool = False


class KineticLedgerConnector:
    """
    Fivetran-compatible connector for Kinetic Ledger motion events.
    
    Syncs motion event data to BigQuery with idempotent processing
    and state management for incremental updates.
    """
    
    def __init__(self, config: ConnectorConfig):
        self.config = config
        self.state = self._load_state()
        
        # Set log level based on verbose flag
        if config.verbose:
            import logging
            logging.basicConfig(level=logging.DEBUG)
        
        logger.info(
            "connector_initialized",
            project=config.gcp_project,
            dataset=config.bigquery_dataset,
            events_path=config.motion_events_path
        )
    
    def _load_state(self) -> Dict[str, Any]:
        """Load connector state for incremental sync"""
        state_file = Path(self.config.state_path)
        if state_file.exists():
            with open(state_file, 'r') as f:
                state = json.load(f)
                logger.info("state_loaded", last_sync=state.get('last_sync_timestamp'))
                return state
        
        logger.info("state_initialized", message="No previous state found, starting fresh")
        return {
            'last_sync_timestamp': None,
            'processed_event_ids': [],
            'sync_count': 0
        }
    
    def _save_state(self):
        """Persist connector state"""
        with open(self.config.state_path, 'w') as f:
            json.dump(self.state, f, indent=2)
        logger.debug("state_saved", sync_count=self.state['sync_count'])
    
    def _generate_event_id(self, event: Dict[str, Any]) -> str:
        """Generate deterministic ID for idempotent processing"""
        # Create unique ID from wallet + timestamp + metric type
        id_string = f"{event['wallet']}_{event['timestamp']}_{event['metricType']}"
        return hashlib.sha256(id_string.encode()).hexdigest()[:16]
    
    def _normalize_motion_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw motion event to BigQuery schema.
        
        Schema:
            - event_id: string (primary key)
            - wallet: string
            - timestamp: timestamp
            - source: string
            - metric_type: string
            - value: float
            - unit: string
            - motion_file: string (from mocapValidation)
            - intensity: float
            - confidence_score: float
            - device: string
            - category: string
            - created_at: timestamp
        """
        event_id = self._generate_event_id(event)
        
        # Extract mocap metadata
        mocap = event.get('metadata', {}).get('mocapValidation', {})
        fitness = event.get('metadata', {}).get('fitnessTracker', {})
        
        normalized = {
            "event_id": event_id,
            "wallet": event['wallet'],
            "timestamp": event['timestamp'],
            "source": event['source'],
            "metric_type": event['metricType'],
            "value": float(event['value']),
            "unit": event['unit'],
            "motion_file": mocap.get('motionFile'),
            "motion_category": mocap.get('category'),
            "intensity": mocap.get('intensity'),
            "complexity": mocap.get('complexity'),
            "frames": mocap.get('frames'),
            "joints": mocap.get('joints'),
            "confidence_score": event.get('metadata', {}).get('confidenceScore'),
            "cross_validated": event.get('metadata', {}).get('crossValidated'),
            "device": fitness.get('device'),
            "calories": fitness.get('calories'),
            "average_heart_rate": fitness.get('averageHeartRate'),
            "peak_heart_rate": fitness.get('peakHeartRate'),
            "created_at": datetime.utcnow().isoformat(),
            "metadata": json.dumps(event.get('metadata', {}))
        }
        
        logger.debug(
            "event_normalized",
            event_id=event_id,
            wallet=event['wallet'],
            motion_file=mocap.get('motionFile')
        )
        
        return normalized
    
    def _load_motion_events(self) -> List[Dict[str, Any]]:
        """Load motion events from JSON file"""
        events_path = Path(self.config.motion_events_path)
        
        if not events_path.exists():
            logger.error("events_file_not_found", path=str(events_path))
            return []
        
        with open(events_path, 'r') as f:
            events = json.load(f)
        
        logger.info("events_loaded", count=len(events), path=str(events_path))
        return events
    
    def schema(self) -> Dict[str, Any]:
        """
        Return Fivetran schema definition.
        
        This defines the BigQuery table structure.
        """
        return {
            "motion_events": {
                "primary_key": ["event_id"],
                "columns": {
                    "event_id": "STRING",
                    "wallet": "STRING",
                    "timestamp": "TIMESTAMP",
                    "source": "STRING",
                    "metric_type": "STRING",
                    "value": "FLOAT",
                    "unit": "STRING",
                    "motion_file": "STRING",
                    "motion_category": "STRING",
                    "intensity": "FLOAT",
                    "complexity": "STRING",
                    "frames": "INTEGER",
                    "joints": "INTEGER",
                    "confidence_score": "FLOAT",
                    "cross_validated": "BOOLEAN",
                    "device": "STRING",
                    "calories": "FLOAT",
                    "average_heart_rate": "FLOAT",
                    "peak_heart_rate": "FLOAT",
                    "created_at": "TIMESTAMP",
                    "metadata": "STRING"  # JSON string
                }
            }
        }
    
    def update(self, state_from_fivetran: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Main sync method called by Fivetran.
        
        Returns:
            {
                "state": {...},  # Updated state
                "hasMore": false,  # Whether more data is available
                "insert": {
                    "motion_events": [...]
                },
                "delete": {},
                "schema": {...}
            }
        """
        logger.info("sync_started", sync_count=self.state['sync_count'] + 1)
        
        # Load motion events
        events = self._load_motion_events()
        
        # Filter to only new events (not in processed list)
        processed_ids = set(self.state['processed_event_ids'])
        new_events = []
        
        for event in events:
            event_id = self._generate_event_id(event)
            if event_id not in processed_ids:
                normalized = self._normalize_motion_event(event)
                new_events.append(normalized)
                processed_ids.add(event_id)
        
        logger.info(
            "events_filtered",
            total_events=len(events),
            new_events=len(new_events),
            already_processed=len(events) - len(new_events)
        )
        
        # Update state
        self.state['last_sync_timestamp'] = datetime.utcnow().isoformat()
        self.state['processed_event_ids'] = list(processed_ids)
        self.state['sync_count'] += 1
        self._save_state()
        
        # Prepare response
        response = {
            "state": self.state,
            "hasMore": False,  # All data processed in single batch
            "insert": {
                "motion_events": new_events
            },
            "delete": {},
            "schema": self.schema()
        }
        
        logger.info(
            "sync_completed",
            new_records=len(new_events),
            total_synced=self.state['sync_count']
        )
        
        return response
    
    def test_connection(self) -> bool:
        """Test connector can access data sources"""
        try:
            events_path = Path(self.config.motion_events_path)
            if not events_path.exists():
                logger.error("test_failed", reason="Motion events file not found")
                return False
            
            events = self._load_motion_events()
            if not events:
                logger.warning("test_warning", reason="No motion events found")
                return True
            
            logger.info("test_passed", events_count=len(events))
            return True
            
        except Exception as e:
            logger.error("test_error", error=str(e))
            return False


def main():
    """CLI entry point for testing connector locally"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Kinetic Ledger Fivetran Connector")
    parser.add_argument('--project', default=os.getenv('GCP_PROJECT', 'kinetic-ledger'),
                       help='GCP project ID')
    parser.add_argument('--dataset', default=os.getenv('BQ_DATASET', 'RAW_DEV'),
                       help='BigQuery dataset name')
    parser.add_argument('--events-path', 
                       default='../samples/motion-events.json',
                       help='Path to motion events JSON file')
    parser.add_argument('--test', action='store_true',
                       help='Test connection only')
    parser.add_argument('--verbose', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Create connector config
    config = ConnectorConfig(
        gcp_project=args.project,
        bigquery_dataset=args.dataset,
        motion_events_path=args.events_path,
        verbose=args.verbose
    )
    
    # Initialize connector
    connector = KineticLedgerConnector(config)
    
    if args.test:
        # Test connection
        success = connector.test_connection()
        sys.exit(0 if success else 1)
    
    # Run sync
    result = connector.update()
    
    # Print results
    print("\n" + "="*60)
    print("🔄 Sync Results")
    print("="*60)
    print(f"New records: {len(result['insert']['motion_events'])}")
    print(f"Total syncs: {result['state']['sync_count']}")
    print(f"Last sync: {result['state']['last_sync_timestamp']}")
    print("="*60 + "\n")
    
    # Print sample records
    if result['insert']['motion_events']:
        print("Sample records:")
        for i, record in enumerate(result['insert']['motion_events'][:3], 1):
            print(f"\n{i}. Event ID: {record['event_id']}")
            print(f"   Wallet: {record['wallet']}")
            print(f"   Motion: {record['motion_file']}")
            print(f"   Category: {record['motion_category']}")
            print(f"   Intensity: {record['intensity']}")


if __name__ == '__main__':
    main()
