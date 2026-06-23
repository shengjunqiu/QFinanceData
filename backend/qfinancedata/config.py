from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_SQLITE_PATH = DEFAULT_DATA_DIR / "qfinancedata.sqlite"
DEFAULT_START_DATE = date(2015, 1, 1)


@dataclass(frozen=True)
class Settings:
    app_name: str = "QFinanceData API"
    environment: str = "development"
    data_dir: Path = DEFAULT_DATA_DIR
    sqlite_path: Path = DEFAULT_SQLITE_PATH
    default_start_date: date = DEFAULT_START_DATE
    default_interval: str = "1d"
    stale_trading_days: int = 3
    fetch_concurrency: int = 4
    request_timeout: float = 20.0
    log_level: str = "INFO"

    @classmethod
    def from_env(cls) -> "Settings":
        data_dir = _get_path("QFD_DATA_DIR", DEFAULT_DATA_DIR)
        data_dir.mkdir(parents=True, exist_ok=True)

        return cls(
            environment=os.getenv("QFD_ENV", cls.environment),
            data_dir=data_dir,
            sqlite_path=_get_path("QFD_SQLITE_PATH", data_dir / DEFAULT_SQLITE_PATH.name),
            default_start_date=_get_date("QFD_DEFAULT_START_DATE", cls.default_start_date),
            default_interval=os.getenv("QFD_DEFAULT_INTERVAL", cls.default_interval),
            stale_trading_days=_get_int(
                "QFD_STALE_TRADING_DAYS",
                cls.stale_trading_days,
                min_value=1,
            ),
            fetch_concurrency=_get_int(
                "QFD_FETCH_CONCURRENCY",
                cls.fetch_concurrency,
                min_value=1,
            ),
            request_timeout=_get_float(
                "QFD_REQUEST_TIMEOUT",
                cls.request_timeout,
                min_value=0.1,
            ),
            log_level=os.getenv("QFD_LOG_LEVEL", cls.log_level),
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings.from_env()


def _get_path(name: str, default: Path) -> Path:
    raw_value = os.getenv(name)
    path = Path(raw_value).expanduser() if raw_value else default
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


def _get_date(name: str, default: date) -> date:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    try:
        return date.fromisoformat(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must use YYYY-MM-DD format.") from exc


def _get_int(name: str, default: int, *, min_value: int) -> int:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer.") from exc

    if value < min_value:
        raise ValueError(f"{name} must be greater than or equal to {min_value}.")
    return value


def _get_float(name: str, default: float, *, min_value: float) -> float:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    try:
        value = float(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number.") from exc

    if value < min_value:
        raise ValueError(f"{name} must be greater than or equal to {min_value}.")
    return value
