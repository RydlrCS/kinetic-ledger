# Motion Data Samples

This directory contains sample motion data for testing and development.

## Files

- **motion-events.json** - Raw motion events from various fitness trackers
- **aggregated-daily.json** - Daily aggregated metrics per wallet

## Data Sources

Sample data represents integration with:
- Fitbit (steps, distance, calories)
- Apple Health (steps, heart rate)
- Strava (cycling/running activities)
- Garmin (advanced metrics)

## Usage

```typescript
import { MotionEvent, isValidMotionEvent } from '@kinetic-ledger/schemata';
import events from './motion-events.json';

// Validate events
const validEvents = events.filter(isValidMotionEvent);

// Process in batches
const batchSize = 100;
for (let i = 0; i < validEvents.length; i += batchSize) {
  const batch = validEvents.slice(i, i + batchSize);
  await processBatch(batch);
}
```

## Privacy Considerations

**IMPORTANT**: This sample data uses test wallet addresses. In production:
- Never store raw motion data on-chain
- Only store keccak256 hashes of motion data
- Keep raw data in encrypted off-chain storage
- Use zero-knowledge proofs for sensitive metrics
- Implement user consent and data deletion flows

## Fivetran Integration Pattern

```yaml
# Example: Fivetran connector for Fitbit API
connector:
  name: fitbit-motion-sync
  type: rest_api
  config:
    base_url: https://api.fitbit.com/1/user/-/
    endpoints:
      - path: activities/steps/date/{date}/1d.json
        cursor_field: dateTime
        batch_size: 1000
    auth:
      type: oauth2
      token_url: https://api.fitbit.com/oauth2/token
    transformations:
      - hash_sensitive_fields
      - aggregate_by_wallet
      - prepare_for_blockchain
```

## Testing Scale

Generate 1000+ events for scale testing:

```bash
# Use the generator script (create this)
node scripts/generate-motion-data.js --count 1000 --output data/samples/scale-test.json
```
