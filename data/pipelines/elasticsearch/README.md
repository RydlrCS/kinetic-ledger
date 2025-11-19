# Kinetic Ledger Elasticsearch Indexer

Semantic search and analytics indexing for motion event data using Elasticsearch with vector embeddings for AI-powered motion discovery.

## Overview

This indexer provides:

- **Semantic Search**: Find similar motions using vector embeddings
- **Real-time Analytics**: Query motion patterns and trends
- **AI Integration**: Training data discovery for motion models
- **Dashboard Support**: Power Kibana dashboards and visualizations

## Architecture

```
Motion Events → Embeddings → Elasticsearch → Semantic Search
                                ↓
                            Kibana Dashboards
                            AI Model Training
```

## Features

✅ **Vector Embeddings**: Sentence transformers for semantic motion search  
✅ **Bulk Indexing**: Efficient batch processing  
✅ **Cosine Similarity**: Find similar motions across categories  
✅ **Full-Text Search**: Traditional keyword search on motion descriptions  
✅ **Aggregations**: Category, intensity, device analytics  
✅ **Time-series**: Temporal motion pattern analysis  

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export ELASTICSEARCH_URL="https://your-cluster.es.cloud"
export ES_API_KEY="your-api-key"
```

## Usage

### Create Index

```bash
python indexer.py --create-index --verbose
```

### Index Events

```bash
# Single batch
python indexer.py --events-path ../samples/motion-events.json

# With index creation
python indexer.py --create-index --events-path ../samples/motion-events.json --verbose
```

### Semantic Search

```bash
# Search for similar motions
python indexer.py --search "running sprint athletic"

# Search for dance motions
python indexer.py --search "dancing rhythmic expressive"
```

### CLI Options

```
--es-url        Elasticsearch URL (default: $ELASTICSEARCH_URL)
--es-api-key    API key for authentication
--index         Index name (default: kinetic_motion_events)
--events-path   Path to motion events JSON
--create-index  Create index if not exists
--search        Search query for similar motions
--verbose       Enable debug logging
```

## Index Schema

### Mapping

```json
{
  "mappings": {
    "properties": {
      "event_id": {"type": "keyword"},
      "wallet": {"type": "keyword"},
      "timestamp": {"type": "date"},
      "motion_file": {
        "type": "text",
        "fields": {"keyword": {"type": "keyword"}}
      },
      "motion_category": {"type": "keyword"},
      "intensity": {"type": "float"},
      "motion_vector": {
        "type": "dense_vector",
        "dims": 384,
        "index": true,
        "similarity": "cosine"
      },
      "description": {"type": "text"},
      "tags": {"type": "keyword"}
    }
  }
}
```

## Vector Embeddings

### Embedding Model

Uses `all-MiniLM-L6-v2` from sentence-transformers:

- **Dimensions**: 384
- **Speed**: ~2000 sentences/sec on CPU
- **Quality**: Optimized for semantic similarity

### Embedding Strategy

Each motion event is embedded using:

```
motion_file | category | intensity | complexity | tags
```

Example:
```
Walking Forward.fbx | locomotion | intensity: 0.30 | complexity: low | basic, forward
```

### Similarity Search

Query example:

```python
# Find motions similar to "running"
results = indexer.search_by_motion("running sprint fast", size=10)

for result in results:
    print(f"{result['motion_file']}: {result['score']:.4f}")
```

Output:
```
Running Sprint.fbx: 0.9245
Jogging Forward.fbx: 0.8721
Fast Walk.fbx: 0.7632
```

## Query Examples

### Full-Text Search

```bash
curl -X GET "localhost:9200/kinetic_motion_events/_search" \
  -H 'Content-Type: application/json' -d'
{
  "query": {
    "match": {
      "description": "athletic high intensity"
    }
  }
}'
```

### Filter by Category

```bash
curl -X GET "localhost:9200/kinetic_motion_events/_search" \
  -H 'Content-Type: application/json' -d'
{
  "query": {
    "term": {
      "motion_category": "dance"
    }
  }
}'
```

### Range Query on Intensity

```bash
curl -X GET "localhost:9200/kinetic_motion_events/_search" \
  -H 'Content-Type: application/json' -d'
{
  "query": {
    "range": {
      "intensity": {
        "gte": 0.7,
        "lte": 1.0
      }
    }
  }
}'
```

### Aggregations

```bash
# Count by category
curl -X GET "localhost:9200/kinetic_motion_events/_search" \
  -H 'Content-Type: application/json' -d'
{
  "size": 0,
  "aggs": {
    "categories": {
      "terms": {
        "field": "motion_category"
      }
    }
  }
}'
```

## Integration with Kibana

### Dashboard Setup

1. **Create Index Pattern**:
   - Pattern: `kinetic_motion_events`
   - Time field: `timestamp`

2. **Visualization Examples**:
   - **Pie Chart**: Motion categories distribution
   - **Line Chart**: Motion events over time
   - **Heat Map**: Intensity by hour/day
   - **Tag Cloud**: Popular motion tags

3. **Saved Search**:
   - High-intensity motions (>0.8)
   - Cross-validated events only
   - Recent events (last 7 days)

## Python API Usage

```python
from elasticsearch_indexer import ElasticsearchIndexer

