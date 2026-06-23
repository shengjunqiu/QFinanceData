from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from qfinancedata.config import Settings
from qfinancedata.main import create_app
from qfinancedata.schemas.prices import PriceBar
from qfinancedata.storage.parquet import PriceBarRepository


def price_bar(symbol: str, day: str, close: float) -> PriceBar:
    return PriceBar(
        symbol=symbol,
        interval="1d",
        timestamp=datetime.fromisoformat(day).replace(tzinfo=timezone.utc),
        open=close - 1,
        high=close + 1,
        low=close - 2,
        close=close,
        adj_close=close - 0.5,
        volume=int(close * 100),
        source="yfinance",
        fetched_at=datetime(2024, 1, 6, 12, 0, tzinfo=timezone.utc),
    )


@pytest.fixture
def client_with_prices(tmp_path) -> TestClient:
    repository = PriceBarRepository(tmp_path / "parquet")
    repository.write_price_bars(
        [
            price_bar("AAPL", "2024-01-01", 100.0),
            price_bar("AAPL", "2024-01-03", 102.0),
            price_bar("AAPL", "2024-01-05", 105.0),
        ]
    )
    app = create_app(
        Settings(
            environment="test",
            data_dir=tmp_path,
            sqlite_path=tmp_path / "qfinancedata.sqlite",
        )
    )

    with TestClient(app) as test_client:
        yield test_client


def test_get_price_series_returns_bars_for_range(client_with_prices: TestClient) -> None:
    response = client_with_prices.get("/api/prices/aapl", params={"range": "1d"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["interval"] == "1d"
    assert payload["range"] == "1d"
    assert payload["status"] == "ok"
    assert [bar["close"] for bar in payload["bars"]] == [105.0]


def test_get_price_series_supports_explicit_start_and_end(
    client_with_prices: TestClient,
) -> None:
    response = client_with_prices.get(
        "/api/prices/AAPL",
        params={
            "range": "all",
            "start": "2024-01-02T00:00:00Z",
            "end": "2024-01-04T00:00:00Z",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert [bar["timestamp"] for bar in payload["bars"]] == [
        "2024-01-03T00:00:00Z"
    ]


def test_get_latest_price_returns_change_metrics(client_with_prices: TestClient) -> None:
    response = client_with_prices.get("/api/prices/AAPL/latest")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["latest_data_at"] == "2024-01-05T00:00:00Z"
    assert payload["latest_price"] == 105.0
    assert payload["change"] == 3.0
    assert payload["change_percent"] == pytest.approx(2.941176470588235)
    assert payload["volume"] == 10500


def test_price_endpoints_return_missing_status_when_no_data(
    client_with_prices: TestClient,
) -> None:
    series_response = client_with_prices.get("/api/prices/MSFT")
    latest_response = client_with_prices.get("/api/prices/MSFT/latest")

    assert series_response.status_code == 200
    assert series_response.json() == {
        "symbol": "MSFT",
        "interval": "1d",
        "range": "1y",
        "status": "missing",
        "bars": [],
    }
    assert latest_response.status_code == 200
    assert latest_response.json() == {
        "symbol": "MSFT",
        "interval": "1d",
        "status": "missing",
        "latest_data_at": None,
        "latest_price": None,
        "change": None,
        "change_percent": None,
        "volume": None,
    }


def test_get_price_series_rejects_invalid_range(client_with_prices: TestClient) -> None:
    response = client_with_prices.get("/api/prices/AAPL", params={"range": "forever"})

    assert response.status_code == 400
    assert "range must be" in response.json()["detail"]
