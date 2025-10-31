import fastq, { queueAsPromised } from 'fastq';
import { logger, config_obj } from './config';
import { hashMotionEmbedding, signMotionAttestation, MotionAttestationData } from './signer';
import { ContractInterfaces, submitVerifyAndMint, checkEmbeddingExists } from './contracts';

export interface MotionEvent {
  wallet: string;
  embedding: number[];
  timestamp: number;
  source: string; // 'fitness-tracker' | 'mocap' | 'iot-sensor'
  metadata?: {
    deviceId?: string;
    sessionId?: string;
    activityType?: string;
  };
}

export interface ProcessingResult {
  success: boolean;
  wallet: string;
  embeddingHash?: string;
  txHash?: string;
  tokenId?: string;
  error?: string;
}

let processedCount = 0;
let failedCount = 0;

/**
 * Process a single motion event through the full pipeline:
 * 1. Hash embedding
 * 2. Check if already processed (deduplication)
 * 3. Generate EIP-712 signature
 * 4. Submit verifyAndMint transaction
 */
async function processMotionEvent(
  event: MotionEvent,
  contracts: ContractInterfaces
): Promise<ProcessingResult> {
  const trace_id = `motion_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  try {
    logger.debug(
      {
        service: 'agent-service',
        action: 'motion_event_received',
        wallet: event.wallet,
        source: event.source,
        embeddingDim: event.embedding.length,
        trace_id,
      },
      'Processing motion event'
    );

    // Step 1: Hash embedding
    const embeddingHash = hashMotionEmbedding(event.embedding);

    // Step 2: Check if already processed (deduplication)
    const exists = await checkEmbeddingExists(contracts.noveltyDetector, embeddingHash);
    if (exists) {
      logger.info(
        {
          service: 'agent-service',
          action: 'duplicate_detected',
          wallet: event.wallet,
          embeddingHash,
          trace_id,
        },
        'Embedding already processed - skipping'
      );
      return {
        success: false,
        wallet: event.wallet,
        embeddingHash,
        error: 'Duplicate embedding',
      };
    }

    // Step 3: Generate attestation and signature
    const nonce = BigInt(Date.now());
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour validity

    const attestation: MotionAttestationData = {
      to: event.wallet,
      embeddingHash,
      nonce,
      expiry,
    };

    const signature = await signMotionAttestation(contracts.wallet, attestation);

    // Step 4: Submit to orchestrator
    const complianceMetadata = {
      jurisdiction: 'KE', // Kenya for IX Africa deployment
      vaspLicense: 'KE-VASP-2025-001', // Example VASP license
      userConsent: 'motion_data_processing_v1', // Consent version
    };

    const result = await submitVerifyAndMint(contracts.orchestrator, {
      to: event.wallet,
      embedding: event.embedding,
      nonce,
      expiry,
      signature,
      complianceMetadata,
    });

    processedCount++;
    logger.info(
      {
        service: 'agent-service',
        action: 'motion_processed',
        wallet: event.wallet,
        embeddingHash,
        txHash: result.txHash,
        tokenId: result.tokenId?.toString(),
        processedTotal: processedCount,
        trace_id,
      },
      'Motion event successfully processed'
    );

    return {
      success: true,
      wallet: event.wallet,
      embeddingHash,
      txHash: result.txHash,
      tokenId: result.tokenId?.toString(),
    };
  } catch (err) {
    failedCount++;
    const errorMsg = err instanceof Error ? err.message : String(err);

    logger.error(
      {
        service: 'agent-service',
        action: 'motion_processing_failed',
        wallet: event.wallet,
        err: errorMsg,
        failedTotal: failedCount,
        trace_id,
      },
      'Failed to process motion event'
    );

    return {
      success: false,
      wallet: event.wallet,
      error: errorMsg,
    };
  }
}

/**
 * Create a worker queue for processing motion events with concurrency control
 */
export function createMotionQueue(
  contracts: ContractInterfaces
): queueAsPromised<MotionEvent, ProcessingResult> {
  const queue = fastq.promise(
    async (event: MotionEvent) => processMotionEvent(event, contracts),
    1 // Process one at a time to avoid nonce conflicts
  );

  logger.info(
    {
      service: 'agent-service',
      action: 'queue_initialized',
      maxQueueSize: config_obj.processing.maxQueueSize,
    },
    'Motion processing queue created'
  );

  return queue;
}

/**
 * Batch processor for streaming large datasets without memory overflow
 */
export async function processBatch(
  events: MotionEvent[],
  contracts: ContractInterfaces
): Promise<ProcessingResult[]> {
  const queue = createMotionQueue(contracts);
  const results: ProcessingResult[] = [];

  logger.info(
    {
      service: 'agent-service',
      action: 'batch_processing_started',
      batchSize: events.length,
    },
    'Starting batch processing'
  );

  for (const event of events) {
    // Check queue size to prevent memory issues
    if (queue.length() >= config_obj.processing.maxQueueSize) {
      logger.warn(
        {
          service: 'agent-service',
          action: 'queue_full',
          queueSize: queue.length(),
          maxQueueSize: config_obj.processing.maxQueueSize,
        },
        'Queue full - waiting for processing to catch up'
      );
      // Wait for queue to drain before adding more
      await queue.drained();
    }

    const result = await queue.push(event);
    results.push(result);
  }

  // Wait for all events to complete
  await queue.drained();

  logger.info(
    {
      service: 'agent-service',
      action: 'batch_processing_completed',
      total: events.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
    'Batch processing completed'
  );

  return results;
}

/**
 * Get processing statistics
 */
export function getProcessingStats() {
  return {
    processedCount,
    failedCount,
    successRate: processedCount > 0 ? processedCount / (processedCount + failedCount) : 0,
  };
}
