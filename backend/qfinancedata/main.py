from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from qfinancedata import __version__
from qfinancedata.api.jobs import router as jobs_router
from qfinancedata.api.prices import router as prices_router
from qfinancedata.api.symbols import router as symbols_router
from qfinancedata.config import Settings, get_settings
from qfinancedata.logging import configure_logging
from qfinancedata.storage.sqlite import initialize_database

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    configure_logging(app_settings.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        logger.info("Initializing SQLite database at %s", app_settings.sqlite_path)
        initialize_database(app_settings.sqlite_path)
        yield

    app = FastAPI(
        title=app_settings.app_name,
        version=__version__,
        lifespan=lifespan,
    )
    app.state.settings = app_settings

    @app.get("/health", tags=["system"])
    def health_check() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "qfinancedata-backend",
            "version": __version__,
            "environment": app_settings.environment,
        }

    app.include_router(symbols_router)
    app.include_router(jobs_router)
    app.include_router(prices_router)

    return app


app = create_app()
