/**
 * API Contract Types
 * 
 * Request/response schemas for:
 * - API Gateway endpoints
 * - Agent service webhooks
 * - Contract interaction payloads
 */

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    rpc: boolean;
    database?: boolean;
    cache?: boolean;
  };
}

/**
 * Attestation generation request
 */
export interface AttestationRequest {
  /** Recipient wallet address */
  to: `0x${string}`;
  
  /** Raw motion data to attest */
  motionData: unknown; // MotionEvent or MotionAggregate
  
  /** Optional expiry duration in seconds (default: 300) */
  expiryDuration?: number;
}

/**
 * Attestation generation response
 */
export interface AttestationResponse {
  /** Signature from trusted validator */
  signature: `0x${string}`;
  
  /** Hash of motion data */
  dataHash: `0x${string}`;
  
  /** Nonce for this attestation */
  nonce: string;
  
  /** Expiry timestamp (Unix seconds) */
  expiry: string;
  
  /** Validator address that signed */
  validator: `0x${string}`;
}

/**
 * Mint transaction request
 */
export interface MintRequest {
  /** Attestation details */
  attestation: AttestationResponse;
  
  /** Gas price override (optional) */
  gasPrice?: string;
}

/**
 * Transaction response
 */
export interface TransactionResponse {
  /** Transaction hash */
  txHash: `0x${string}`;
  
  /** Block number (null if pending) */
  blockNumber: number | null;
  
  /** Status */
  status: 'pending' | 'success' | 'failed';
  
  /** Error message if failed */
  error?: string;
  
  /** Gas used */
  gasUsed?: string;
}

/**
 * Webhook event from external data source
 */
export interface WebhookEvent {
  /** Event ID for idempotency */
  eventId: string;
  
  /** Event type */
  type: 'motion.created' | 'motion.updated' | 'payment.authorized' | 'payment.completed';
  
  /** Event timestamp */
  timestamp: string;
  
  /** Event payload */
  data: unknown;
  
  /** HMAC signature (hex) */
  signature?: string;
}

/**
 * HMAC verification result
 */
export interface HMACVerification {
  valid: boolean;
  error?: string;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Contract deployment info
 */
export interface ContractInfo {
  address: `0x${string}`;
  chainId: number;
  deployedAt: string;
  deployer: `0x${string}`;
  blockNumber: number;
}

/**
 * API rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}
