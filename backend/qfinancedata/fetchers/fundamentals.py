from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

import pandas as pd

from qfinancedata.fetchers.yf_client import YFinanceClient, normalize_symbols
from qfinancedata.schemas.fundamentals import FundamentalFact

METRIC_ALIASES = {
    "market_cap": ("marketCap",),
    "trailing_pe": ("trailingPE",),
    "price_to_book": ("priceToBook",),
    "dividend_yield": ("dividendYield",),
    "fifty_two_week_high": ("fiftyTwoWeekHigh",),
    "fifty_two_week_low": ("fiftyTwoWeekLow",),
}

STATEMENT_ALIASES = {
    "income": {
        "revenue": ("Total Revenue", "totalRevenue", "Revenue"),
        "net_income": ("Net Income", "netIncome", "Net Income Common Stockholders"),
    },
    "balance_sheet": {
        "total_assets": ("Total Assets", "totalAssets"),
        "total_debt": ("Total Debt", "totalDebt"),
    },
    "cashflow": {
        "free_cash_flow": ("Free Cash Flow", "freeCashFlow"),
        "operating_cash_flow": ("Operating Cash Flow", "Total Cash From Operating Activities"),
        "capital_expenditure": ("Capital Expenditure", "Capital Expenditures"),
    },
}


@dataclass(frozen=True)
class NormalizedFundamentals:
    symbol: str
    facts: list[FundamentalFact]
    fetched_at: datetime


class FundamentalFetcher:
    def __init__(self, yf_client: YFinanceClient) -> None:
        self.yf_client = yf_client

    def fetch_symbol_fundamentals(self, symbol: str) -> NormalizedFundamentals:
        normalized_symbol = normalize_symbols([symbol])[0]
        fetched_at = utc_now()
        raw = self.yf_client.fetch_fundamentals(normalized_symbol)
        return normalize_fundamentals(normalized_symbol, raw, fetched_at=fetched_at)


def normalize_fundamentals(
    symbol: str,
    raw: dict[str, Any],
    *,
    fetched_at: datetime,
) -> NormalizedFundamentals:
    normalized_symbol = normalize_symbols([symbol])[0]
    info = raw.get("info") if isinstance(raw.get("info"), dict) else {}
    currency = first_text(info, "currency", "financialCurrency") or ""
    facts = extract_metric_facts(normalized_symbol, info, currency, fetched_at)

    for statement_type, aliases in STATEMENT_ALIASES.items():
        facts.extend(
            extract_statement_facts(
                normalized_symbol,
                statement_type,
                raw.get(statement_type),
                aliases,
                currency,
                fetched_at,
            )
        )

    return NormalizedFundamentals(
        symbol=normalized_symbol,
        facts=facts,
        fetched_at=fetched_at,
    )


def extract_metric_facts(
    symbol: str,
    info: dict[str, Any],
    currency: str,
    fetched_at: datetime,
) -> list[FundamentalFact]:
    period_end = fetched_at.date()
    facts: list[FundamentalFact] = []

    for field, aliases in METRIC_ALIASES.items():
        value = first_number(info, *aliases)
        if value is None:
            continue
        facts.append(
            FundamentalFact(
                symbol=symbol,
                statement_type="metrics",
                period_type="latest",
                period_end=period_end,
                field=field,
                value=value,
                currency=currency,
                fetched_at=fetched_at,
            )
        )

    return facts


def extract_statement_facts(
    symbol: str,
    statement_type: str,
    frame: Any,
    aliases_by_field: dict[str, tuple[str, ...]],
    currency: str,
    fetched_at: datetime,
) -> list[FundamentalFact]:
    if frame is None or bool(getattr(frame, "empty", False)):
        return []

    data = pd.DataFrame(frame)
    if data.empty:
        return []

    normalized_index = {normalize_key(label): label for label in data.index}
    facts: list[FundamentalFact] = []

    for field, aliases in aliases_by_field.items():
        row_label = first_matching_label(normalized_index, aliases)
        if row_label is None:
            continue

        row = data.loc[row_label]
        for period, raw_value in row.items():
            value = to_float(raw_value)
            period_end = to_period_end(period)
            if value is None or period_end is None:
                continue
            facts.append(
                FundamentalFact(
                    symbol=symbol,
                    statement_type=statement_type,
                    period_type="annual",
                    period_end=period_end,
                    field=field,
                    value=value,
                    currency=currency,
                    fetched_at=fetched_at,
                )
            )

    return facts


def first_matching_label(
    normalized_index: dict[str, Any],
    aliases: tuple[str, ...],
) -> Any | None:
    for alias in aliases:
        label = normalized_index.get(normalize_key(alias))
        if label is not None:
            return label
    return None


def first_text(raw: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def first_number(raw: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = to_float(raw.get(key))
        if value is not None:
            return value
    return None


def to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(number):
        return None
    return number


def to_period_end(value: Any) -> date | None:
    try:
        return pd.Timestamp(value).date()
    except (TypeError, ValueError):
        return None


def normalize_key(value: Any) -> str:
    return "".join(character for character in str(value).lower() if character.isalnum())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
