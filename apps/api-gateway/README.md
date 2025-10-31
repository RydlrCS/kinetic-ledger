# Kinetic Ledger API Gateway

FastAPI service providing HMAC-authenticated webhooks, rate limiting, and attestation generation for the Kinetic Ledger motion tokenization platform.

## Features

- ✅ **HMAC Webhook Authentication**: Secure webhook verification for fitness trackers and mocap systems
- ✅ **Rate Limiting**: In-memory rate limiting (100 req/60s per IP by default)
- ✅ **CORS Support**: Configurable for web dapp integration
- ✅ **Structured Logging**: JSON logging with trace IDs using structlog
- ✅ **Health Checks**: Health, readiness, and liveness endpoints for Kubernetes
- ✅ **Verbose Mode**: Detailed logging with `VERBOSE=true` environment variable
- ✅ **Motion Event Processing**: Fitness tracker and mocap webhook handlers
- ✅ **Attestation API**: Generate EIP-712 attestations for motion novelty

## Installation

```bash
cd apps/api-gateway

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

## Configuration

Edit `.env` file:

```bash
# Security - CRITICAL: Change this!
AGENT_WEBHOOK_SECRET=your-secret-key-here

# Arc Blockchain
ARC_RPC_URL=https://rpc.arc-testnet.circle.com

# Contract Addresses (after deployment)
NOVELTY_DETECTOR_ADDRESS=0x...
ATTESTED_MOTION_ADDRESS=0x...

# Logging
VERBOSE=true  # Enable detailed logging
LOG_LEVEL=INFO
```

## Running

### Development Mode
```bash
# With auto-reload
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode
```bash
ENV=production uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### With Docker
```bash
docker build -t kinetic-api-gateway .
docker run -p 8000:8000 --env-file .env kinetic-api-gateway
```

## API Endpoints

### Health Checks
- `GET /` - Root endpoint with service info
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (validates configuration)
- `GET /health/live` - Liveness check (minimal response)

### Webhooks (Require HMAC Signature)
- `POST /webhooks/fitness-tracker` - Fitness tracker motion events
- `POST /webhooks/mocap` - Motion capture system events

### Attestations
- `POST /attestations/generate` - Generate EIP-712 motion attestation

### Documentation
- `GET /docs` - Swagger UI (auto-generated)
- `GET /redoc` - ReDoc documentation

## HMAC Signature Verification

Webhooks require an `X-Signature` header with HMAC-SHA256 signature:

### Python Example
```python
import hmac
import hashlib
import httpx

secret = "your-webhook-secret"
payload = {"wallet": "0x123...", "event_type": "walking", ...}
body = json.dumps(payload).encode()

signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

response = httpx.post(
    "http://localhost:8000/webhooks/fitness-tracker",
    json=payload,
    headers={"X-Signature": f"sha256={signature}"}
)
```

### JavaScript/TypeScript Example
```typescript
import crypto from 'crypto';
import fetch from 'node-fetch';

const secret = 'your-webhook-secret';
const payload = { wallet: '0x123...', event_type: 'walking', ... };
const body = JSON.stringify(payload);

const signature = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

const response = await fetch('http://localhost:8000/webhooks/fitness-tracker', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': `sha256=${signature}`,
  },
  body,
});
```

## Request/Response Examples

### Fitness Tracker Webhook
```bash
curl -X POST http://localhost:8000/webhooks/fitness-tracker \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=..." \
  -d '{
    "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "event_type": "walking",
    "timestamp": 1698745200,
    "motion_data": {
      "steps": 5420,
      "distance": 3.8,
      "heart_rate": 98,
      "duration": 2400
    },
    "metadata": {
      "device": "Fitbit Charge 6",
      "source": "fitness_tracker"
    }
  }'
```

**Response:**
```json
{
  "status": "accepted",
  "data_hash": "a1b2c3d4e5f6...",
  "trace_id": "trace_1698745234567",
  "message": "Motion event queued for processing"
}
```

### Generate Attestation
```bash
curl -X POST http://localhost:8000/attestations/generate \
  -H "Content-Type: application/json" \
  -d '{
    "embedding_hash": "0xa1b2c3d4...",
    "confidence_score": 9600,
    "local_density": 5000,
    "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "compliance": {
      "jurisdictionTag": "KE",
      "vaspLicenseId": "VASP-KE-2025-001",
      "userConsent": true
    }
  }'
```

**Response:**
```json
{
  "status": "generated",
  "nonce": 1698745234,
  "expiry": 1698745534,
  "trace_id": "trace_1698745234567"
}
```

## Structured Logging

All logs are JSON-formatted with structured fields:

```json
{
  "event": "request_received",
  "method": "POST",
  "path": "/webhooks/fitness-tracker",
  "trace_id": "trace_1698745234567",
  "client_ip": "192.168.1.100",
  "timestamp": "2025-10-31T12:34:56.789Z",
  "level": "info"
}
```

Enable verbose logging:
```bash
VERBOSE=true python main.py
```

## Rate Limiting

Default: 100 requests per 60 seconds per IP address.

Configure via environment variables:
```bash
RATE_LIMIT_REQUESTS=200
RATE_LIMIT_WINDOW=60
```

**Response on rate limit:**
```json
{
  "detail": "Rate limit: 100 req/60s"
}
```
HTTP Status: `429 Too Many Requests`

## Error Handling

All errors return structured JSON with trace IDs:

```json
{
  "error": "Invalid signature",
  "detail": null,
  "trace_id": "trace_1698745234567"
}
```

## Integration with Kinetic Ledger

### Flow
1. **Fitness Tracker** → POST `/webhooks/fitness-tracker` (HMAC signed)
2. **API Gateway** → Hash motion data, validate signature
3. **Agent Service** → Compute RkCNN novelty score
4. **API Gateway** → POST `/attestations/generate`
5. **NoveltyDetector Contract** → Verify attestation on-chain
6. **Orchestrator Contract** → Mint NFT if novel

### Security
- HMAC signatures prevent unauthorized webhook calls
- Rate limiting prevents DoS attacks
- Trace IDs enable end-to-end request tracking
- Compliance metadata for VASP Act 2025

## Deployment

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api-gateway
        image: kinetic-ledger/api-gateway:latest
        ports:
        - containerPort: 8000
        env:
        - name: ENV
          value: "production"
        - name: AGENT_WEBHOOK_SECRET
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: webhook-secret
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8000
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8000
```

### Production Considerations
- [ ] Use Redis for distributed rate limiting
- [ ] Enable HTTPS/TLS termination
- [ ] Implement request signing with agent private keys
- [ ] Add metrics (Prometheus/Grafana)
- [ ] Set up log aggregation (ELK stack)
- [ ] Configure auto-scaling based on load

## Testing

```bash
# Run health check
curl http://localhost:8000/health

# Test with verbose logging
VERBOSE=true python main.py

# Check API documentation
open http://localhost:8000/docs
```

## License

MIT License - See LICENSE file for details
