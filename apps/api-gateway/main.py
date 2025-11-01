"""
Kinetic Ledger API Gateway

FastAPI service providing:
- HMAC webhook authentication for fitness trackers and mocap systems
- CORS configuration for web dapp
- Rate limiting per IP
- Request/response logging with structlog (verbose mode available)
- Health check endpoints (health, ready, live)
- Attestation generation API for AI agents
- Motion event processing pipeline
"""

import hashlib
import hmac
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import structlog
from fastapi import FastAPI, Request, Response, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
)

logger = structlog.get_logger()

# Enable verbose logging if VERBOSE=true
if os.getenv('VERBOSE', '').lower() == 'true':
    import logging
    logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
    logger.info("verbose_logging_enabled", level="DEBUG")
else:
    import logging
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # Server config
    app_name: str = "Kinetic Ledger API Gateway"
    app_version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = 8000
    environment: str = "development"
    
    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    
    # Security
    webhook_secret: str = Field(default="", env="AGENT_WEBHOOK_SECRET")
    
    # Rate limiting
    rate_limit_requests: int = Field(default=100, env="RATE_LIMIT_REQUESTS")
    rate_limit_window: int = Field(default=60, env="RATE_LIMIT_WINDOW")
    
    # Arc RPC
    arc_rpc_url: str = "https://rpc.arc-testnet.circle.com"
    arc_chain_id: int = 421614
    usdc_token_address: str = ""
    
    # Contract addresses (populated after deployment)
    attested_motion_address: str = ""
    rewards_escrow_address: str = ""
    novelty_detector_address: str = ""
    
    # Agent service URL
    agent_service_url: str = "http://localhost:8001"
    
    # Logging
    verbose: bool = Field(default=False, env="VERBOSE")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

# In-memory rate limiter (production: use Redis)
rate_limit_store: dict[str, list[float]] = {}


# Pydantic models
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    environment: str
    services: dict


class MotionEventWebhook(BaseModel):
    """Webhook payload for motion events"""
    wallet: str = Field(..., description="User wallet address")
    event_type: str = Field(..., description="Type of motion event")
    timestamp: int = Field(..., description="Unix timestamp")
    motion_data: dict = Field(..., description="Raw motion data")
    metadata: Optional[dict] = Field(default=None, description="Additional metadata")


class AttestationRequest(BaseModel):
    """Request to generate motion attestation"""
    embedding_hash: str = Field(..., description="Keccak256 hash of motion embedding")
    confidence_score: int = Field(..., ge=0, le=10000, description="Confidence score in basis points")
    local_density: int = Field(..., ge=0, le=10000, description="Local density in basis points")
    wallet: str = Field(..., description="User wallet address")
    compliance: dict = Field(..., description="Compliance metadata")


class AttestationResponse(BaseModel):
    """Generated attestation response"""
    status: str
    data_hash: str
    trace_id: str
    message: str



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for startup/shutdown"""
    start_time = time.time()
    
    logger.info(
        "api_gateway_starting",
        app_name=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        arc_chain_id=settings.arc_chain_id,
        verbose=settings.verbose,
        timestamp=datetime.utcnow().isoformat()
    )
    logger.info("🚀 ENTRY: Kinetic Ledger API Gateway starting")
    
    # Validate critical settings
    if settings.verbose:
        logger.debug("validating_critical_settings")
    
    if not settings.webhook_secret:
        logger.warning("webhook_secret_not_set", security_risk="high")
    else:
        if settings.verbose:
            logger.debug("✅ webhook_secret_configured")
    
    if settings.verbose:
        logger.debug(
            "✅ api_gateway_ready",
            startup_time_ms=round((time.time() - start_time) * 1000, 2)
        )
    
    logger.info(
        "✅ API Gateway ready and listening",
        uptime_ms=round((time.time() - start_time) * 1000, 2)
    )
    
    yield
    
    logger.info("🏁 EXIT: Graceful shutdown initiated")
    logger.info("api_gateway_shutting_down")


app = FastAPI(
    title=settings.app_name,
    description="API gateway for motion attestations and USDC payments on Arc",
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS middleware
origins = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware for request logging and tracing
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with trace IDs"""
    trace_id = request.headers.get("X-Trace-ID", f"trace_{int(time.time() * 1000)}")
    request.state.trace_id = trace_id
    
    start_time = time.time()
    
    logger.info(
        "request_received",
        method=request.method,
        path=request.url.path,
        trace_id=trace_id,
        client_ip=request.client.host if request.client else "unknown"
    )
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    
    logger.info(
        "request_completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(duration * 1000, 2),
        trace_id=trace_id
    )
    
    response.headers["X-Trace-ID"] = trace_id
    return response


