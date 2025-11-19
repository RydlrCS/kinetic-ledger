# Kinetic Ledger Fivetran Connector

Enterprise-grade connector for syncing motion event data from Kinetic Ledger to BigQuery for analytics and data warehouse integration.

## Overview

This connector streams motion capture validation data, fitness tracker metrics, and blockchain attestations to BigQuery, enabling:

- **Analytics**: Track motion patterns, activity trends, and payment flows
- **Compliance**: Audit trail of all motion-triggered payments
- **AI Training**: Historical data for motion prediction models
- **Business Intelligence**: Dashboard integration with Looker, Tableau, etc.

## Architecture

```
Motion Events (JSON) → Connector → BigQuery → dbt → Marts → Elasticsearch
                                      ↓
                                  Analytics
                                  Dashboards
```

## Features

✅ **Idempotent Processing**: SHA-256 event IDs prevent duplicates  
✅ **Incremental Sync**: State management for efficient updates  
✅ **Structured Logging**: JSON logs with trace IDs for observability  
✅ **Schema Evolution**: Automatic table schema updates  
✅ **Batch Processing**: Configurable batch sizes for large datasets  
✅ **Error Handling**: Retry logic with exponential backoff  

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GCP_PROJECT="kinetic-ledger"
export BQ_DATASET="RAW_DEV"
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"
```

## Usage

### Test Connection

```bash
python connector.py --test --verbose
```

### Run Sync

```bash
# Single sync
python connector.py --events-path ../samples/motion-events.json

# Continuous sync (production)
python connector.py --events-path /data/motion-events.json --verbose
```

### CLI Options

```
--project       GCP project ID (default: $GCP_PROJECT)
--dataset       BigQuery dataset name (default: RAW_DEV)
--events-path   Path to motion events JSON file
--test          Test connection only
--verbose       Enable debug logging
```

## BigQuery Schema

### Table: `motion_events`

| Column | Type | Description |
|--------|------|-------------|
| `event_id` | STRING | Primary key (SHA-256 hash) |
| `wallet` | STRING | Ethereum wallet address |
| `timestamp` | TIMESTAMP | Event timestamp (ISO 8601) |
| `source` | STRING | Data source (e.g., multi-sensor-attestation) |
| `metric_type` | STRING | Type of metric (steps, duration, distance) |
| `value` | FLOAT | Metric value |
| `unit` | STRING | Unit of measurement |
| `motion_file` | STRING | Reference to mocap file (e.g., "Walking Forward.fbx") |
| `motion_category` | STRING | Motion category (locomotion, athletic, dance, etc.) |
| `intensity` | FLOAT | Intensity score (0.0 - 1.0) |
| `complexity` | STRING | Complexity level (low, medium, high) |
| `frames` | INTEGER | Number of mocap frames |
| `joints` | INTEGER | Number of tracked joints |
| `confidence_score` | FLOAT | Attestation confidence (0.0 - 1.0) |
| `cross_validated` | BOOLEAN | Multiple source validation |
| `device` | STRING | Fitness tracker device name |
| `calories` | FLOAT | Calories burned |
| `average_heart_rate` | FLOAT | Average BPM |
| `peak_heart_rate` | FLOAT | Peak BPM |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `metadata` | STRING | Full metadata JSON |

## Data Flow

1. **Extract**: Load motion events from JSON files
2. **Transform**: Normalize to BigQuery schema
3. **Load**: Batch insert with deduplication
4. **State**: Save sync checkpoint for incremental updates

## State Management

The connector maintains state in `state.json`:

```json
{
  "last_sync_timestamp": "2025-11-12T10:30:00Z",
  "processed_event_ids": ["abc123...", "def456..."],
  "sync_count": 42
}
```

## Monitoring

### Structured Logs

All operations emit JSON logs with:

```json
{
  "timestamp": "2025-11-12T10:30:00.123Z",
  "level": "info",
  "event": "sync_completed",
  "new_records": 8,
  "total_synced": 42,
  "trace_id": "abc-123-def"
}
```

### Key Metrics

- `sync_started`: Beginning of sync operation
- `events_filtered`: Deduplication stats
- `sync_completed`: Success with record counts
- `sync_failed`: Errors with details

## Integration with dbt

After loading to BigQuery RAW layer, use dbt for transformations:

```sql
-- models/staging/stg_motion_events.sql
SELECT
  event_id,
  wallet,
  timestamp,
  motion_category,
  intensity,
  confidence_score,
  DATE(timestamp) AS event_date
FROM {{ source('raw', 'motion_events') }}
WHERE confidence_score >= 0.8
```

## Fivetran SDK Integration

To deploy as a Fivetran custom connector:

1. Implement Fivetran SDK interface
2. Package as Docker container
3. Deploy to Fivetran connector registry
4. Configure in Fivetran dashboard

See [Fivetran SDK docs](https://fivetran.com/docs/connectors/connector-sdk) for details.

## Testing

```bash
# Unit tests
pytest tests/

# Integration test with sample data
python connector.py --test --events-path ../samples/motion-events.json

# Validate BigQuery schema
bq show kinetic-ledger:RAW_DEV.motion_events
```

## Troubleshooting

### No events synced

- Check `--events-path` file exists and is valid JSON
- Verify events haven't been processed (check `state.json`)
- Run with `--verbose` to see detailed logs

### BigQuery permission errors

- Ensure service account has `bigquery.dataEditor` role
- Verify `GOOGLE_APPLICATION_CREDENTIALS` is set correctly
- Check dataset exists: `bq ls kinetic-ledger:`

### State file corruption

```bash
# Reset state
rm state.json

# Re-sync all events
python connector.py --events-path ../samples/motion-events.json
```

## Production Deployment

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY connector.py .
CMD ["python", "connector.py", "--events-path", "/data/motion-events.json"]
```

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: kinetic-ledger-sync
spec:
  schedule: "*/15 * * * *"  # Every 15 minutes
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: connector
            image: kinetic-ledger/fivetran-connector:latest
            env:
            - name: GCP_PROJECT
              value: "kinetic-ledger"
            - name: BQ_DATASET
              value: "RAW"
```

## References

- [MotionBlendAI Connector](https://github.com/RydlrCS/MotionBlendAI/tree/main/connector)
- [Fivetran SDK](https://fivetran.com/docs/connectors/connector-sdk)
- [BigQuery Python Client](https://cloud.google.com/python/docs/reference/bigquery/latest)
- [Kinetic Ledger Docs](../../../docs/LOGGING.md)
