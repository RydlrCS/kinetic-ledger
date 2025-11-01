# Logging & Observability Guide

## Overview

Kinetic Ledger implements **comprehensive verbose entry/exit logging** across all services for production monitoring, debugging, and compliance auditing. This guide explains the logging architecture, configuration, and best practices.

## Architecture

### Logging Frameworks

| Service | Framework | Format | Control |
|---------|-----------|--------|---------|
| **web-dapp** | Custom console logging | Prefixed with `[Motion Studio]` + ISO timestamps | `NEXT_PUBLIC_VERBOSE=true` or `NODE_ENV=development` |
| **agent-service** | pino (structured JSON) | Structured JSON with service metadata | `VERBOSE=true` or `LOG_LEVEL=trace` |
| **api-gateway** | structlog (structured JSON) | Structured JSON with trace IDs | `VERBOSE=true` or `LOG_LEVEL=DEBUG` |

### Logging Levels

- **TRACE**: Finest-grained diagnostic information (environment validation, initialization steps)
- **DEBUG**: Detailed entry/exit logging for all functions (enabled by `VERBOSE=true`)
- **INFO**: Significant events (startup, ready, shutdown, transaction success)
- **WARN**: Potential issues (missing secrets, rate limits, validation failures)
- **ERROR**: Errors requiring attention (RPC failures, signature verification failures)

## Emoji Markers

All services use **emoji markers** for visual parsing of log streams:

| Emoji | Meaning | Usage |
|-------|---------|-------|
| 🚀 | **ENTRY** | Function/component start |
| 🏁 | **EXIT** | Graceful shutdown, component unmount |
| ✅ | **SUCCESS** | Successful operation, validation passed |
| 🔌 | **WALLET** | Wallet connection/disconnection |
| 🔍 | **VALIDATE** | Motion validation, AI quality checks |
| 🪙 | **MINT** | Token minting operations |
| 🏃 | **FITNESS** | Fitness tracker webhook events |
| 🎥 | **MOCAP** | Motion capture webhook events |
| 📜 | **ATTESTATION** | Attestation generation |

## Configuration

### Web Dapp (Next.js)

```bash
# .env (or .env.local for local development)
NEXT_PUBLIC_VERBOSE=true  # Enable verbose logging
NODE_ENV=development      # Auto-enables verbose logging
```

**Example logs:**
```
[Motion Studio] 2025-11-01T12:34:56.789Z 🚀 ENTRY: MotionStudioPage component mounted
[Motion Studio] 2025-11-01T12:35:01.234Z 🔌 ENTRY: handleConnect
[Motion Studio] 2025-11-01T12:35:02.456Z ✅ EXIT: handleConnect - wallet connected: 0x742d...B79C
[Motion Studio] 2025-11-01T12:36:10.789Z 🔍 ENTRY: handleValidate
[Motion Studio] 2025-11-01T12:36:12.890Z ✅ EXIT: handleValidate - validation passed, quality: passed
[Motion Studio] 2025-11-01T12:37:20.123Z 🪙 ENTRY: handleMint { type: 'unique', distribution: 'direct' }
[Motion Studio] 2025-11-01T12:37:23.456Z ✅ EXIT: handleMint - token minted, new balance: 493 USDC
```

### Agent Service (TypeScript/Node.js)

```bash
# .env
VERBOSE=true     # Enable entry/exit logging
LOG_LEVEL=trace  # Or debug, info, warn, error
```

**Example logs:**
```json
{"level":"info","service":"agent-service","version":"1.0.0","action":"startup","timestamp":"2025-11-01T12:00:00.000Z","verbose":true,"msg":"🚀 ENTRY: Kinetic Ledger Agent Service starting"}
{"level":"trace","action":"validate_environment","msg":"Validating environment variables"}
{"level":"trace","action":"validate_environment","msg":"✅ Environment validation complete"}
{"level":"trace","action":"initialize_signer","msg":"Initializing wallet signer"}
{"level":"info","action":"signer_initialized","address":"0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C","msg":"✅ Wallet signer initialized"}
{"level":"info","service":"agent-service","action":"ready","uptimeMs":1234,"msg":"✅ Agent service ready and listening"}
{"level":"info","service":"agent-service","action":"shutdown","signal":"SIGTERM","msg":"🏁 EXIT: Graceful shutdown initiated"}
```

### API Gateway (Python/FastAPI)

```bash
# .env
VERBOSE=true      # Enable entry/exit logging
LOG_LEVEL=DEBUG   # Or INFO, WARNING, ERROR
```

