# Motion Data Samples - Multi-Sensor Attestation Framework

This directory contains sample motion data demonstrating **multi-agent/sensor attestation** - a hybrid approach that combines real-world fitness tracker telemetry with motion capture validation for enhanced trust and accuracy.

## Files

- **motion-events.json** - Hybrid motion events with fitness tracker + mocap validation
- **aggregated-daily.json** - Daily aggregated metrics per wallet with multi-sensor summaries

## Multi-Sensor Attestation Architecture

### Supported Data Sources

**Fitness Trackers & Wearables:**
- Fitbit (steps, distance, calories, heart rate)
- Apple Health (workouts, vitals, location)
- Garmin Connect (advanced metrics, VO2max, training effect)
- Whoop (strain, HRV, recovery)
- Polar (heart rate zones, precision HR)
- Meta Quest (VR fitness, spatial movement)
- Peloton IoT (power, cadence, resistance)

**Motion Capture Validation:**
- FBX files (Autodesk Filmbox)
- GLB files (glTF Binary)
- TRC files (Track Row Column)
- Biomechanics analysis
- Technique scoring
- Performance metrics

### Attestation Schema

Each event contains:

```typescript
{
  wallet: string;              // User's blockchain address
  timestamp: string;           // ISO 8601 timestamp
  source: "multi-sensor-attestation";
  metricType: string;          // Primary metric being measured
  value: number;               // Metric value
  unit: string;                // Measurement unit
  metadata: {
    fitnessTracker: {          // Real-world telemetry
      device: string;
      // Device-specific metrics (steps, HR, calories, etc.)
    },
    mocapValidation: {         // Motion capture validation
      motionFile: string;      // Reference motion file
      frames: number;
      joints: number;
      category: string;
      intensity: number;       // 0.0-1.0
      complexity: string;
      // Category-specific analysis
    },
    attestationSources: string[];  // List of data sources
    confidenceScore: number;       // 0.0-1.0 trust score
    crossValidated: boolean;       // Multi-source agreement
  }
}
```

## Usage Examples

### Load and Validate Events

```typescript
import { MotionEvent, isValidMotionEvent } from '@kinetic-ledger/schemata';
import events from './motion-events.json';

// Validate multi-sensor events
const validEvents = events.filter(isValidMotionEvent);

// Filter by confidence score
const highConfidenceEvents = validEvents.filter(
  e => e.metadata.confidenceScore >= 0.9
);

// Group by attestation sources
const eventsBySource = validEvents.reduce((acc, event) => {
  const sources = event.metadata.attestationSources.join('+');
  if (!acc[sources]) acc[sources] = [];
  acc[sources].push(event);
  return acc;
}, {});
```

### Process in Batches for Blockchain

```typescript
import { keccak256, encodePacked } from 'viem';

const batchSize = 100;
for (let i = 0; i < validEvents.length; i += batchSize) {
  const batch = validEvents.slice(i, i + batchSize);
  
  // Hash each event's combined data
  const hashes = batch.map(event => {
    const combinedData = {
      fitness: event.metadata.fitnessTracker,
      mocap: event.metadata.mocapValidation,
      timestamp: event.timestamp,
      wallet: event.wallet
    };
    return keccak256(encodePacked(['string'], [JSON.stringify(combinedData)]));
  });
  
  await submitAttestation(batch[0].wallet, hashes, batch.map(e => e.metadata.confidenceScore));
}
```

### Aggregate Daily Metrics

```typescript
import aggregates from './aggregated-daily.json';

// Find high-performance users
const eliteUsers = aggregates.filter(agg => 
  agg.multiSensorMetrics.averageConfidenceScore > 0.9 &&
  agg.averageIntensity > 0.7 &&
  agg.totalCalories > 500
);

// Calculate reward tiers
eliteUsers.forEach(user => {
  const rewardMultiplier = 
    user.multiSensorMetrics.averageConfidenceScore * 
    user.averageIntensity * 
    (user.activeDuration / 3600);
  
  console.log(`${user.wallet}: ${rewardMultiplier.toFixed(2)}x rewards`);
});
```

## Privacy Considerations

**CRITICAL**: This framework enables privacy-preserving motion attestations.

### On-Chain Storage
- ✅ Store keccak256 hashes of combined fitness + mocap data
- ✅ Store confidence scores (public trust metric)
- ✅ Store aggregate metrics (daily summaries)
- ❌ Never store raw motion capture files on-chain
- ❌ Never store personally identifiable health data on-chain

