import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.api.router import api_router
from app.middleware.error_handler import setup_exception_handlers
from app.middleware.cors import setup_cors
from app.middleware.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print(f"Starting {settings.app_name} v{settings.app_version}")
    print(f"Environment: {settings.environment}")
    print(f"Debug mode: {settings.debug}")

    yield

    # Shutdown
    print("Shutting down application...")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="""
        TPM (Tiga Putra Motor) Backend API

        Sistem manajemen bisnis untuk:
        - Bengkel (Workshop) - Spare parts & services
        - Jual Beli Mobil (Car Trading)
        - Jasa Angkut (Transportation)
        - Karyawan (Employees)
        - Keuangan (Finance)
        """,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan,
    )

    # Setup middleware
    setup_cors(app)
    setup_logging(app)
    setup_exception_handlers(app)

    # Ensure upload directory exists
    if not os.path.exists(settings.upload_dir):
        os.makedirs(settings.upload_dir)

    # Mount static files for uploads
    app.mount(f"/{settings.upload_dir}", StaticFiles(directory=settings.upload_dir), name="uploads")

    # Include API router
    app.include_router(api_router)

    # Serve Frontend Static Files (from frontend/dist)
    # Ensure this is after api_router so API calls take precedence
    frontend_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "dist"))
    
    if os.path.exists(frontend_dist_path):
        app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="frontend")
        
        # SPA Catch-all: Redirect unknown routes to index.html for client-side routing
        @app.exception_handler(404)
        async def spa_catch_all(request, exc):
            from fastapi.responses import FileResponse
            return FileResponse(os.path.join(frontend_dist_path, "index.html"))
    else:
        print(f"Warning: Frontend dist folder not found at {frontend_dist_path}")

    # Health check endpoint
    @app.get("/health", tags=["Health"])
    def health_check():
        """Health check endpoint."""
        return JSONResponse(
            content={
                "status": "healthy",
                "app": settings.app_name,
                "version": settings.app_version,
            }
        )

    # Root endpoint
    @app.get("/", tags=["Root"])
    def root():
        """Root endpoint with API info."""
        return {
            "app": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs" if settings.debug else "disabled",
            "health": "/health",
        }

    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