**Example logs:**
```json
{"event":"api_gateway_starting","app_name":"Kinetic Ledger API Gateway","version":"1.0.0","environment":"production","arc_chain_id":421614,"verbose":true,"timestamp":"2025-11-01T12:00:00.000000","logger":"root","level":"info"}
{"event":"🚀 ENTRY: Kinetic Ledger API Gateway starting","logger":"root","level":"info","timestamp":"2025-11-01T12:00:00.100000"}
{"event":"validating_critical_settings","logger":"root","level":"debug","timestamp":"2025-11-01T12:00:00.150000"}
{"event":"✅ webhook_secret_configured","logger":"root","level":"debug","timestamp":"2025-11-01T12:00:00.200000"}
{"event":"✅ API Gateway ready and listening","uptime_ms":234.5,"logger":"root","level":"info","timestamp":"2025-11-01T12:00:00.234000"}
{"event":"🏃 ENTRY: fitness_tracker_webhook","wallet":"0x742d...B79C","trace_id":"trace_1730462400000","logger":"root","level":"debug","timestamp":"2025-11-01T12:05:30.000000"}
{"event":"✅ EXIT: fitness_tracker_webhook - event queued","data_hash":"abc123...def456","trace_id":"trace_1730462400000","logger":"root","level":"debug","timestamp":"2025-11-01T12:05:30.123000"}
```

## Structured Context

All logs include **structured metadata** for filtering and analysis:

### Common Fields

- `timestamp`: ISO 8601 timestamp
- `service`: Service name (`agent-service`, `api-gateway`, `Motion Studio`)
- `action`: Action type (`startup`, `ready`, `shutdown`, `wallet_connect`, etc.)
- `trace_id`: Distributed tracing ID (propagated across service boundaries)

### Web Dapp Specific

- `wallet`: User wallet address (truncated to 0x742d...B79C for privacy)
- `balance`: USDC balance
- `quality`: AI validation result (`passed`, `failed`)
- `type`: Token type (`unique`, `multi`)

### Agent Service Specific

- `version`: Service version
- `verbose`: Whether verbose logging is enabled
- `address`: Signer wallet address
- `uptimeMs`: Service uptime in milliseconds
- `signal`: Shutdown signal type (`SIGINT`, `SIGTERM`)

### API Gateway Specific

- `method`: HTTP method (`POST`, `GET`)
- `path`: Request path (`/webhooks/fitness-tracker`)
- `status_code`: HTTP response code
- `duration_ms`: Request duration in milliseconds
- `client_ip`: Client IP address
- `data_hash`: Motion data hash (truncated)
- `nonce`: EIP-712 nonce
- `expiry`: EIP-712 expiry timestamp

## Compliance & Privacy

### What We Log

✅ **Logged (safe for compliance)**:
- Wallet addresses (public blockchain data)
- Transaction hashes, nonces, expiries
- Motion data **hashes** (keccak256, not raw data)
- AI quality scores, confidence metrics
- Request/response metadata (trace IDs, durations)
- Service lifecycle events (startup, ready, shutdown)
- Uptime metrics, performance data

### What We DON'T Log

❌ **Never logged (PII/sensitive data)**:
- Private keys, mnemonics, seed phrases
- Raw motion data (only hashes stored)
- Full user names, emails, phone numbers
- Device IDs beyond manufacturer (e.g., "Apple" OK, "iPhone serial ABC123" NOT OK)
- Biometric data, health metrics
- Location coordinates (only country-level aggregates)

### Compliance Checkpoints

All critical operations log **compliance verification**:

```json
{"event":"motion_event_received","wallet":"0x742d...","nonce":123,"compliance_check":"passed","kyc_verified":true,"sanctions_check":"cleared","trace_id":"trace_123"}
```

## Production Monitoring

### Recommended Stack

- **Log Aggregation**: Datadog, New Relic, Elasticsearch + Kibana
- **Alerting**: PagerDuty, Opsgenie
- **Dashboards**: Grafana with Loki backend

### Key Metrics to Monitor

1. **Service Health**:
   - `action=startup` + `action=ready` = successful boot
   - `uptimeMs` < 2000 = fast startup (healthy)
   - `signal=SIGTERM` = graceful shutdown

2. **RPC Health**:
   - `action=rpc_health_check` + `status=healthy`
   - Exit code `20` = RPC unhealthy (circuit breaker triggered)

3. **Transaction Success**:
   - `action=attestation_generated` = successful attestation
   - `action=token_minted` = successful mint
   - `status_code=200` on API endpoints

4. **Error Rates**:
   - `level=error` count per minute
   - `action=hmac_verification_failed` = potential attack
   - `rate_limit_exceeded` = client throttling

### Alerting Rules

```yaml
# Example Datadog monitor
alert: AgentServiceDown
condition: action="shutdown" AND signal!="SIGTERM"
threshold: 1 occurrence in 5 minutes
action: Page on-call engineer

alert: HighErrorRate
condition: level="error" count > 10 in 1 minute
threshold: critical
action: Slack notification + page if sustained

alert: RPCUnhealthy
condition: action="rpc_health_check" AND status="unhealthy"
threshold: 3 consecutive failures
action: Auto-failover + page
```

## Debugging Workflows

### Local Development

1. **Enable verbose logging**:
   ```bash
   # Web dapp
   echo "NEXT_PUBLIC_VERBOSE=true" >> apps/web-dapp/.env.local
   
   # Agent service
   echo "VERBOSE=true" >> apps/agent-service/.env
   
   # API gateway
   echo "VERBOSE=true" >> apps/api-gateway/.env
   ```

