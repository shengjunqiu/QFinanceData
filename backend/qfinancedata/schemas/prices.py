from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class PriceBar(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    interval: str = Field(min_length=1, max_length=16)
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    adj_close: float
    volume: int = Field(ge=0)
    source: str = "yfinance"
    fetched_at: datetime

    @field_validator("symbol", mode="before")
    @classmethod
    def normalize_symbol(cls, value: object) -> str:
        return str(value).strip().upper()

    @field_validator("interval", "source", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> str:
        return str(value).strip()
