import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config.settings import settings
from app.core.logging import setup_logging, logger
from app.services.activity_simulator import start_activity_simulator
from app.core.exceptions import (
    LogiMindException, logimind_exception_handler, unhandled_exception_handler
)
from app.middlewares.logging_middleware import RequestLoggingMiddleware

from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.vehicles import router as vehicles_router
from app.api.v1.drivers import router as drivers_router
from app.api.v1.routes import router as routes_router
from app.api.v1.warehouses import router as warehouses_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.copilot import router as copilot_router
from app.api.v1.simulation import router as simulation_router
from app.api.v1.fleet import router as fleet_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.driver import router as driver_router
from app.api.v1.scenario import router as scenario_router
from app.api.v1.database import router as database_router
from app.api.v1.activity import router as activity_router

setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise AI-Powered Logistics, Fleet, Warehouse & Inventory Intelligence Operating System API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(LogiMindException, logimind_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(health_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(vehicles_router, prefix=settings.API_V1_STR)
app.include_router(drivers_router, prefix=settings.API_V1_STR)
app.include_router(routes_router, prefix=settings.API_V1_STR)
app.include_router(warehouses_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(copilot_router, prefix=settings.API_V1_STR)
app.include_router(simulation_router, prefix=settings.API_V1_STR)
app.include_router(fleet_router, prefix=settings.API_V1_STR)
app.include_router(inventory_router, prefix=settings.API_V1_STR)
app.include_router(driver_router, prefix=settings.API_V1_STR)
app.include_router(scenario_router, prefix=settings.API_V1_STR)
app.include_router(database_router, prefix=settings.API_V1_STR)
app.include_router(activity_router, prefix=settings.API_V1_STR)

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            # Never swallow an unmatched /api/* path: returning None here would
            # answer 200 with a literal `null` body, so the client would fail
            # later with confusing errors like "cannot read property of null"
            # instead of a clean 404.
            raise HTTPException(status_code=404, detail=f"Unknown API endpoint: /{full_path}")
        if full_path in ["docs", "redoc", "openapi.json"]:
            raise HTTPException(status_code=404, detail="Not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

@app.on_event("startup")
def startup_event():
    # Self-heal the schema: create any missing tables (e.g. inventory_items)
    # before serving traffic, so a partial/stale database file can never 500
    # endpoints with "no such table" — locally or in the Render container.
    try:
        from app.db.session import engine, Base, SessionLocal
        from app.db.seed_data import seed_database_if_empty
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema verified/created successfully.")
        db = SessionLocal()
        try:
            seed_database_if_empty(db)
            logger.info("Database seed entities verified/loaded successfully.")
        finally:
            db.close()
    except Exception as exc:
        logger.error(f"Database schema check failed: {exc}", exc_info=True)
    try:
        start_activity_simulator()
    except Exception as exc:
        logger.error(f"Activity simulator failed to start: {exc}", exc_info=True)
    logger.info(f"=== {settings.PROJECT_NAME} Initialized Successfully ===")

