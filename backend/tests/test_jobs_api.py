from __future__ import annotations

from datetime import date

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from qfinancedata.config import Settings
from qfinancedata.main import create_app
from qfinancedata.storage.parquet import PriceBarRepository


class FakeYFinance:
    def __init__(self, responses_by_symbol) -> None:
        self.responses_by_symbol = responses_by_symbol
        self.calls = []

    def download(self, tickers, **kwargs):
        symbols = tickers if isinstance(tickers, list) else [tickers]
        symbol = symbols[0]
        self.calls.append({"symbol": symbol, "tickers": tickers, **kwargs})
        response = self.responses_by_symbol[symbol]
        if isinstance(response, BaseException):
            raise response
        return response


@pytest.fixture
def app_with_fake_yfinance(tmp_path):
    def build(fake_yfinance: FakeYFinance):
        app = create_app(
            Settings(
                environment="test",
                data_dir=tmp_path,
                sqlite_path=tmp_path / "qfinancedata.sqlite",
                default_start_date=date(2020, 1, 1),
                default_interval="1d",
            )
        )
        app.state.yfinance_module = fake_yfinance
        return app

    return build


def price_frame(close_values: list[float]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Open": [value - 1 for value in close_values],
            "High": [value + 1 for value in close_values],
            "Low": [value - 2 for value in close_values],
            "Close": close_values,
            "Adj Close": [value - 0.5 for value in close_values],
            "Volume": [1000 + index for index, _ in enumerate(close_values)],
        },
        index=pd.to_datetime(["2024-01-02", "2024-01-03"][: len(close_values)]),
    )


def test_price_fetch_job_runs_successfully(app_with_fake_yfinance, tmp_path) -> None:
    fake_yfinance = FakeYFinance({"AAPL": price_frame([101.0, 102.0])})
    app = app_with_fake_yfinance(fake_yfinance)

    with TestClient(app) as client:
        response = client.post(
            "/api/fetch/prices",
            json={"symbols": [" aapl "], "start": "2024-01-01", "interval": "1d"},
        )
        assert response.status_code == 201
        job = response.json()

        assert job["status"] == "success"
        assert job["job_type"] == "prices"
        assert job["progress_total"] == 1
        assert job["progress_done"] == 1
        assert job["params"]["symbols"] == ["AAPL"]
        assert job["items"][0]["symbol"] == "AAPL"
        assert job["items"][0]["status"] == "success"
        assert job["items"][0]["error_type"] is None

        job_id = job["id"]
        assert client.get(f"/api/jobs/{job_id}").json()["id"] == job_id
        assert client.get("/api/jobs").json()[0]["id"] == job_id
        status_response = client.get(
            "/api/data-status",
            params={"symbol": "AAPL", "data_type": "prices"},
        )
        assert status_response.status_code == 200
        assert status_response.json()[0]["status"] == "stale"
        assert status_response.json()[0]["last_data_at"] == "2024-01-03T00:00:00Z"

    repository = PriceBarRepository(tmp_path / "parquet")
    bars = repository.read_price_bars("AAPL", "1d")
    assert [bar.close for bar in bars] == [101.0, 102.0]
    assert fake_yfinance.calls[0]["start"] == "2024-01-01"


def test_price_fetch_job_records_partial_success(app_with_fake_yfinance) -> None:
    fake_yfinance = FakeYFinance(
        {
            "AAPL": price_frame([101.0]),
            "MSFT": RuntimeError("upstream changed"),
        }
    )
    app = app_with_fake_yfinance(fake_yfinance)

    with TestClient(app) as client:
        response = client.post(
            "/api/fetch/prices",
            json={"symbols": ["AAPL", "MSFT"]},
        )

    assert response.status_code == 201
    job = response.json()
    assert job["status"] == "partial_success"
    assert job["progress_total"] == 2
    assert job["progress_done"] == 2
    assert "MSFT" in job["error_summary"]

    items = {item["symbol"]: item for item in job["items"]}
    assert items["AAPL"]["status"] == "success"
    assert items["MSFT"]["status"] == "failed"
    assert items["MSFT"]["error_type"] == "YFinanceRequestError"
    assert "upstream changed" in items["MSFT"]["error_message"]

    with TestClient(app) as client:
        failed_status = client.get(
            "/api/data-status",
            params={"symbol": "MSFT", "data_type": "prices"},
        ).json()[0]
    assert failed_status["status"] == "failed"
    assert "upstream changed" in failed_status["last_error"]


def test_price_fetch_job_records_failed_job_when_all_items_fail(
    app_with_fake_yfinance,
) -> None:
    fake_yfinance = FakeYFinance({"AAPL": RuntimeError("offline")})
    app = app_with_fake_yfinance(fake_yfinance)

    with TestClient(app) as client:
        response = client.post(
            "/api/fetch/prices",
            json={"symbols": ["AAPL"]},
        )

    assert response.status_code == 201
    job = response.json()
    assert job["status"] == "failed"
    assert job["progress_total"] == 1
    assert job["progress_done"] == 1
    assert job["items"][0]["status"] == "failed"
    assert job["items"][0]["error_type"] == "YFinanceRequestError"


def test_price_fetch_job_uses_enabled_watchlist_when_symbols_are_omitted(
    app_with_fake_yfinance,
) -> None:
    fake_yfinance = FakeYFinance({"AAPL": price_frame([101.0])})
    app = app_with_fake_yfinance(fake_yfinance)

    with TestClient(app) as client:
        client.post("/api/symbols", json={"symbol": "AAPL"})
        response = client.post("/api/fetch/prices", json={})

    assert response.status_code == 201
    assert response.json()["params"]["symbols"] == ["AAPL"]
    assert fake_yfinance.calls[0]["symbol"] == "AAPL"


def test_price_fetch_job_requires_symbols_or_watchlist(app_with_fake_yfinance) -> None:
    fake_yfinance = FakeYFinance({})
    app = app_with_fake_yfinance(fake_yfinance)

    with TestClient(app) as client:
        response = client.post("/api/fetch/prices", json={})

    assert response.status_code == 400
    assert response.json() == {
        "detail": "No symbols were provided and the watchlist is empty."
    }


def test_get_missing_job_returns_not_found(app_with_fake_yfinance) -> None:
    fake_yfinance = FakeYFinance({})
    app = app_with_fake_yfinance(fake_yfinance)

    with TestClient(app) as client:
        response = client.get("/api/jobs/missing-job")

    assert response.status_code == 404
    assert response.json() == {"detail": "Job missing-job was not found."}
