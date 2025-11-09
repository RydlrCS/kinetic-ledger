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
 * 1. Parse FormData with file uploads
 * 2. Validate request data
 * 3. Fetch from motion-blend-service
 * 4. Return results to client
 * 5. Log with structured logging
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const log = (message: string, data?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, message, ...data };
    console.warn(`🚀 [${timestamp}] blend route:`, entry);
  };

  log('ENTRY: POST /api/motion-blend/blend');

  try {
    // Parse FormData request
    const formData = await request.formData();
    const file1 = formData.get('source_file_1') as File;
    const file2 = formData.get('source_file_2') as File;
    const blendWeight = parseFloat(formData.get('blend_weight') as string);
    const transitionFrames = parseInt(
      formData.get('transition_frames') as string
    );

    log('Request received', {
      file1: file1?.name,
      file2: file2?.name,
      blendWeight,
      transitionFrames,
    });

    // Validate file uploads
    if (!file1 || !file2) {
      log('❌ Validation failed: expected 2 files');
      return NextResponse.json(
        { error: 'Expected 2 BVH files' },
        { status: 400 }
      );
    }

    if (!file1.name.endsWith('.bvh') || !file2.name.endsWith('.bvh')) {
      log('❌ Validation failed: files must be BVH format');
      return NextResponse.json(
        { error: 'Files must be in BVH format' },
        { status: 400 }
      );
    }

    // Validate blend parameters
    if (isNaN(blendWeight) || blendWeight < 0 || blendWeight > 1) {
      log('❌ Validation failed: invalid blend weight');
      return NextResponse.json(
        { error: 'Blend weight must be between 0 and 1' },
        { status: 400 }
      );
    }

    if (
      isNaN(transitionFrames) ||
      transitionFrames < 5 ||
      transitionFrames > 50
    ) {
      log('❌ Validation failed: invalid transition frames');
      return NextResponse.json(
        { error: 'Transition frames must be between 5 and 50' },
        { status: 400 }
      );
    }

    // Create FormData for backend service
    const blendServiceFormData = new FormData();
    blendServiceFormData.append('source_file_1', file1);
    blendServiceFormData.append('source_file_2', file2);
    blendServiceFormData.append('blend_weight', blendWeight.toString());
    blendServiceFormData.append('transition_frames', transitionFrames.toString());

    // Call motion-blend-service
    const blendServiceUrl =
      process.env.MOTION_BLEND_SERVICE_URL || 'http://localhost:8000';
    const blendEndpoint = `${blendServiceUrl}/blend`;

    log('Calling motion-blend-service', { endpoint: blendEndpoint });

    const blendResponse = await fetch(blendEndpoint, {
      method: 'POST',
      body: blendServiceFormData,
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
