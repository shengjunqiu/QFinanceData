from __future__ import annotations

from datetime import datetime, timezone

import pytest
import pandas as pd

from qfinancedata.fetchers.fundamentals import normalize_fundamentals


def test_normalize_fundamentals_extracts_metrics_and_statement_facts() -> None:
    fetched_at = datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc)
    statement_date = pd.Timestamp("2023-12-31")
    raw = {
        "info": {
            "currency": "USD",
            "marketCap": 3_000_000_000,
            "trailingPE": 30.5,
            "priceToBook": 12.2,
            "dividendYield": 0.006,
            "fiftyTwoWeekHigh": 199.0,
            "fiftyTwoWeekLow": 124.0,
        },
        "income": pd.DataFrame(
            {statement_date: [1000.0, 200.0]},
            index=["Total Revenue", "Net Income"],
        ),
        "balance_sheet": pd.DataFrame(
            {statement_date: [5000.0, 1200.0]},
            index=["Total Assets", "Total Debt"],
        ),
        "cashflow": pd.DataFrame(
            {statement_date: [300.0, -80.0]},
            index=["Operating Cash Flow", "Capital Expenditure"],
        ),
    }

    normalized = normalize_fundamentals(" aapl ", raw, fetched_at=fetched_at)
    facts_by_field = {fact.field: fact for fact in normalized.facts}

    assert normalized.symbol == "AAPL"
    assert facts_by_field["market_cap"].value == 3_000_000_000
    assert facts_by_field["trailing_pe"].value == 30.5
    assert facts_by_field["revenue"].period_end.isoformat() == "2023-12-31"
    assert facts_by_field["revenue"].value == 1000.0
    assert facts_by_field["capital_expenditure"].value == -80.0
    assert {fact.currency for fact in normalized.facts} == {"USD"}


def test_normalize_fundamentals_skips_missing_fields() -> None:
    fetched_at = datetime(2024, 1, 15, tzinfo=timezone.utc)

    normalized = normalize_fundamentals(
        "MSFT",
        {"info": {"currency": "USD", "marketCap": None}},
        fetched_at=fetched_at,
    )

    assert normalized.facts == []