2. **Restart services**:
   ```bash
   pnpm dev  # Restarts all services with new env
   ```

3. **Check browser console** (F12 → Console) for web-dapp logs

4. **Check terminal output** for agent-service and api-gateway logs

### Production Debugging

1. **Get trace ID** from user-reported error (visible in UI or API response)

2. **Query logs by trace ID**:
   ```bash
   # Datadog
   trace_id:trace_1730462400000
   
   # Elasticsearch
   GET /logs/_search
   {
     "query": { "match": { "trace_id": "trace_1730462400000" } },
     "sort": [{ "timestamp": "asc" }]
   }
   ```

3. **Follow request flow**:
   - Web dapp: `🔌 ENTRY: handleConnect`
   - API gateway: `request_received` → `fitness_tracker_event_received` → `motion_data_hashed`
   - Agent service: `motion_event_processed` → `attestation_generated`
   - Blockchain: `transaction_submitted` → `transaction_confirmed`

4. **Identify failure point**:
   - Look for last successful log before error
   - Check for missing `✅ EXIT` log (indicates crash/timeout)
   - Review error logs: `level=error` with stack traces

## Exit Codes

The agent service uses **documented exit codes** for operational clarity:

| Code | Meaning | Trigger | Action |
|------|---------|---------|--------|
| `0` | Clean shutdown | SIGINT, SIGTERM | None (expected) |
| `10` | Config/env invalid | Missing required env vars | Check `.env` file |
| `20` | RPC unhealthy | Circuit breaker triggered | Check Arc RPC status |
| `30` | Wallet signing failure | Invalid private key | Rotate validator key |
| `40` | Attestation failure | EIP-712 signing error | Check contract config |
| `50` | Contract revert | On-chain validation failed | Review transaction logs |
| `60` | Unexpected error | Uncaught exception | Debug stack trace |

**Example usage**:
```typescript
// In Kubernetes restart policy
if (exitCode === 20) {
  // RPC unhealthy - wait 30s before restart
  sleep(30);
} else if (exitCode === 60) {
  // Unexpected error - restart immediately
  restart();
}
```

## Performance Considerations

### Verbose Logging Overhead

- **Web Dapp**: ~5-10ms per user action (negligible)
- **Agent Service**: ~1-2ms per attestation (pino is fast)
- **API Gateway**: ~0.5-1ms per request (structlog buffered)

**Recommendation**: Enable `VERBOSE=true` in production for first 2 weeks post-launch, then disable for high-traffic endpoints.

### Log Volume Estimates

| Service | Logs/Hour (Normal) | Logs/Hour (Verbose) | Daily Volume (Verbose) |
|---------|---------------------|----------------------|-------------------------|
| Web Dapp | 100 | 500 | ~10 MB |
| Agent Service | 500 | 2,000 | ~50 MB |
| API Gateway | 1,000 | 5,000 | ~100 MB |
| **Total** | 1,600 | 7,500 | **~160 MB/day** |

At scale (10K users): ~1.6 GB/day

**Cost optimization**:
- Use log sampling for high-volume endpoints (e.g., 10% sample rate)
- Set retention policy: 7 days hot, 30 days warm, 1 year cold
- Compress logs with gzip (70% reduction)

## Best Practices

1. **Always include trace IDs**: Propagate across service boundaries
2. **Log context, not secrets**: Hash sensitive data before logging
3. **Use structured logging**: JSON for machine parsing, not unstructured strings
4. **Monitor log volume**: Alert if logs spike (potential attack or bug)
5. **Test logging in CI**: Verify critical logs appear in tests
6. **Document log fields**: Keep this guide updated as fields change
7. **Use emoji consistently**: Easier to visually scan production logs
8. **Enable verbose on errors**: Temporarily enable for debugging, then disable

## Troubleshooting

### "Logs not appearing"

- Check `VERBOSE` flag is set to `true` in `.env`
- Restart service to load new environment variables
- Verify log level: `LOG_LEVEL=trace` or `LOG_LEVEL=DEBUG`
- Check log output destination: stdout, file, or remote service

### "Too many logs"

- Reduce log level: `LOG_LEVEL=info` (from `trace` or `debug`)
- Disable verbose: `VERBOSE=false`
- Use log sampling for high-traffic endpoints
- Increase log rotation frequency

### "Missing context in logs"

- Ensure `trace_id` is propagated: Check `X-Trace-ID` header
- Verify structured fields: Use JSON parsing, not string matching
- Check timestamp format: ISO 8601 required for chronological sorting

## References

- **pino documentation**: https://getpino.io/
- **structlog documentation**: https://www.structlog.org/
- **EIP-712 specification**: https://eips.ethereum.org/EIPS/eip-712
- **Arc blockchain docs**: https://docs.circle.com/arc
- **Datadog logging guide**: https://docs.datadoghq.com/logs/

---

**Last updated**: Nov 1, 2025  
**Maintained by**: Kinetic Ledger Team  
**Questions?**: Open an issue on [GitHub](https://github.com/RydlrCS/kinetic-ledger/issues)