# Dependency: Rate limiting
async def rate_limit(request: Request):
    """Simple in-memory rate limiting"""
    client_ip = request.client.host if request.client else "unknown"
    current_time = time.time()
    
    if client_ip not in rate_limit_store:
        rate_limit_store[client_ip] = []
    
    # Clean old entries
    rate_limit_store[client_ip] = [
        ts for ts in rate_limit_store[client_ip]
        if current_time - ts < settings.rate_limit_window
    ]
    
    # Check limit
    if len(rate_limit_store[client_ip]) >= settings.rate_limit_requests:
        logger.warning(
            "rate_limit_exceeded",
            client_ip=client_ip,
            requests=len(rate_limit_store[client_ip]),
            window=settings.rate_limit_window,
            trace_id=request.state.trace_id
        )
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit: {settings.rate_limit_requests} req/{settings.rate_limit_window}s"
        )
    
    rate_limit_store[client_ip].append(current_time)


# Dependency: HMAC verification
async def verify_hmac(
    request: Request,
    x_signature: Optional[str] = Header(None),
):
    """Verify HMAC signature for webhooks"""
    if not settings.webhook_secret:
        logger.warning("hmac_verification_skipped", reason="secret_not_configured")
        return
    
    if not x_signature:
        logger.error("hmac_signature_missing", trace_id=request.state.trace_id)
        raise HTTPException(status_code=401, detail="Missing X-Signature header")
    
    body = await request.body()
    expected_signature = hmac.new(
        settings.webhook_secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(x_signature, f"sha256={expected_signature}"):
        logger.error("hmac_verification_failed", trace_id=request.state.trace_id)
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    logger.debug("hmac_verified", trace_id=request.state.trace_id)



# Health endpoints
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Basic health check"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version=settings.app_version,
        environment=settings.environment,
        services={
            "rpc": bool(settings.arc_rpc_url),
            "contracts": bool(settings.attested_motion_address),
            "webhook_secret": bool(settings.webhook_secret)
        }
    )


@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    """Readiness check for Kubernetes/Docker"""
    checks = {
        "api": "healthy",
        "webhook_secret": "configured" if settings.webhook_secret else "missing",
        "arc_rpc": "configured" if settings.arc_rpc_url else "missing"
    }
    
    is_ready = settings.arc_rpc_url and settings.webhook_secret
    
    if not is_ready:
        logger.warning("readiness_check_failed", checks=checks)
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "checks": checks}
        )
    
    return {"status": "ready", "checks": checks}


@app.get("/health/live", tags=["Health"])
async def liveness_check():
    """Liveness check for Kubernetes/Docker"""
    return {"status": "alive"}


