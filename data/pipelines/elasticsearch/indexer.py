#!/usr/bin/env python3
"""
Kinetic Ledger Elasticsearch Indexer
=====================================

Indexes motion events into Elasticsearch for semantic search and analytics.
Supports vector embeddings for AI-powered motion search.

Based on MotionBlendAI patterns with Web3 integration.
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

import structlog
import numpy as np

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


class MotionEmbedder:
    """Generate embeddings for motion events using sentence transformers"""
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self.model = None
        self.model_name = model_name
        self._init_model()
    
    def _init_model(self):
        """Lazy load embedding model"""
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name)
            logger.info("embedding_model_loaded", model=self.model_name)
        except ImportError:
            logger.warning("sentence_transformers_not_available", 
                          message="Install with: pip install sentence-transformers")
            self.model = None
    
    def embed_motion(self, event: Dict[str, Any]) -> List[float]:
        """
        Generate embedding vector for motion event.
        
        Creates semantic representation from:
        - Motion file name
        - Category
        - Intensity
        - Complexity
        - Tags
        """
        # Build description text
        mocap = event.get('metadata', {}).get('mocapValidation', {})
        
        description_parts = []
        
        if mocap.get('motionFile'):
            description_parts.append(mocap['motionFile'])
        
        if mocap.get('category'):
            description_parts.append(f"category: {mocap['category']}")
        
        if mocap.get('intensity'):
            intensity_label = self._intensity_label(mocap['intensity'])
            description_parts.append(f"intensity: {intensity_label}")
        
        if mocap.get('complexity'):
            description_parts.append(f"complexity: {mocap['complexity']}")
        
        if mocap.get('tags'):
            tags_str = ', '.join(mocap['tags'])
            description_parts.append(f"tags: {tags_str}")
        
        description = ' | '.join(description_parts)
        
        # Generate embedding
        if self.model is not None:
            try:
                embedding = self.model.encode(description)
                return embedding.tolist()
            except Exception as e:
                logger.warning("embedding_failed", error=str(e), description=description)
        
        # Fallback to deterministic pseudo-embedding
        return self._pseudo_embedding(description)
    
    def _intensity_label(self, intensity: float) -> str:
        """Convert intensity float to label"""
        if intensity < 0.3:
            return "low"
        elif intensity < 0.6:
            return "moderate"
        elif intensity < 0.8:
            return "high"
        else:
            return "very high"
    
    def _pseudo_embedding(self, text: str, dim: int = 384) -> List[float]:
        """Deterministic pseudo-embedding for testing"""
        seed = abs(hash(text)) % (2**32)
        rng = np.random.RandomState(seed)
        return rng.rand(dim).tolist()


class ElasticsearchIndexer:
    """
    Index motion events into Elasticsearch with semantic search support.
    """
    
    def __init__(self, 
                 es_url: str,
                 es_api_key: Optional[str] = None,
                 index_name: str = 'kinetic_motion_events',
                 verbose: bool = False):
        self.es_url = es_url
        self.es_api_key = es_api_key
        self.index_name = index_name
        self.verbose = verbose
        self.es_client = None
        self.embedder = MotionEmbedder()
        
        # Set log level
        if verbose:
            import logging
            logging.basicConfig(level=logging.DEBUG)
        
        logger.info(
            "indexer_initialized",
            es_url=es_url,
            index=index_name
        )
    
    def connect(self):
        """Initialize Elasticsearch client"""
        try:
            from elasticsearch import Elasticsearch
            
            if self.es_api_key:
                self.es_client = Elasticsearch(
                    self.es_url,
                    api_key=self.es_api_key
                )
            else:
                self.es_client = Elasticsearch(self.es_url)
            
            # Test connection
            info = self.es_client.info()
            logger.info("elasticsearch_connected", 
                       cluster=info.get('cluster_name'),
                       version=info.get('version', {}).get('number'))
            
            return True
            
        except ImportError:
            logger.error("elasticsearch_not_installed",
                        message="Install with: pip install elasticsearch")
            return False
        except Exception as e:
            logger.error("connection_failed", error=str(e))
            return False
    
    def create_index(self):
        """Create Elasticsearch index with motion event mapping"""
        
        mapping = {
            "mappings": {
                "properties": {
                    "event_id": {"type": "keyword"},
                    "wallet": {"type": "keyword"},
                    "timestamp": {"type": "date"},
                    "source": {"type": "keyword"},
                    "metric_type": {"type": "keyword"},
                    "value": {"type": "float"},
                    "unit": {"type": "keyword"},
                    "motion_file": {
                        "type": "text",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "motion_category": {"type": "keyword"},
                    "intensity": {"type": "float"},
                    "complexity": {"type": "keyword"},
                    "frames": {"type": "integer"},
                    "joints": {"type": "integer"},
                    "confidence_score": {"type": "float"},
                    "cross_validated": {"type": "boolean"},
                    "device": {
                        "type": "text",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "calories": {"type": "float"},
                    "average_heart_rate": {"type": "float"},
                    "peak_heart_rate": {"type": "float"},
                    "motion_vector": {
                        "type": "dense_vector",
                        "dims": 384,
                        "index": True,
                        "similarity": "cosine"
                    },
                    "description": {"type": "text"},
                    "tags": {"type": "keyword"},
                    "indexed_at": {"type": "date"},
                    "metadata": {"type": "object", "enabled": False}
                }
            }
        }
        
        try:
            if self.es_client.indices.exists(index=self.index_name):
                logger.info("index_exists", index=self.index_name)
                return True
            
            self.es_client.indices.create(index=self.index_name, body=mapping)
            logger.info("index_created", index=self.index_name)
            return True
            
        except Exception as e:
            logger.error("index_creation_failed", error=str(e))
            return False
    
    def index_event(self, event: Dict[str, Any]) -> bool:
        """Index a single motion event"""
        try:
            # Generate event ID
            event_id = self._generate_event_id(event)
            
            # Extract metadata
            mocap = event.get('metadata', {}).get('mocapValidation', {})
            fitness = event.get('metadata', {}).get('fitnessTracker', {})
            
            # Generate embedding
            motion_vector = self.embedder.embed_motion(event)
            
            # Build description
            description_parts = [
                mocap.get('motionFile', ''),
                mocap.get('category', ''),
                f"intensity: {mocap.get('intensity', 0):.2f}"
            ]
            description = ' | '.join(filter(None, description_parts))
            
            # Extract tags
            tags = mocap.get('tags', [])
            
            # Prepare document
            doc = {
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
                "motion_vector": motion_vector,
                "description": description,
                "tags": tags,
                "indexed_at": datetime.utcnow().isoformat(),
                "metadata": event.get('metadata', {})
            }
            
            # Index document
            self.es_client.index(
                index=self.index_name,
                id=event_id,
                document=doc
            )
            
            logger.debug(
                "event_indexed",
                event_id=event_id,
                motion_file=mocap.get('motionFile')
            )
            
            return True
            
        except Exception as e:
            logger.error("indexing_failed", error=str(e), event=event.get('wallet'))
            return False
    
    def bulk_index(self, events: List[Dict[str, Any]]) -> Dict[str, int]:
        """Bulk index multiple motion events"""
        stats = {"success": 0, "failed": 0}
        
        logger.info("bulk_index_started", total_events=len(events))
        
        for event in events:
            if self.index_event(event):
                stats["success"] += 1
            else:
                stats["failed"] += 1
        
        logger.info(
            "bulk_index_completed",
            success=stats["success"],
            failed=stats["failed"]
        )
        
        return stats
    
    def search_by_motion(self, motion_query: str, size: int = 10) -> List[Dict]:
        """
        Semantic search for similar motion events.
        
        Args:
            motion_query: Text description of motion to search for
            size: Number of results to return
        """
        try:
            # Generate query embedding
            query_event = {
                'metadata': {
                    'mocapValidation': {
                        'motionFile': motion_query
                    }
                }
            }
            query_vector = self.embedder.embed_motion(query_event)
            
            # Perform vector search
            response = self.es_client.search(
                index=self.index_name,
                body={
                    "size": size,
                    "query": {
                        "script_score": {
                            "query": {"match_all": {}},
                            "script": {
                                "source": "cosineSimilarity(params.query_vector, 'motion_vector') + 1.0",
                                "params": {"query_vector": query_vector}
                            }
                        }
                    }
                }
            )
            
            results = []
            for hit in response['hits']['hits']:
                results.append({
                    'score': hit['_score'],
                    'event_id': hit['_source']['event_id'],
                    'motion_file': hit['_source']['motion_file'],
                    'category': hit['_source']['motion_category'],
                    'intensity': hit['_source']['intensity'],
                    'wallet': hit['_source']['wallet']
                })
            
            logger.info("search_completed", query=motion_query, results=len(results))
            return results
            
        except Exception as e:
            logger.error("search_failed", error=str(e))
            return []
    
    def _generate_event_id(self, event: Dict[str, Any]) -> str:
        """Generate deterministic event ID"""
        import hashlib
        id_string = f"{event['wallet']}_{event['timestamp']}_{event['metricType']}"
        return hashlib.sha256(id_string.encode()).hexdigest()[:16]


def main():
    """CLI entry point for testing indexer locally"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Kinetic Ledger Elasticsearch Indexer")
    parser.add_argument('--es-url', 
                       default=os.getenv('ELASTICSEARCH_URL', 'http://localhost:9200'),
                       help='Elasticsearch URL')
    parser.add_argument('--es-api-key',
                       default=os.getenv('ES_API_KEY'),
                       help='Elasticsearch API key')
    parser.add_argument('--index',
                       default='kinetic_motion_events',
                       help='Index name')
    parser.add_argument('--events-path',
                       default='../samples/motion-events.json',
                       help='Path to motion events JSON file')
    parser.add_argument('--create-index', action='store_true',
                       help='Create index if not exists')
    parser.add_argument('--search',
                       help='Search for motion events')
    parser.add_argument('--verbose', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Initialize indexer
    indexer = ElasticsearchIndexer(
        es_url=args.es_url,
        es_api_key=args.es_api_key,
        index_name=args.index,
        verbose=args.verbose
    )
    
    # Connect to Elasticsearch
    if not indexer.connect():
        logger.error("failed_to_connect")
        sys.exit(1)
    
    # Create index if requested
    if args.create_index:
        if not indexer.create_index():
            logger.error("failed_to_create_index")
            sys.exit(1)
    
    # Search mode
    if args.search:
        results = indexer.search_by_motion(args.search)
        print("\n" + "="*60)
        print(f"🔍 Search Results for: {args.search}")
        print("="*60)
        for i, result in enumerate(results, 1):
            print(f"\n{i}. {result['motion_file']}")
            print(f"   Category: {result['category']}")
            print(f"   Intensity: {result['intensity']:.2f}")
            print(f"   Score: {result['score']:.4f}")
        print("="*60 + "\n")
        sys.exit(0)
    
    # Load and index events
    events_path = Path(args.events_path)
    if not events_path.exists():
        logger.error("events_file_not_found", path=str(events_path))
        sys.exit(1)
    
    with open(events_path, 'r') as f:
        events = json.load(f)
    
    logger.info("events_loaded", count=len(events))
    
    # Bulk index
    stats = indexer.bulk_index(events)
    
    # Print results
    print("\n" + "="*60)
    print("📊 Indexing Results")
    print("="*60)
    print(f"Success: {stats['success']}")
    print(f"Failed: {stats['failed']}")
    print(f"Total: {len(events)}")
    print("="*60 + "\n")


if __name__ == '__main__':
    main()
