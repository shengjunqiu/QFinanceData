from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from qfinancedata.schemas.data_status import DataStatusValue, DataTypeValue
from qfinancedata.schemas.jobs import FetchJobRead


class MarketQuoteRead(BaseModel):
    symbol: str
    name: str
    exchange: str
    asset_type: str
    currency: str
    group_name: str
    enabled: bool
    status: DataStatusValue
    last_data_at: str | None = None
    last_fetch_at: str | None = None
    created_at: str
    updated_at: str
    latest_data_at: datetime | None = None
    latest_price: float | None = None
    change: float | None = None
    change_percent: float | None = None
    volume: int | None = None


class MarketOverviewRead(BaseModel):
    last_update_at: datetime | None = None
    indices: list[MarketQuoteRead] = Field(default_factory=list)
    watchlist: list[MarketQuoteRead] = Field(default_factory=list)
    top_gainers: list[MarketQuoteRead] = Field(default_factory=list)
    top_losers: list[MarketQuoteRead] = Field(default_factory=list)
    freshness: dict[DataStatusValue, int]
    freshness_by_type: dict[DataTypeValue, dict[DataStatusValue, int]] = Field(
        default_factory=dict,
    )
    recent_jobs: list[FetchJobRead] = Field(default_factory=list)
