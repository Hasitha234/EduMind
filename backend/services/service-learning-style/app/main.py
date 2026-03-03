"""Main FastAPI application for Learning Style Service"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.database import engine, Base
from app.api import (
    routes_recommendations,
    routes_students,
    routes_resources,
    routes_struggles,
    routes_system,
    routes_ml,
    routes_sync,
)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Adaptive Resource Recommendation System - Automatically recommends resources when students struggle",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(routes_system.router, prefix=settings.API_V1_PREFIX)
app.include_router(routes_students.router, prefix=settings.API_V1_PREFIX)
app.include_router(routes_resources.router, prefix=settings.API_V1_PREFIX)
app.include_router(routes_struggles.router, prefix=settings.API_V1_PREFIX)
app.include_router(routes_recommendations.router, prefix=settings.API_V1_PREFIX)
app.include_router(routes_ml.router, prefix=settings.API_V1_PREFIX)
app.include_router(routes_sync.router, prefix=settings.API_V1_PREFIX)

# Mount static files for frontend
frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/app", StaticFiles(directory=str(frontend_path), html=True), name="frontend")


@app.on_event("startup")
async def startup_event():
    """Startup event handler"""
    print("=" * 60)
    print(f"  {settings.APP_NAME}")
    print(f"  Version: {settings.APP_VERSION}")
    print("=" * 60)
    print()
    print("API Documentation:")
    print("  - Swagger UI: http://localhost:8005/docs")
    print("  - ReDoc: http://localhost:8005/redoc")
    print()
    print("Status: Running...")
    print("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler"""
    print("\nShutting down Learning Style Service...")


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "service": "Learning Style Recognition Service",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "health": f"{settings.API_V1_PREFIX}/system/health"
    }