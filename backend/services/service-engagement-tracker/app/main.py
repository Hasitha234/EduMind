"""
EduMind Engagement Tracking Service - FastAPI Application

Complete API for student engagement tracking and disengagement prediction
"""
import os
import sys
from pathlib import Path

# Add the project root to sys.path for shared module imports
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Also add the service directory to path for local imports
service_dir = script_dir.parent
if str(service_dir) not in sys.path:
    sys.path.insert(0, str(service_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from backend.shared.middleware import (
    error_handler_middleware,
    logging_middleware,
    validation_exception_handler,
    http_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

# Import routers
from app.api import routes_system
from app.api import routes_engagement
from app.api import routes_predictions
from app.api import routes_students
from app.api import routes_events
from app.api import routes_scheduling
from app.api import routes_aggregation

from backend.shared.messaging import get_broker

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.SERVICE_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    contact={
        "name": "EduMind Development Team",
        "email": "support@edumind.example.com"
    },
    license_info={
        "name": "MIT License"
    }
)

# Standard middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared middleware
app.middleware("http")(logging_middleware)
app.middleware("http")(error_handler_middleware)

# Shared exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)

# Include routers
app.include_router(routes_system.router)
app.include_router(routes_engagement.router)
app.include_router(routes_predictions.router)
app.include_router(routes_students.router)
app.include_router(routes_events.router)
app.include_router(routes_scheduling.router)
app.include_router(routes_aggregation.router)


# Global health check for infrastructure (without prefix)
@app.get("/health", tags=["System"])
async def global_health_check():
    """Health check for infrastructure monitoring"""
    from backend.shared.messaging import get_broker
    
    health = {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "components": {}
    }
    
    # Check RabbitMQ
    try:
        broker = get_broker(settings.RABBITMQ_URL)
        if broker.connection and not broker.connection.is_closed:
            health["components"]["rabbitmq"] = "connected"
        else:
            health["components"]["rabbitmq"] = "disconnected"
            health["status"] = "degraded"
    except Exception:
        health["components"]["rabbitmq"] = "error"
        health["status"] = "degraded"
        
    return health


# Favicon endpoint to prevent 404 errors (must be before static files)
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Return empty favicon to prevent 404 errors"""
    from fastapi.responses import Response
    return Response(content=b"", media_type="image/x-icon")


# Chrome DevTools endpoint to prevent 404 errors
@app.get("/.well-known/appspecific/com.chrome.devtools.json", include_in_schema=False)
async def chrome_devtools():
    """Return empty response for Chrome DevTools to prevent 404 errors"""
    from fastapi.responses import Response
    return Response(content=b"{}", media_type="application/json")


# Source map endpoint to prevent 404 errors (must be before static files)
@app.get("/app/{filename}.map", include_in_schema=False)
async def source_map(filename: str):
    """Return empty source map to prevent 404 errors"""
    from fastapi.responses import Response
    return Response(content=b"{}", media_type="application/json")


# Mount static files for frontend
frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/app", StaticFiles(directory=str(frontend_path), html=True), name="frontend")

# Redirect root to frontend app
@app.get("/", include_in_schema=False)
async def redirect_to_app():
    """Redirect root to frontend application"""
    return RedirectResponse(url="/app/index.html")


# Startup event
@app.on_event("startup")
async def startup_event():
    """Runs when the application starts"""
    print("EduMind Engagement Tracking Service starting...")
    
    # Connect to RabbitMQ
    broker = get_broker(settings.RABBITMQ_URL)
    try:
        await broker.connect(client_name=settings.SERVICE_NAME)
        print(f"Connected to RabbitMQ as {settings.SERVICE_NAME}")
    except Exception as e:
        print(f"Could not connect to RabbitMQ: {e}")
        
    print("API Documentation: http://localhost:8002/api/docs")
    print("Service ready!")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Runs when the application shuts down"""
    print("EduMind Engagement Tracking Service shutting down...")
    
    # Close RabbitMQ connection
    broker = get_broker(settings.RABBITMQ_URL)
    await broker.close()
