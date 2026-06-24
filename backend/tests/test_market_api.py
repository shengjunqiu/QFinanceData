from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from qfinancedata.config import Settings
from qfinancedata.main import create_app
from qfinancedata.schemas.prices import PriceBar
from qfinancedata.storage.parquet import PriceBarRepository
from qfinancedata.storage.repositories import DataStatusRepository, JobRepository


def price_bar(symbol: str, day: str, close: float) -> PriceBar:
    return PriceBar(
        symbol=symbol,
        interval="1d",
        timestamp=datetime.fromisoformat(day).replace(tzinfo=timezone.utc),
        open=close - 1,
        high=close + 1,
        low=close - 2,
        close=close,
        adj_close=close,
        volume=int(close * 100),
        source="yfinance",
        fetched_at=datetime(2024, 1, 8, 12, 0, tzinfo=timezone.utc),
    )


@pytest.fixture
def market_client(tmp_path):
    sqlite_path = tmp_path / "qfinancedata.sqlite"
    PriceBarRepository(tmp_path / "parquet").write_price_bars(
        [
            price_bar("AAPL", "2024-01-05", 100.0),
            price_bar("AAPL", "2024-01-08", 110.0),
            price_bar("SPY", "2024-01-05", 400.0),
            price_bar("SPY", "2024-01-08", 404.0),
            price_bar("MSFT", "2024-01-05", 200.0),
            price_bar("MSFT", "2024-01-08", 190.0),
        ]
    )
    app = create_app(
        Settings(
            environment="test",
            data_dir=tmp_path,
            sqlite_path=sqlite_path,
        )
    )

    with TestClient(app) as client:
        yield client, DataStatusRepository(sqlite_path), JobRepository(sqlite_path)


def test_market_overview_returns_stable_empty_shape(tmp_path) -> None:
    app = create_app(
        Settings(
            environment="test",
            data_dir=tmp_path,
            sqlite_path=tmp_path / "qfinancedata.sqlite",
        )
    )

    with TestClient(app) as client:
        response = client.get("/api/market/overview")

    assert response.status_code == 200
    assert response.json() == {
        "last_update_at": None,
        "indices": [],
        "watchlist": [],
        "top_gainers": [],
        "top_losers": [],
        "freshness": {
            "fresh": 0,
            "stale": 0,
            "missing": 0,
            "failed": 0,
            "partial": 0,
        },
        "freshness_by_type": {
            "prices": {
                "fresh": 0,
                "stale": 0,
                "missing": 0,
                "failed": 0,
                "partial": 0,
            },
            "metadata": {
                "fresh": 0,
                "stale": 0,
                "missing": 0,
                "failed": 0,
                "partial": 0,
            },
            "fundamentals": {
                "fresh": 0,
                "stale": 0,
                "missing": 0,
                "failed": 0,
                "partial": 0,
            },
            "actions": {
                "fresh": 0,
                "stale": 0,
                "missing": 0,
                "failed": 0,
                "partial": 0,
            },
        },
        "recent_jobs": [],
    }


def test_market_overview_aggregates_dashboard_data(market_client) -> None:
    client, data_status_repository, job_repository = market_client
    client.post(
        "/api/symbols",
        json={
            "symbol": "AAPL",
            "name": "Apple Inc.",
            "exchange": "NASDAQ",
            "asset_type": "equity",
            "currency": "USD",
            "group_name": "Core",
        },
    )
    client.post(
        "/api/symbols",
        json={
            "symbol": "SPY",
            "name": "SPDR S&P 500 ETF",
            "exchange": "NYSE",
            "asset_type": "etf",
            "currency": "USD",
            "group_name": "Core",
        },
    )
    client.post(
        "/api/symbols",
        json={
            "symbol": "MSFT",
            "name": "Microsoft",
            "exchange": "NASDAQ",
            "asset_type": "equity",
            "currency": "USD",
            "group_name": "Core",
        },
    )
    data_status_repository.upsert_status(
        symbol="AAPL",
        data_type="prices",
        status="fresh",
        last_data_at="2024-01-08T00:00:00.000Z",
        last_fetch_at="2024-01-08T12:00:00.000Z",
        last_success_at="2024-01-08T12:00:00.000Z",
    )
    data_status_repository.upsert_status(
        symbol="SPY",
        data_type="prices",
        status="fresh",
        last_data_at="2024-01-08T00:00:00.000Z",
        last_fetch_at="2024-01-08T12:00:00.000Z",
        last_success_at="2024-01-08T12:00:00.000Z",
    )
    data_status_repository.upsert_status(
        symbol="MSFT",
        data_type="prices",
        status="failed",
        last_data_at="2024-01-08T00:00:00.000Z",
        last_fetch_at="2024-01-08T12:00:00.000Z",
        last_error="timeout",
    )
    data_status_repository.upsert_status(
        symbol="AAPL",
        data_type="fundamentals",
        status="fresh",
        last_data_at="2023-12-31T00:00:00.000Z",
        last_fetch_at="2024-01-08T12:00:00.000Z",
        last_success_at="2024-01-08T12:00:00.000Z",
    )
    data_status_repository.upsert_status(
        symbol="SPY",
        data_type="actions",
        status="failed",
        last_fetch_at="2024-01-08T12:00:00.000Z",
        last_error="empty response",
    )
    job_repository.create_job(
        "prices",
        params={"symbols": ["AAPL"], "interval": "1d"},
        symbols=["AAPL"],
    )

    response = client.get("/api/market/overview")

    assert response.status_code == 200
    payload = response.json()
    assert payload["last_update_at"] is not None
    assert [quote["symbol"] for quote in payload["watchlist"]] == ["AAPL", "MSFT", "SPY"]
    assert [quote["symbol"] for quote in payload["indices"]] == ["SPY"]
    assert payload["watchlist"][0]["latest_price"] == 110.0
    assert payload["watchlist"][0]["change_percent"] == 10.0
    assert payload["top_gainers"][0]["symbol"] == "AAPL"
    assert payload["top_losers"][0]["symbol"] == "MSFT"
    assert payload["freshness"] == {
        "fresh": 2,
        "stale": 0,
        "missing": 0,
        "failed": 1,
        "partial": 0,
    }
    assert payload["freshness_by_type"]["prices"] == {
        "fresh": 2,
        "stale": 0,
        "missing": 0,
        "failed": 1,
        "partial": 0,
    }
    assert payload["freshness_by_type"]["fundamentals"] == {
        "fresh": 1,
        "stale": 0,
        "missing": 2,
        "failed": 0,
        "partial": 0,
    }
    assert payload["freshness_by_type"]["actions"] == {
        "fresh": 0,
        "stale": 0,
        "missing": 2,
        "failed": 1,
        "partial": 0,
    }
    assert len(payload["recent_jobs"]) == 1
    assert payload["recent_jobs"][0]["job_type"] == "prices"
