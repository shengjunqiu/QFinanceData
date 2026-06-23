from __future__ import annotations

from fastapi import FastAPI

from qfinancedata import __version__
from qfinancedata.config import get_settings
from qfinancedata.logging import configure_logging

settings = get_settings()
configure_logging(settings.log_level)

app = FastAPI(title=settings.app_name, version=__version__)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "qfinancedata-backend",
        "version": __version__,
        "environment": settings.environment,
    }
