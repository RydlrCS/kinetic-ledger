"""
Main entry point for Motion Blend Service
This module imports and exposes the FastAPI app for uvicorn
"""

from src.api import app

if __name__ == "__main__":
    import uvicorn
    import os
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        reload=True
    )
