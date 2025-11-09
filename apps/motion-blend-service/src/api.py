"""
Motion Blending Service - FastAPI REST API

This module provides a REST API for motion blending operations:
- POST /blend: Blend 2-3 BVH motion files into smooth sequence
- GET /health: Service health check

The API validates requests, invokes the blend engine, and returns
the embedding hash for on-chain attestation along with quality metrics.

Author: Kinetic Ledger Team
License: MIT
"""

import logging
import os
import time
import uuid
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
import structlog

from . import blend_engine

# ============================================================================
# Logging Configuration
# ============================================================================

# Use structlog for structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

# Set log level from environment
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level))

if os.getenv("VERBOSE") == "true":
    logging.getLogger().setLevel(logging.DEBUG)
    logger.info("verbose_mode_enabled", log_level="DEBUG")

# ============================================================================
# FastAPI App Initialization
# ============================================================================

app = FastAPI(
    title="Motion Blending Service",
    description="AI-powered motion sequence blending with on-chain attestation",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for web dapp integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Request/Response Models
# ============================================================================


class BlendRequest(BaseModel):
    """
    Request schema for motion blending operation.
    
    Attributes:
        source_files: Absolute paths to 2-3 BVH files
        blend_weights: Blend weights for each source (must sum to 1.0)
        transition_frame: Primary transition point (default: 50)
        quality_threshold: Minimum quality score 0-100 (default: 80.0)
        output_dir: Directory to save blended BVH (optional)
    
    Example:
        {
            "source_files": ["/data/walk.bvh", "/data/run.bvh"],
            "blend_weights": [0.6, 0.4],
            "transition_frame": 30,
            "quality_threshold": 75.0
        }
    """
    
    source_files: List[str] = Field(
        ...,
        min_length=2,
        max_length=3,
        description="Paths to 2-3 source BVH files"
    )
    
    blend_weights: List[float] = Field(
        ...,
        min_length=2,
        max_length=3,
        description="Blend weights (must sum to 1.0)"
    )
    
    transition_frame: int = Field(
        default=50,
        ge=10,
        le=500,
        description="Primary transition point (frame index)"
    )
    
    quality_threshold: float = Field(
        default=80.0,
        ge=0.0,
        le=100.0,
        description="Minimum acceptable quality score"
    )
    
    output_dir: Optional[str] = Field(
        default=None,
        description="Output directory (defaults to ./output)"
    )
    
    @field_validator('blend_weights')
    @classmethod
    def validate_weights_sum(cls, v: List[float], info) -> List[float]:
        """Ensure blend weights sum to 1.0 (within tolerance)"""
        if abs(sum(v) - 1.0) > 0.01:
            raise ValueError(f"Blend weights must sum to 1.0, got {sum(v):.4f}")
        return v
    
    @field_validator('blend_weights')
    @classmethod
    def validate_weights_range(cls, v: List[float]) -> List[float]:
        """Ensure all weights are in [0, 1]"""
        for weight in v:
            if weight < 0 or weight > 1:
                raise ValueError(f"Weights must be in range [0, 1], got {weight}")
        return v
    
    @field_validator('source_files', 'blend_weights')
    @classmethod
    def validate_lengths_match(cls, v, info) -> List:
        """Ensure source_files and blend_weights have same length"""
        # This validator runs for each field independently
        # The actual length matching is checked in the endpoint
        return v


class BlendResponse(BaseModel):
    """
    Response schema for successful blend operation.
    
    Attributes:
        request_id: Unique request identifier
        blended_bvh_path: Path to saved blended BVH file
        embedding_hash: keccak256 hash (0x-prefixed, 66 chars)
        quality_score: Overall quality 0-100
        metadata: Additional metrics and processing info
    """
    
    request_id: str = Field(..., description="Unique request identifier")
    blended_bvh_path: str = Field(..., description="Path to blended BVH file")
    embedding_hash: str = Field(..., description="keccak256 hash (0x...)")
    quality_score: float = Field(..., description="Quality score 0-100")
    metadata: dict = Field(..., description="Quality metrics and processing info")


class HealthResponse(BaseModel):
    """Health check response schema"""
    status: str = Field(..., description="Service status (healthy/unhealthy)")
    version: str = Field(..., description="API version")
    timestamp: float = Field(..., description="Current timestamp")


class ErrorResponse(BaseModel):
    """Error response schema"""
    request_id: str = Field(..., description="Request identifier")
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[dict] = Field(None, description="Additional error details")


# ============================================================================
# Middleware for Request ID Injection
# ============================================================================


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """
    Inject unique request_id into each request for tracing.
    Also logs request entry and exit with timing.
    """
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    start_time = time.time()
    
    logger.info(
        "request_received",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        client_ip=request.client.host if request.client else "unknown"
    )
    
    response = await call_next(request)
    
    elapsed_time = time.time() - start_time
    
    logger.info(
        "request_completed",
        request_id=request_id,
        status_code=response.status_code,
        elapsed_seconds=round(elapsed_time, 3)
    )
    
    # Add request_id to response headers for client-side tracing
    response.headers["X-Request-ID"] = request_id
    
    return response


# ============================================================================
# API Endpoints
# ============================================================================


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    
    Returns service status and version information.
    Used by load balancers and monitoring systems.
    """
    logger.debug("health_check_requested")
    
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        timestamp=time.time()
    )


@app.post("/blend", response_model=BlendResponse)
async def blend_motions_endpoint(request: Request, blend_request: BlendRequest):
    """
    Blend multiple BVH motion files into a smooth sequence.
    
    This endpoint:
    1. Validates the request (weights, file paths, parameters)
    2. Invokes the blend engine to create blended motion
    3. Validates blend quality against threshold
    4. Extracts 512-D embedding and computes keccak256 hash
    5. Returns hash for on-chain attestation + quality metrics
    
    Args:
        blend_request: BlendRequest with source files, weights, parameters
    
    Returns:
        BlendResponse with blended BVH path, embedding hash, quality metrics
    
    Raises:
        HTTPException 400: Invalid input (bad weights, incompatible files)
        HTTPException 422: Quality below threshold
        HTTPException 500: Internal blending error
    
    Example:
        POST /blend
        {
            "source_files": ["/data/walk.bvh", "/data/run.bvh"],
            "blend_weights": [0.5, 0.5],
            "transition_frame": 40
        }
        
        Response:
        {
            "request_id": "123e4567-e89b-12d3-a456-426614174000",
            "blended_bvh_path": "/output/blended_1699564800.bvh",
            "embedding_hash": "0x1234...abcd",
            "quality_score": 87.5,
            "metadata": {...}
        }
    """
    request_id = request.state.request_id
    
    logger.info(
        "blend_request_started",
        request_id=request_id,
        num_sources=len(blend_request.source_files),
        blend_weights=blend_request.blend_weights,
        transition_frame=blend_request.transition_frame,
        quality_threshold=blend_request.quality_threshold
    )
    
    # ========================================================================
    # Additional Validation
    # ========================================================================
    
    # Verify source_files and blend_weights have matching lengths
    if len(blend_request.source_files) != len(blend_request.blend_weights):
        error_msg = (
            f"Length mismatch: {len(blend_request.source_files)} source files "
            f"but {len(blend_request.blend_weights)} blend weights"
        )
        logger.error(
            "validation_failed",
            request_id=request_id,
            error="length_mismatch",
            message=error_msg
        )
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Verify all source files exist
    for filepath in blend_request.source_files:
        if not os.path.exists(filepath):
            error_msg = f"Source file not found: {filepath}"
            logger.error(
                "validation_failed",
                request_id=request_id,
                error="file_not_found",
                filepath=filepath
            )
            raise HTTPException(status_code=400, detail=error_msg)
    
    # ========================================================================
    # Invoke Blend Engine
    # ========================================================================
    
    try:
        output_dir = blend_request.output_dir or "./output"
        
        result = blend_engine.blend_motions(
            source_files=blend_request.source_files,
            blend_weights=blend_request.blend_weights,
            transition_frame=blend_request.transition_frame,
            output_dir=output_dir,
            quality_threshold=blend_request.quality_threshold
        )
        
        logger.info(
            "blend_success",
            request_id=request_id,
            blended_bvh_path=result['blended_bvh_path'],
            embedding_hash=result['embedding_hash'][:10] + "..." + result['embedding_hash'][-8:],
            quality_score=result['quality_score'],
            processing_time_seconds=result['metadata']['processing_time_seconds']
        )
        
        return BlendResponse(
            request_id=request_id,
            blended_bvh_path=result['blended_bvh_path'],
            embedding_hash=result['embedding_hash'],
            quality_score=result['quality_score'],
            metadata=result['metadata']
        )
    
    except blend_engine.InvalidInputError as e:
        logger.error(
            "blend_failed_invalid_input",
            request_id=request_id,
            error="invalid_input",
            message=str(e)
        )
        raise HTTPException(status_code=400, detail=str(e))
    
    except blend_engine.BlendQualityError as e:
        logger.warning(
            "blend_failed_quality_threshold",
            request_id=request_id,
            error="quality_below_threshold",
            message=str(e)
        )
        raise HTTPException(status_code=422, detail=str(e))
    
    except Exception as e:
        logger.exception(
            "blend_failed_internal_error",
            request_id=request_id,
            error="internal_error",
            message=str(e)
        )
        raise HTTPException(status_code=500, detail=f"Internal blending error: {str(e)}")


# ============================================================================
# Exception Handlers
# ============================================================================


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom handler for HTTP exceptions with request_id"""
    request_id = getattr(request.state, "request_id", "unknown")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            request_id=request_id,
            error=exc.__class__.__name__,
            message=exc.detail,
            details=None
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all handler for unexpected exceptions"""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.exception(
        "unhandled_exception",
        request_id=request_id,
        error=exc.__class__.__name__,
        message=str(exc)
    )
    
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            request_id=request_id,
            error="InternalServerError",
            message="An unexpected error occurred",
            details={"exception_type": exc.__class__.__name__}
        ).model_dump()
    )


# ============================================================================
# Entry Point
# ============================================================================


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(
        "starting_motion_blend_service",
        host=host,
        port=port,
        log_level=log_level,
        verbose=os.getenv("VERBOSE") == "true"
    )
    
    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        log_level=log_level.lower(),
        reload=os.getenv("RELOAD", "false") == "true"
    )
