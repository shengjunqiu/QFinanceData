from fastapi.testclient import TestClient

from qfinancedata.config import Settings
from qfinancedata.main import create_app


def test_health_check_returns_service_status(tmp_path) -> None:
    sqlite_path = tmp_path / "qfinancedata.sqlite"
    app = create_app(
        Settings(
            environment="test",
            data_dir=tmp_path,
            sqlite_path=sqlite_path,
        )
    )

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "qfinancedata-backend",
        "version": "0.1.0",
        "environment": "test",
    }
    assert sqlite_path.is_file()
