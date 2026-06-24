from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

JobStatus = Literal[
    "queued",
    "running",
    "success",
    "partial_success",
    "failed",
    "cancelled",
]

JobItemStatus = Literal["queued", "running", "success", "failed", "skipped"]


class SymbolFetchRequest(BaseModel):
    symbols: list[str] | None = None

    @field_validator("symbols")
    @classmethod
    def strip_symbols(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [symbol.strip().upper() for symbol in value]


class PriceFetchRequest(SymbolFetchRequest):
    start: date | None = None
    end: date | None = None
    interval: str | None = Field(default=None, max_length=16)

    @field_validator("interval")
    @classmethod
    def strip_interval(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class FetchJobItemRead(BaseModel):
    id: str
    job_id: str
    symbol: str
    status: JobItemStatus
    error_type: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class FetchJobRead(BaseModel):
    id: str
    job_type: Literal["prices", "fundamentals", "actions", "metadata"]
    status: JobStatus
    params: dict[str, Any]
    progress_total: int
    progress_done: int
    error_summary: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    items: list[FetchJobItemRead] = Field(default_factory=list)
