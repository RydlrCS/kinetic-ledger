/**
 * Motion Data Structures
 * 
 * Off-chain motion data models for:
 * - Fitness tracking integration
 * - IoT sensor data
 * - Third-party data connectors (Fivetran, APIs, CSV)
 */

/**
 * Motion event from external data source
 */
export interface MotionEvent {
  /** User's wallet address */
  wallet: `0x${string}`;
  
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  
  /** Data source identifier */
  source: string;
  
  /** Motion metric type */
  metricType: 'steps' | 'distance' | 'calories' | 'heart_rate' | 'duration' | 'custom';
  
  /** Metric value */
  value: number;
  
  /** Optional unit of measurement */
  unit?: string;
  
  /** Optional metadata (device info, location, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated motion data for a time period
 */
export interface MotionAggregate {
  wallet: `0x${string}`;
  periodStart: string;
  periodEnd: string;
  totalSteps: number;
  totalDistance: number;
  totalCalories: number;
  averageHeartRate?: number;
  activeDuration: number; // seconds
  dataPoints: number; // count of raw events
}

/**
 * Motion data hash (what goes on-chain)
 */
export interface MotionDataHash {
  /** keccak256 hash of raw motion data */
  hash: `0x${string}`;
  
  /** Nonce for this attestation */
  nonce: bigint;
  
  /** Expiry timestamp */
  expiry: bigint;
  
  /** Optional reference to off-chain storage (IPFS, Arweave, etc.) */
  storageUri?: string;
}

/**
 * Fivetran connector configuration
 */
export interface FivetranConnectorConfig {
  connectorId: string;
  connectorType: 'api' | 'database' | 'file' | 'event_stream';
  sourceTable: string;
  cursorField: string; // For incremental sync
  batchSize: number;
  transformations: string[]; // List of dbt models to apply
}

/**
 * Data pipeline batch
 */
export interface MotionBatch {
  batchId: string;
  events: MotionEvent[];
  processedAt: string;
  sourceConnector: string;
}

/**
 * Helper to compute motion data hash
 */
export function computeMotionHash(data: MotionEvent | MotionAggregate): `0x${string}` {
  // In production, use keccak256 from viem
  // For now, return placeholder
  const jsonStr = JSON.stringify(data);
  return `0x${Buffer.from(jsonStr).toString('hex').slice(0, 64)}` as `0x${string}`;
}

/**
 * Validate motion event schema
 */
export function isValidMotionEvent(obj: unknown): obj is MotionEvent {
  const event = obj as MotionEvent;
  return (
    typeof event.wallet === 'string' &&
    event.wallet.startsWith('0x') &&
    typeof event.timestamp === 'string' &&
    typeof event.source === 'string' &&
    ['steps', 'distance', 'calories', 'heart_rate', 'duration', 'custom'].includes(event.metricType) &&
    typeof event.value === 'number'
  );
}
