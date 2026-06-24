from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

DataStatusValue = Literal["fresh", "stale", "missing", "failed", "partial"]
DataTypeValue = Literal["prices", "metadata", "fundamentals", "actions"]


class DataStatusRead(BaseModel):
    symbol: str
    data_type: DataTypeValue
    status: DataStatusValue
    last_data_at: datetime | None = None
    last_fetch_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error: str | None = None
    updated_at: datetime | None = None
