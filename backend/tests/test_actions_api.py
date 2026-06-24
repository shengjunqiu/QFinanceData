from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from qfinancedata.config import Settings
from qfinancedata.main import create_app
from qfinancedata.schemas.actions import CorporateAction
from qfinancedata.storage.parquet import CorporateActionRepository


def action(action_type: str, ex_date: date, value: float) -> CorporateAction:
    return CorporateAction(
        symbol="AAPL",
        action_type=action_type,
        ex_date=ex_date,
        value=value,
        fetched_at=datetime(2024, 1, 15, 12, 0, tzinfo=timezone.utc),
    )


@pytest.fixture
def client_with_actions(tmp_path) -> TestClient:
    CorporateActionRepository(tmp_path / "parquet").write_actions(
        [
            action("dividend", date(2024, 1, 10), 0.24),
            action("split", date(2020, 8, 31), 4.0),
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


def test_list_corporate_actions_returns_events(client_with_actions: TestClient) -> None:
    response = client_with_actions.get("/api/actions/aapl")

    assert response.status_code == 200
    assert response.json() == [
        {
            "symbol": "AAPL",
            "action_type": "dividend",
            "ex_date": "2024-01-10",
            "value": 0.24,
        },
        {
            "symbol": "AAPL",
            "action_type": "split",
            "ex_date": "2020-08-31",
            "value": 4.0,
        },
    ]


def test_list_corporate_actions_returns_empty_list_for_missing_symbol(
    client_with_actions: TestClient,
) -> None:
    response = client_with_actions.get("/api/actions/MSFT")

    assert response.status_code == 200
    assert response.json() == []
