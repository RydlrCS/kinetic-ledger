import { logger, validateEnvironment, config_obj } from './config';
import { initializeSigner } from './signer';
import { initializeContracts, getUSDCBalance } from './contracts';
import { createMotionQueue, getProcessingStats, MotionEvent } from './processor';

// Circuit breaker state
let consecutiveFailures = 0;

/**
 * Health check for Arc RPC endpoint
 */
async function checkRPCHealth(provider: any): Promise<boolean> {
  try {
    const blockNumber = await provider.getBlockNumber();
    logger.trace(
      {
        service: 'agent-service',
        action: 'rpc_health_check',
        blockNumber,
      },
      'RPC health check passed'
    );
    consecutiveFailures = 0;
    return true;
  } catch (err) {
    consecutiveFailures++;
    logger.error(
      {
        service: 'agent-service',
        action: 'rpc_health_check_failed',
        consecutiveFailures,
        maxFailures: config_obj.rpc.maxConsecutiveFailures,
        err: err instanceof Error ? err.message : String(err),
      },
      'RPC health check failed'
    );

    if (consecutiveFailures >= config_obj.rpc.maxConsecutiveFailures) {
      logger.fatal(
        {
          service: 'agent-service',
          action: 'rpc_circuit_breaker_triggered',
          consecutiveFailures,
        },
        'RPC circuit breaker triggered - shutting down'
      );
      process.exit(20); // Exit code 20: chain/RPC unhealthy
    }

    return false;
  }
}

/**
 * Main service entry point
 */
async function main() {
  const startTime = Date.now();
  logger.info(
    {
      service: 'agent-service',
      version: '1.0.0',
      action: 'startup',
      timestamp: new Date().toISOString(),
      verbose: process.env.VERBOSE === 'true',
    },
    '🚀 ENTRY: Kinetic Ledger Agent Service starting'
  );

  // Validate environment
  logger.trace({ action: 'validate_environment' }, 'Validating environment variables');
  validateEnvironment();
  logger.trace({ action: 'validate_environment' }, '✅ Environment validation complete');

  // Initialize signer and contracts
  logger.trace({ action: 'initialize_signer' }, 'Initializing wallet signer');
  const { provider, wallet } = initializeSigner();
  logger.info({ action: 'signer_initialized', address: wallet.address }, '✅ Wallet signer initialized');
  
  logger.trace({ action: 'initialize_contracts' }, 'Initializing smart contracts');
  const contracts = initializeContracts(provider, wallet);
  logger.info({ action: 'contracts_initialized' }, '✅ Smart contracts initialized');

  // Check initial RPC health
  const healthy = await checkRPCHealth(provider);
  if (!healthy) {
    logger.fatal(
      { service: 'agent-service', action: 'startup_failed' },
      'RPC unhealthy on startup'
    );
    process.exit(20);
  }

  // Check USDC balance
  const balance = await getUSDCBalance(contracts.usdc, wallet.address);
  logger.info(
    {
      service: 'agent-service',
      action: 'usdc_balance_check',
      address: wallet.address,
      balance: (Number(balance) / 1e6).toFixed(2),
    },
    'Agent USDC balance retrieved'
  );

  // Create motion processing queue
  const queue = createMotionQueue(contracts);

  // Start periodic health checks
  setInterval(
    () => checkRPCHealth(provider),
    config_obj.rpc.healthCheckIntervalMs
  );

  // Example: Process sample motion events from data/samples
  // In production, this would listen to API gateway webhooks or Fivetran connectors
  const sampleEvents: MotionEvent[] = [
    {
      wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
      embedding: Array(128)
        .fill(0)
        .map(() => Math.random()),
      timestamp: Date.now(),
      source: 'fitness-tracker',
      metadata: {
        deviceId: 'apple-watch-001',
        activityType: 'running',
      },
    },
  ];

  logger.info(
    {
      service: 'agent-service',
      action: 'demo_mode',
      sampleEvents: sampleEvents.length,
    },
    'Running in demo mode with sample events'
  );

  for (const event of sampleEvents) {
    const result = await queue.push(event);
    logger.info(
      {
        service: 'agent-service',
        action: 'demo_result',
        success: result.success,
        txHash: result.txHash,
        tokenId: result.tokenId,
      },
      'Demo event processed'
    );
  }

  // Log final stats
  const stats = getProcessingStats();
  logger.info(
    {
      service: 'agent-service',
      action: 'processing_stats',
      ...stats,
    },
    'Processing statistics'
  );

  logger.info(
    {
      service: 'agent-service',
      action: 'ready',
      uptimeMs: Date.now() - startTime,
    },
    '✅ Agent service ready and listening'
  );

  // Keep process alive
  // In production, this would be an HTTP server listening for webhooks
  process.on('SIGINT', () => {
    logger.info(
      { service: 'agent-service', action: 'shutdown', signal: 'SIGINT' },
      '🏁 EXIT: Graceful shutdown initiated'
    );
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info(
      { service: 'agent-service', action: 'shutdown', signal: 'SIGTERM' },
      '🏁 EXIT: Graceful shutdown initiated'
    );
    process.exit(0);
  });
}

// Error handlers
process.on('uncaughtException', (err) => {
  logger.fatal(
    {
      service: 'agent-service',
      action: 'uncaught_exception',
      err: err.message,
      stack: err.stack,
    },
    'Uncaught exception - shutting down'
  );
  process.exit(60); // Exit code 60: unexpected/unhandled
});

process.on('unhandledRejection', (reason) => {
  logger.fatal(
    {
      service: 'agent-service',
      action: 'unhandled_rejection',
      reason: String(reason),
    },
    'Unhandled promise rejection - shutting down'
  );
  process.exit(60);
});

// Start the service
main().catch((err) => {
  logger.fatal(
    {
      service: 'agent-service',
      action: 'startup_error',
      err: err instanceof Error ? err.message : String(err),
    },
    'Failed to start agent service'
  );
  process.exit(60);
});
