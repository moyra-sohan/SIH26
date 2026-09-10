"""
FastAPI Application Factory & Lifecycle Initialization.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import logger
from app.services.model_service import model_service
from app.api.health import router as health_router
from app.api.v1.router import api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup ML asset loading and graceful shutdown."""
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    try:
        model_service.load_assets()
        logger.info("ML model and feature assets loaded successfully into memory.")
    except Exception as e:
        logger.error(f"Fatal error during model initialization: {e}", exc_info=True)
    
    yield
    
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")


def create_app() -> FastAPI:
    """Instantiates and configures the FastAPI application."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.DESCRIPTION,
        version=settings.VERSION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json"
    )

    # Cross-Origin Resource Sharing (CORS) Configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Health and Root Information router
    app.include_router(health_router)

    # Register API v1 routes under /api (matching existing frontend & backend contracts)
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    return app


app = create_app()
