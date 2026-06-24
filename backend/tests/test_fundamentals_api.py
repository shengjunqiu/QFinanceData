from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from qfinancedata.config import Settings
from qfinancedata.main import create_app
from qfinancedata.schemas.fundamentals import FundamentalFact
from qfinancedata.storage.parquet import FundamentalFactRepository
from qfinancedata.storage.repositories import DataStatusRepository


def fact(field: str, value: float, statement_type: str) -> FundamentalFact:
    return FundamentalFact(
        symbol="AAPL",
        statement_type=statement_type,
        period_type="annual",
        period_end=date(2023, 12, 31),
        field=field,
        value=value,
        currency="USD",
        fetched_at=datetime(2024, 1, 15, 12, 0, tzinfo=timezone.utc),
    )


@pytest.fixture
def client_with_fundamentals(tmp_path) -> TestClient:
    repository = FundamentalFactRepository(tmp_path / "parquet")
    repository.write_facts(
        [
            fact("market_cap", 3_000_000_000.0, "metrics"),
            fact("trailing_pe", 30.5, "metrics"),
            fact("price_to_book", 12.2, "metrics"),
            fact("dividend_yield", 0.006, "metrics"),
            fact("revenue", 1000.0, "income"),
            fact("net_income", 200.0, "income"),
            fact("operating_cash_flow", 300.0, "cashflow"),
            fact("capital_expenditure", -80.0, "cashflow"),
            fact("total_assets", 5000.0, "balance_sheet"),
            fact("total_debt", 1200.0, "balance_sheet"),
        ]
    )
    settings = Settings(
        environment="test",
        data_dir=tmp_path,
        sqlite_path=tmp_path / "qfinancedata.sqlite",
    )
    app = create_app(settings)

    with TestClient(app) as test_client:
        DataStatusRepository(settings.sqlite_path).upsert_status(
            symbol="AAPL",
            data_type="fundamentals",
            status="fresh",
            last_data_at="2023-12-31T00:00:00.000Z",
            last_fetch_at="2024-01-15T12:00:00.000Z",
            last_success_at="2024-01-15T12:00:00.000Z",
        )
        yield test_client


def test_get_fundamentals_returns_snapshot(client_with_fundamentals: TestClient) -> None:
    response = client_with_fundamentals.get("/api/fundamentals/aapl")

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["status"] == "fresh"
    assert payload["currency"] == "USD"
    assert payload["metrics"]["market_cap"] == 3_000_000_000.0
    assert payload["metrics"]["trailing_pe"] == 30.5
    assert payload["financial_summary"]["revenue"] == 1000.0
    assert payload["financial_summary"]["free_cash_flow"] == 220.0
    assert payload["financial_summary"]["debt_ratio"] == 0.24
    assert payload["missing_fields"] == ["fifty_two_week_high", "fifty_two_week_low"]
    assert payload["last_fetch_at"] == "2024-01-15T12:00:00Z"


def test_get_fundamentals_returns_missing_snapshot(
    client_with_fundamentals: TestClient,
) -> None:
    response = client_with_fundamentals.get("/api/fundamentals/msft")

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "MSFT"
    assert payload["status"] == "missing"
    assert payload["metrics"]["market_cap"] is None
    assert payload["financial_summary"]["revenue"] is None
    assert "market_cap" in payload["missing_fields"]
    assert "revenue" in payload["missing_fields"]
    assert payload["last_fetch_at"] is None
