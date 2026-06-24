from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class CorporateAction(BaseModel):
    symbol: str
    action_type: Literal["dividend", "split"]
    ex_date: date
    value: float
    fetched_at: datetime


class CorporateActionRead(BaseModel):
    symbol: str
    action_type: Literal["dividend", "split"]
    ex_date: date
    value: float
