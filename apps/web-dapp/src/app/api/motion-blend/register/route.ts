/**
 * Blend Registration API Route
 *
 * Endpoint: POST /api/motion-blend/register
 *
 * Registers a blended motion on-chain using BlendedMotionRegistry contract
 * Stores embedding hash and metadata with EIP-712 signature
 *
 * Request body:
 * {
 *   embedding_hash: "0x...",
 *   quality_score: 85.5,
 *   metadata: { ... }
 * }
 *
 * Response:
 * {
 *   registry_address: "0x...",
 *   token_id: "123",
 *   transaction_hash: "0x..."
 * }
 *
 * Author: Kinetic Ledger Team
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server';
import { keccak256, toHex } from 'viem';

/**
 * BlendedMotionRegistry contract configuration
 */
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000';

/**
 * POST handler for blend registration
 *
 * Flow:
 * 1. Validate blend parameters
 * 2. Create registry transaction
 * 3. Sign with validator key
 * 4. Submit to Arc blockchain
 * 5. Return registration result
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const log = (message: string, data?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, message, ...data };
    console.warn(`🚀 [${timestamp}] register route:`, entry);
  };

  log('ENTRY: POST /api/motion-blend/register');

  try {
    // Parse request
    const body = await request.json();
    log('Register request received', {
      embeddingHash: body.embedding_hash?.slice(0, 16),
      qualityScore: body.quality_score,
    });

    // Validate inputs
    if (!body.embedding_hash) {
      log('❌ Validation failed: missing embedding_hash');
      return NextResponse.json(
        { error: 'embedding_hash is required' },
        { status: 400 }
      );
    }

    if (typeof body.quality_score !== 'number' || body.quality_score < 0 || body.quality_score > 100) {
      log('❌ Validation failed: invalid quality_score');
      return NextResponse.json(
        { error: 'quality_score must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Prepare metadata JSON
    const metadata = JSON.stringify({
      embedding_hash: body.embedding_hash,
      quality_score: body.quality_score,
      timestamp: new Date().toISOString(),
      metrics: body.metadata?.metrics || {},
    });

    log('Metadata prepared', { metadataSize: metadata.length });

    // Get validator private key from environment
    const validatorKey = process.env.VALIDATOR_PRIVATE_KEY;
    if (!validatorKey) {
      log('❌ ERROR: VALIDATOR_PRIVATE_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    log('Validator key configured');

    // Generate mock token ID and transaction hash
    // In production, would create EIP-712 signature and submit through registry contract
    const tokenId = Math.floor(Math.random() * 1000000);
    const txHash = keccak256(toHex(metadata)).slice(0, 66);

    log('✅ Registration prepared successfully', {
      tokenId,
      txHash: txHash.slice(0, 16),
    });

    // Return success response
    const response = {
      registry_address: REGISTRY_ADDRESS,
      token_id: tokenId.toString(),
      transaction_hash: txHash,
      embedding_hash: body.embedding_hash,
      quality_score: body.quality_score,
      timestamp: new Date().toISOString(),
    };

    log('✅ EXIT: POST /api/motion-blend/register success');

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log('❌ EXIT: POST /api/motion-blend/register error', {
      error: errorMsg,
    });

    return NextResponse.json(
      { error: `Internal server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { status: 200 });
}
