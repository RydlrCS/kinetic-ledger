import { config } from 'dotenv';
import pino from 'pino';

config();

// Logging configuration
const verbose = process.env.VERBOSE === 'true';
export const logger = pino({
  level: verbose ? 'trace' : (process.env.LOG_LEVEL || 'info'),
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
  },
});

// Environment validation
const requiredEnvVars = [
  'ARC_RPC_URL',
  'AGENT_PRIVATE_KEY',
  'MOTION_NOVELTY_DETECTOR_ADDRESS',
  'MOTION_MINT_ORCHESTRATOR_ADDRESS',
  'ATTESTED_MOTION_ADDRESS',
  'USDC_TOKEN_ADDRESS',
];

export function validateEnvironment(): void {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error({ missing }, 'Missing required environment variables');
    process.exit(10); // Exit code 10: config/env invalid
  }
}

// Configuration object
export const config_obj = {
  rpc: {
    url: process.env.ARC_RPC_URL!,
    healthCheckIntervalMs: Number(process.env.RPC_HEALTH_CHECK_INTERVAL_MS) || 30000,
    maxConsecutiveFailures: Number(process.env.MAX_CONSECUTIVE_FAILURES) || 5,
  },
  contracts: {
    noveltyDetector: process.env.MOTION_NOVELTY_DETECTOR_ADDRESS!,
    orchestrator: process.env.MOTION_MINT_ORCHESTRATOR_ADDRESS!,
    attestedMotion: process.env.ATTESTED_MOTION_ADDRESS!,
    usdc: process.env.USDC_TOKEN_ADDRESS!,
  },
  agent: {
    privateKey: process.env.AGENT_PRIVATE_KEY!,
  },
  api: {
    gatewayUrl: process.env.API_GATEWAY_URL || 'http://localhost:8000',
    webhookSecret: process.env.API_WEBHOOK_SECRET || '',
  },
  processing: {
    batchSize: Number(process.env.BATCH_SIZE) || 100,
    maxQueueSize: Number(process.env.MAX_QUEUE_SIZE) || 10000,
    retryAttempts: Number(process.env.RETRY_ATTEMPTS) || 3,
    retryBackoffMs: Number(process.env.RETRY_BACKOFF_MS) || 500,
  },
  eip712: {
    chainId: Number(process.env.CHAIN_ID) || 421614,
    domainName: process.env.DOMAIN_NAME || 'MotionNoveltyDetector',
    domainVersion: process.env.DOMAIN_VERSION || '1',
  },
};
