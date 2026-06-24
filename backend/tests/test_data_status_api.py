from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from qfinancedata.config import Settings
from qfinancedata.main import create_app
from qfinancedata.quality.validators import evaluate_data_status
from qfinancedata.storage.repositories import DataStatusRepository


@pytest.fixture
def data_status_client(tmp_path):
    sqlite_path = tmp_path / "qfinancedata.sqlite"
    app = create_app(
        Settings(
            environment="test",
            data_dir=tmp_path,
            sqlite_path=sqlite_path,
            stale_trading_days=2,
        )
    )

    with TestClient(app) as client:
        yield client, DataStatusRepository(sqlite_path)


def test_evaluate_data_status_supports_all_statuses() -> None:
    reference = datetime(2024, 1, 8, tzinfo=timezone.utc)

    assert (
        evaluate_data_status(
            last_data_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
            reference_at=reference,
            stale_trading_days=2,
        )
        == "fresh"
    )
    assert (
        evaluate_data_status(
            last_data_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
            reference_at=reference,
            stale_trading_days=2,
        )
        == "stale"
    )
    assert (
        evaluate_data_status(
            last_data_at=None,
            reference_at=reference,
            stale_trading_days=2,
        )
        == "missing"
    )
    assert (
        evaluate_data_status(
            last_data_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
            reference_at=reference,
            stale_trading_days=2,
            had_error=True,
        )
        == "failed"
    )
    assert (
        evaluate_data_status(
            last_data_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
            reference_at=reference,
            stale_trading_days=2,
            partial=True,
        )
        == "partial"
    )


def test_data_status_api_filters_and_returns_missing_status(data_status_client) -> None:
    client, repository = data_status_client
    repository.upsert_status(
        symbol="AAPL",
        data_type="prices",
        status="fresh",
        last_data_at="2024-01-05T00:00:00.000Z",
        last_fetch_at="2024-01-08T12:00:00.000Z",
        last_success_at="2024-01-08T12:00:00.000Z",
    )
    repository.upsert_status(
        symbol="MSFT",
        data_type="prices",
        status="partial",
        last_fetch_at="2024-01-08T12:00:00.000Z",
        last_error="1 symbol failed",
    )

    filtered_response = client.get("/api/data-status", params={"data_type": "prices"})
    missing_response = client.get(
        "/api/data-status",
        params={"symbol": "AAPL", "data_type": "fundamentals"},
    )
    symbol_response = client.get("/api/data-status", params={"symbol": "AAPL"})

    assert filtered_response.status_code == 200
    assert [record["symbol"] for record in filtered_response.json()] == ["AAPL", "MSFT"]
    assert [record["status"] for record in filtered_response.json()] == [
        "fresh",
        "partial",
    ]

    assert missing_response.status_code == 200
    assert missing_response.json()[0]["status"] == "missing"
    assert missing_response.json()[0]["data_type"] == "fundamentals"

    assert symbol_response.status_code == 200
    statuses_by_type = {
        record["data_type"]: record["status"]
        for record in symbol_response.json()
    }
    assert statuses_by_type == {
        "prices": "fresh",
        "metadata": "missing",
        "fundamentals": "missing",
        "actions": "missing",
    }