# Initialize
indexer = ElasticsearchIndexer(
    es_url="https://your-cluster.es.cloud",
    es_api_key="your-key",
    index_name="kinetic_motion_events"
)

# Connect
indexer.connect()

# Create index
indexer.create_index()

# Index events
with open('motion-events.json') as f:
    events = json.load(f)
    
stats = indexer.bulk_index(events)
print(f"Indexed: {stats['success']}, Failed: {stats['failed']}")

# Search
results = indexer.search_by_motion("dancing expressive")
for r in results:
    print(f"{r['motion_file']}: {r['score']:.4f}")
```

## Monitoring

### Index Stats

```bash
curl -X GET "localhost:9200/kinetic_motion_events/_stats"
```

### Cluster Health

```bash
curl -X GET "localhost:9200/_cluster/health"
```

### Slow Query Log

Enable in `elasticsearch.yml`:

```yaml
index.search.slowlog.threshold.query.warn: 10s
index.search.slowlog.threshold.query.info: 5s
index.search.slowlog.threshold.fetch.warn: 1s
```

## Performance Tuning

### Bulk Indexing

```python
# Increase batch size
indexer.bulk_index(events, batch_size=500)
```

### Refresh Interval

```bash
# Disable during bulk indexing
curl -X PUT "localhost:9200/kinetic_motion_events/_settings" \
  -H 'Content-Type: application/json' -d'
{
  "index": {
    "refresh_interval": "-1"
  }
}'

# Re-enable after
curl -X PUT "localhost:9200/kinetic_motion_events/_settings" \
  -H 'Content-Type: application/json' -d'
{
  "index": {
    "refresh_interval": "1s"
  }
}'
```

### Vector Search Optimization

```json
{
  "index": {
    "knn.algo_param.ef_search": 100
  }
}
```

## Testing

```bash
# Unit tests
pytest tests/test_indexer.py

# Integration test
python indexer.py --create-index --events-path ../samples/motion-events.json --verbose

# Search test
python indexer.py --search "running" | grep "Running Sprint"
```

## Production Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
    ports:
      - "9200:9200"
  
  indexer:
    build: .
    depends_on:
      - elasticsearch
    environment:
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - ES_API_KEY=${ES_API_KEY}
    command: python indexer.py --create-index --events-path /data/motion-events.json
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kinetic-indexer
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: indexer
        image: kinetic-ledger/elasticsearch-indexer:latest
        env:
        - name: ELASTICSEARCH_URL
          valueFrom:
            secretKeyRef:
              name: es-credentials
              key: url
        - name: ES_API_KEY
          valueFrom:
            secretKeyRef:
              name: es-credentials
              key: api-key
```

## Troubleshooting

### Connection refused

- Verify `ELASTICSEARCH_URL` is correct
- Check ES cluster is running: `curl $ELASTICSEARCH_URL`
- Verify API key has correct permissions

### Vector search not working

- Ensure index created with `dense_vector` mapping
- Verify `sentence-transformers` installed
- Check embedding dimensions match (384)

### Slow queries

- Increase `ef_search` parameter
- Add filters before vector search
- Use `size` parameter to limit results

## References

- [MotionBlendAI Elasticsearch](https://github.com/RydlrCS/MotionBlendAI/tree/main/project/elastic_search)
- [Elasticsearch Python Client](https://elasticsearch-py.readthedocs.io/)
- [Sentence Transformers](https://www.sbert.net/)
- [Kinetic Ledger Architecture](../../../.github/copilot-instructions.md)
