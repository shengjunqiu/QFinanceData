from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from qfinancedata.schemas.data_status import DataStatusValue


class FundamentalFact(BaseModel):
    symbol: str
    statement_type: str
    period_type: str
    period_end: date
    field: str
    value: float
    currency: str = ""
    fetched_at: datetime


class FundamentalMetrics(BaseModel):
    market_cap: float | None = None
    trailing_pe: float | None = None
    price_to_book: float | None = None
    dividend_yield: float | None = None
    fifty_two_week_high: float | None = None
    fifty_two_week_low: float | None = None


class FinancialSummary(BaseModel):
    revenue: float | None = None
    net_income: float | None = None
    free_cash_flow: float | None = None
    debt_ratio: float | None = None


class FundamentalSnapshotRead(BaseModel):
    symbol: str
    currency: str = ""
    metrics: FundamentalMetrics
    financial_summary: FinancialSummary
    missing_fields: list[str] = Field(default_factory=list)
    last_fetch_at: datetime | None = None
    status: DataStatusValue = "missing"
