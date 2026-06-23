from fastapi.testclient import TestClient

from qfinancedata.main import app


def test_health_check_returns_service_status() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "qfinancedata-backend",
        "version": "0.1.0",
        "environment": "development",
    }
