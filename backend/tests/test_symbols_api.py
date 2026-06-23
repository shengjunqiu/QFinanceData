import pytest
from fastapi.testclient import TestClient

from qfinancedata.config import Settings
from qfinancedata.main import create_app


@pytest.fixture
def client(tmp_path) -> TestClient:
    app = create_app(
        Settings(
            environment="test",
            data_dir=tmp_path,
            sqlite_path=tmp_path / "qfinancedata.sqlite",
        )
    )

    with TestClient(app) as test_client:
        yield test_client


def test_symbol_api_create_list_update_and_remove(client: TestClient) -> None:
    create_response = client.post(
        "/api/symbols",
        json={
            "symbol": "aapl",
            "name": "Apple Inc.",
            "exchange": "NMS",
            "asset_type": "equity",
            "currency": "USD",
            "group_name": "US Stocks",
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["symbol"] == "AAPL"
    assert created["enabled"] is True
    assert created["status"] == "missing"

    list_response = client.get("/api/symbols")
    assert list_response.status_code == 200
    assert [symbol["symbol"] for symbol in list_response.json()] == ["AAPL"]

    update_response = client.patch(
        "/api/symbols/AAPL",
        json={"group_name": "Core", "currency": "USD"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["group_name"] == "Core"

    delete_response = client.delete("/api/symbols/AAPL")
    assert delete_response.status_code == 204
    assert delete_response.content == b""

    enabled_response = client.get("/api/symbols")
    assert enabled_response.json() == []

    all_response = client.get("/api/symbols", params={"include_disabled": True})
    disabled_symbol = all_response.json()[0]
    assert disabled_symbol["symbol"] == "AAPL"
    assert disabled_symbol["enabled"] is False

    restore_response = client.post(
        "/api/symbols",
        json={"symbol": "AAPL", "group_name": "Restored"},
    )
    assert restore_response.status_code == 200
    assert restore_response.json()["enabled"] is True
    assert restore_response.json()["group_name"] == "Restored"


def test_create_duplicate_enabled_symbol_returns_conflict(client: TestClient) -> None:
    response = client.post("/api/symbols", json={"symbol": "MSFT"})
    assert response.status_code == 201

    duplicate_response = client.post("/api/symbols", json={"symbol": "msft"})

    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {
        "detail": "Symbol MSFT already exists in the watchlist."
    }


def test_update_and_delete_missing_symbol_return_not_found(client: TestClient) -> None:
    update_response = client.patch(
        "/api/symbols/DOESNOTEXIST",
        json={"group_name": "Missing"},
    )
    delete_response = client.delete("/api/symbols/DOESNOTEXIST")

    assert update_response.status_code == 404
    assert update_response.json() == {
        "detail": "Symbol DOESNOTEXIST was not found."
    }
    assert delete_response.status_code == 404
    assert delete_response.json() == {
        "detail": "Symbol DOESNOTEXIST was not found."
    }


def test_list_symbols_can_filter_by_group(client: TestClient) -> None:
    client.post("/api/symbols", json={"symbol": "AAPL", "group_name": "US Stocks"})
    client.post("/api/symbols", json={"symbol": "0700.HK", "group_name": "HK Stocks"})

    response = client.get("/api/symbols", params={"group_name": "HK Stocks"})

    assert response.status_code == 200
    assert [symbol["symbol"] for symbol in response.json()] == ["0700.HK"]