### Off-Chain Storage
- Encrypted S3/IPFS/Arweave for raw motion files
- Zero-knowledge proofs for sensitive health metrics
- User-controlled data deletion
- Granular consent management per data source

### Multi-Sensor Trust Model

Confidence scores calculated from:
1. **Source Diversity** - More independent sources = higher trust
2. **Cross-Validation** - Agreement between fitness tracker and mocap
3. **Temporal Consistency** - Realistic progression over time
4. **Biomechanical Plausibility** - Motion physics validation
5. **Device Reputation** - Known-good hardware attestation

## Data Source Integration Patterns

### Fivetran Connector Example

```yaml
# Fitbit API → Kinetic Ledger
connector:
  name: fitbit-motion-sync
  type: rest_api
  config:
    base_url: https://api.fitbit.com/1/user/-/
    endpoints:
      - path: activities/heart/date/{date}/1d/1min.json
        cursor_field: dateTime
        batch_size: 1000
      - path: activities/steps/date/{date}/1d/1min.json
    auth:
      type: oauth2
      token_url: https://api.fitbit.com/oauth2/token
      scopes: ["activity", "heartrate", "profile"]
    transformations:
      - name: enrich_with_mocap
        type: python
        script: |
          def transform(record):
            # Match fitness data with mocap files
            mocap_file = match_activity_to_mocap(record)
            return {
              **record,
              "mocap_validation": load_mocap_metadata(mocap_file),
              "confidence_score": calculate_confidence(record, mocap_file)
            }
      - name: hash_sensitive_fields
      - name: aggregate_by_wallet
```

### Webhook Integration (Real-Time)

```typescript
// apps/api-gateway/routes/webhooks.ts
app.post('/webhooks/fitness-tracker', async (req, res) => {
  const { device, event, data, signature } = req.body;
  
  // Verify HMAC signature
  const isValid = verifyHMAC(signature, process.env.WEBHOOK_SECRET, data);
  if (!isValid) return res.status(401).json({ error: 'Invalid signature' });
  
  // Match with mocap validation
  const mocapValidation = await matchMotionCapture(data.activity_type, data.duration);
  
  // Generate attestation
  const attestation = {
    wallet: data.user_wallet,
    timestamp: data.timestamp,
    source: 'multi-sensor-attestation',
    metadata: {
      fitnessTracker: data,
      mocapValidation,
      attestationSources: [device, 'mocap-sensor'],
      confidenceScore: calculateConfidence(data, mocapValidation),
      crossValidated: true
    }
  };
  
  // Queue for blockchain submission
  await queueAttestation(attestation);
  
  res.json({ status: 'received', confidence: attestation.metadata.confidenceScore });
});
```

## Testing Scale

Generate 1000+ hybrid events for performance testing:

```bash
# Generate synthetic multi-sensor data
node scripts/generate-motion-data.js \
  --count 1000 \
  --sources fitbit,garmin,mocap \
  --output data/samples/scale-test.json \
  --confidence-min 0.85

# Validate generated data
node scripts/validate-attestations.js \
  --input data/samples/scale-test.json \
  --check-cross-validation \
  --min-confidence 0.8
```

## Real-World Use Cases

### 1. Fitness Challenge Rewards
- Users earn USDC based on verified activity
- Multi-sensor validation prevents cheating
- Biomechanics ensure proper form
- Daily aggregates trigger automated payments

### 2. Insurance Premium Discounts
- Privacy-preserving health attestations
- Only share confidence scores + aggregates on-chain
- Raw data stays encrypted off-chain
- VO2max, HRV prove cardiovascular health

### 3. Athletic Performance NFTs
- Mint NFTs for verified athletic achievements
- Mocap data proves technique quality
- Fitness tracker confirms endurance metrics
- Immutable record of personal bests

### 4. VR Fitness Metaverse
- Cross-platform activity recognition
- Real-world fitness → metaverse rewards
- Multi-sensor prevents VR gaming exploits
- Spatial movement validation

## Architecture Benefits

✅ **Trust**: Multiple independent data sources increase confidence  
✅ **Privacy**: Only hashes and aggregates go on-chain  
✅ **Accuracy**: Mocap validates fitness tracker claims  
✅ **Scalability**: Stream processing handles 1000s of connectors  
✅ **Compliance**: GDPR/HIPAA-ready with encrypted storage  
✅ **Interoperability**: Works across wearables, IoT, VR platforms  

---

**Note**: This is sample data for development. Production deployments must implement proper key management, data encryption, user consent flows, and regulatory compliance.

