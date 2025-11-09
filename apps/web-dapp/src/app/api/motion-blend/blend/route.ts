/**
 * Motion Blending API Route
 *
 * Endpoint: POST /api/motion-blend/blend
 *
 * Accepts blend request and forwards to motion-blend-service
 * Validates inputs and returns blend results with quality metrics
 *
 * Request body:
 * {
 *   source_files: ["path/to/motion1.bvh", "path/to/motion2.bvh"],
 *   blend_weights: [0.5, 0.5],
 *   transition_frame: 10,
 *   output_dir: "./output"
 * }
 *
 * Response:
 * {
 *   embedding_hash: "0x...",
 *   blended_bvh_path: "output/blended.bvh",
 *   quality_score: 85.5,
 *   velocity_continuity: 0.9,
 *   acceleration_smoothness: 0.85,
 *   foot_contact_stability: 0.8
 * }
 *
 * Author: Kinetic Ledger Team
 * License: MIT
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST handler for blend requests
 *
 * Flow:
 * 1. Validate request body
 * 2. Fetch from motion-blend-service
 * 3. Return results to client
 * 4. Log with structured logging
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const log = (message: string, data?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, message, ...data };
    console.warn(`🚀 [${timestamp}] blend route:`, entry);
  };

  log('ENTRY: POST /api/motion-blend/blend');

  try {
    // Parse request
    const body = await request.json();
    log('Request received', {
      sourceFiles: body.source_files?.length,
      transitionFrame: body.transition_frame,
    });

    // Validate inputs
    if (!body.source_files || body.source_files.length !== 2) {
      log('❌ Validation failed: expected 2 source files');
      return NextResponse.json(
        { error: 'Expected exactly 2 source motion files' },
        { status: 400 }
      );
    }

    if (
      !body.blend_weights ||
      body.blend_weights.length !== 2 ||
      Math.abs(body.blend_weights[0] + body.blend_weights[1] - 1.0) > 0.01
    ) {
      log('❌ Validation failed: invalid blend weights');
      return NextResponse.json(
        { error: 'Blend weights must sum to 1.0' },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(body.transition_frame) ||
      body.transition_frame < 5 ||
      body.transition_frame > 50
    ) {
      log('❌ Validation failed: invalid transition frame');
      return NextResponse.json(
        { error: 'Transition frame must be between 5 and 50' },
        { status: 400 }
      );
    }

    // Call motion-blend-service
    const blendServiceUrl = process.env.MOTION_BLEND_SERVICE_URL || 'http://localhost:8001';
    const blendEndpoint = `${blendServiceUrl}/blend`;

    log('Calling motion-blend-service', { endpoint: blendEndpoint });

    const blendResponse = await fetch(blendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'kinetic-ledger-web-dapp/1.0',
      },
      body: JSON.stringify({
        source_files: body.source_files,
        blend_weights: body.blend_weights,
        transition_frame: body.transition_frame,
        output_dir: body.output_dir || './output',
      }),
    });

    if (!blendResponse.ok) {
      const errorText = await blendResponse.text();
      log('❌ Blend service error', {
        status: blendResponse.status,
        error: errorText,
      });

      return NextResponse.json(
        { error: `Blend service error: ${errorText}` },
        { status: blendResponse.status }
      );
    }

    const blendResult = await blendResponse.json();
    log('✅ Blend service response received', {
      qualityScore: blendResult.quality_score,
      embeddingHash: blendResult.embedding_hash?.slice(0, 16),
    });

    // Return successful response
    log('✅ EXIT: POST /api/motion-blend/blend success');

    return NextResponse.json(blendResult, { status: 200 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log('❌ EXIT: POST /api/motion-blend/blend error', {
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
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