# Webhook endpoints
@app.post("/webhooks/fitness-tracker", tags=["Webhooks"])
async def fitness_tracker_webhook(
    event: MotionEventWebhook,
    request: Request,
    _rate_limit: None = Depends(rate_limit),
    _hmac: None = Depends(verify_hmac)
):
    """
    Webhook for fitness tracker motion events
    Validates HMAC and queues for processing
    """
    if settings.verbose:
        logger.debug(
            "🏃 ENTRY: fitness_tracker_webhook",
            wallet=event.wallet,
            trace_id=request.state.trace_id
        )
    
    logger.info(
        "fitness_tracker_event_received",
        wallet=event.wallet,
        event_type=event.event_type,
        timestamp=event.timestamp,
        trace_id=request.state.trace_id
    )
    
    # Hash motion data
    motion_data_str = str(event.motion_data)
    data_hash = hashlib.sha256(motion_data_str.encode()).hexdigest()
    
    logger.info(
        "motion_data_hashed",
        wallet=event.wallet,
        data_hash=data_hash[:16],
        trace_id=request.state.trace_id
    )
    
    if settings.verbose:
        logger.debug(
            "✅ EXIT: fitness_tracker_webhook - event queued",
            data_hash=data_hash[:16],
            trace_id=request.state.trace_id
        )
    
    return AttestationResponse(
        status="accepted",
        data_hash=data_hash,
        trace_id=request.state.trace_id,
        message="Motion event queued for processing"
    )


@app.post("/webhooks/mocap", tags=["Webhooks"])
async def mocap_webhook(
    event: MotionEventWebhook,
    request: Request,
    _rate_limit: None = Depends(rate_limit),
    _hmac: None = Depends(verify_hmac)
):
    """
    Webhook for motion capture systems
    Processes mocap validation data
    """
    if settings.verbose:
        logger.debug(
            "🎥 ENTRY: mocap_webhook",
            wallet=event.wallet,
            trace_id=request.state.trace_id
        )
    
    logger.info(
        "mocap_event_received",
        wallet=event.wallet,
        event_type=event.event_type,
        timestamp=event.timestamp,
        trace_id=request.state.trace_id
    )
    
    motion_data_str = str(event.motion_data)
    data_hash = hashlib.sha256(motion_data_str.encode()).hexdigest()
    
    logger.info(
        "mocap_data_hashed",
        wallet=event.wallet,
        data_hash=data_hash[:16],
        trace_id=request.state.trace_id
    )
    
    if settings.verbose:
        logger.debug(
            "✅ EXIT: mocap_webhook - event queued",
            data_hash=data_hash[:16],
            trace_id=request.state.trace_id
        )
    
    return AttestationResponse(
        status="accepted",
        data_hash=data_hash,
        trace_id=request.state.trace_id,
        message="Mocap event queued for processing"
    )


# Attestation endpoint
@app.post("/attestations/generate", tags=["Attestations"])
async def generate_attestation(
    req: AttestationRequest,
    request: Request,
    _rate_limit: None = Depends(rate_limit)
):
    """
    Generate motion attestation
    Called by agent service after RkCNN processing
    """
    if settings.verbose:
        logger.debug(
            "📜 ENTRY: generate_attestation",
            wallet=req.wallet,
            trace_id=request.state.trace_id
        )
    
    logger.info(
        "attestation_generation_requested",
        wallet=req.wallet,
        embedding_hash=req.embedding_hash[:16],
        confidence_score=req.confidence_score,
        local_density=req.local_density,
        trace_id=request.state.trace_id
    )
    
    # TODO: Implement EIP-712 signing with agent private key
    # TODO: This would use HSM in production
    
    nonce = int(time.time())
    expiry = nonce + 300
    
    logger.info(
        "attestation_generated",
        wallet=req.wallet,
        nonce=nonce,
        expiry=expiry,
        trace_id=request.state.trace_id
    )
    
    if settings.verbose:
        logger.debug(
            "✅ EXIT: generate_attestation - attestation created",
            nonce=nonce,
            expiry=expiry,
            trace_id=request.state.trace_id
        )
    
    return {
        "status": "generated",
        "nonce": nonce,
        "expiry": expiry,
        "trace_id": request.state.trace_id
    }



if __name__ == "__main__":
    import uvicorn
    
    logger.info(
        "starting_uvicorn_server",
        host=settings.host,
        port=settings.port,
        environment=settings.environment,
        verbose=settings.verbose
    )
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=(settings.environment == "development"),
        log_level="debug" if settings.verbose else settings.log_level.lower(),
    )
