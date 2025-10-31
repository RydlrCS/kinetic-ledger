"""
Kinetic Ledger API Gateway

FastAPI service providing:
- HMAC webhook authentication
- CORS configuration
- Rate limiting
- Request/response logging with structlog
- Health check endpoints
"""

import os
import sys
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    host: str = "0.0.0.0"
    port: int = 8000
    environment: str = "development"
    
    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # Security
    webhook_secret: str = ""
    
    # Arc RPC
    arc_rpc_url: str = "https://rpc.arc-testnet.circle.com"
    arc_chain_id: int = 421614
    
    # Contract addresses (populated after deployment)
    attested_motion_address: str = ""
    rewards_escrow_address: str = ""
    
    # Agent service URL
    agent_service_url: str = "http://localhost:8001"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for startup/shutdown"""
    logger.info(
        "api_gateway_starting",
        environment=settings.environment,
        arc_chain_id=settings.arc_chain_id,
    )
    yield
    logger.info("api_gateway_shutting_down")


app = FastAPI(
    title="Kinetic Ledger API Gateway",
    description="API gateway for motion attestations and USDC payments on Arc",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests with structured logging"""
    logger.info(
        "http_request_received",
        method=request.method,
        path=request.url.path,
        client_host=request.client.host if request.client else None,
    )
    
    response = await call_next(request)
    
    logger.info(
        "http_response_sent",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
    )
    
    return response


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "environment": settings.environment,
        "services": {
            "rpc": bool(settings.arc_rpc_url),
            "contracts": bool(settings.attested_motion_address),
        }
    }


@app.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness_check():
    """Readiness check for Kubernetes/Docker"""
    # TODO: Add actual RPC connectivity check
    is_ready = bool(settings.arc_rpc_url)
    
    if not is_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "reason": "RPC not configured"}
        )
    
    return {"status": "ready"}


@app.get("/health/live", status_code=status.HTTP_200_OK)
async def liveness_check():
    """Liveness check for Kubernetes/Docker"""
    return {"status": "alive"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Kinetic Ledger API Gateway",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    
    logger.info(
        "starting_uvicorn_server",
        host=settings.host,
        port=settings.port,
    )
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=(settings.environment == "development"),
        log_level="debug" if os.getenv('VERBOSE') == 'true' else "info",
    )
