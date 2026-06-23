from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = "QFinanceData API"
    environment: str = os.getenv("QFD_ENV", "development")
    data_dir: Path = Path(os.getenv("QFD_DATA_DIR", "../data")).resolve()
    log_level: str = os.getenv("QFD_LOG_LEVEL", "INFO")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
