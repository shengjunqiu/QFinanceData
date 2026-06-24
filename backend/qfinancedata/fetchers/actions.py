from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from qfinancedata.fetchers.yf_client import YFinanceClient, normalize_symbols
from qfinancedata.schemas.actions import CorporateAction


@dataclass(frozen=True)
class NormalizedCorporateActions:
    symbol: str
    actions: list[CorporateAction]
    fetched_at: datetime


class CorporateActionFetcher:
    def __init__(self, yf_client: YFinanceClient) -> None:
        self.yf_client = yf_client

    def fetch_symbol_actions(self, symbol: str) -> NormalizedCorporateActions:
        normalized_symbol = normalize_symbols([symbol])[0]
        fetched_at = utc_now()
        raw = self.yf_client.fetch_actions(normalized_symbol)
        return normalize_corporate_actions(
            normalized_symbol,
            raw,
            fetched_at=fetched_at,
        )


def normalize_corporate_actions(
    symbol: str,
    raw: dict[str, Any],
    *,
    fetched_at: datetime,
) -> NormalizedCorporateActions:
    normalized_symbol = normalize_symbols([symbol])[0]
    actions = [
        *extract_actions(normalized_symbol, "dividend", raw.get("dividends"), fetched_at),
        *extract_actions(normalized_symbol, "split", raw.get("splits"), fetched_at),
    ]
    return NormalizedCorporateActions(
        symbol=normalized_symbol,
        actions=sorted(actions, key=lambda action: action.ex_date),
        fetched_at=fetched_at,
    )


def extract_actions(
    symbol: str,
    action_type: str,
    values: Any,
    fetched_at: datetime,
) -> list[CorporateAction]:
    if values is None:
        return []

    series = pd.Series(values)
    if series.empty:
        return []

    actions: list[CorporateAction] = []
    for ex_date, raw_value in series.items():
        value = to_float(raw_value)
        if value is None or value == 0:
            continue
        actions.append(
            CorporateAction(
                symbol=symbol,
                action_type=action_type,
                ex_date=pd.Timestamp(ex_date).date(),
                value=value,
                fetched_at=fetched_at,
            )
        )
    return actions


def to_float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(number):
        return None
    return number


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
