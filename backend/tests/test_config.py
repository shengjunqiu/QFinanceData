from datetime import date

from qfinancedata.config import PROJECT_ROOT, DEFAULT_DATA_DIR, get_settings

CONFIG_ENV_KEYS = (
    "QFD_ENV",
    "QFD_DATA_DIR",
    "QFD_SQLITE_PATH",
    "QFD_DEFAULT_START_DATE",
    "QFD_DEFAULT_INTERVAL",
    "QFD_STALE_TRADING_DAYS",
    "QFD_FETCH_CONCURRENCY",
    "QFD_REQUEST_TIMEOUT",
    "QFD_LOG_LEVEL",
)


def clear_config_cache() -> None:
    get_settings.cache_clear()


def test_settings_have_development_defaults(monkeypatch) -> None:
    for key in CONFIG_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    clear_config_cache()

    settings = get_settings()

    assert settings.environment == "development"
    assert settings.data_dir == DEFAULT_DATA_DIR.resolve()
    assert settings.sqlite_path == (DEFAULT_DATA_DIR / "qfinancedata.sqlite").resolve()
    assert settings.default_start_date == date(2015, 1, 1)
    assert settings.default_interval == "1d"
    assert settings.stale_trading_days == 3
    assert settings.fetch_concurrency == 4
    assert settings.request_timeout == 20.0
    assert settings.log_level == "INFO"


def test_settings_read_environment_overrides(monkeypatch, tmp_path) -> None:
    data_dir = tmp_path / "qfd-data"
    sqlite_path = tmp_path / "db" / "custom.sqlite"

    monkeypatch.setenv("QFD_ENV", "test")
    monkeypatch.setenv("QFD_DATA_DIR", str(data_dir))
    monkeypatch.setenv("QFD_SQLITE_PATH", str(sqlite_path))
    monkeypatch.setenv("QFD_DEFAULT_START_DATE", "2020-01-02")
    monkeypatch.setenv("QFD_DEFAULT_INTERVAL", "1wk")
    monkeypatch.setenv("QFD_STALE_TRADING_DAYS", "7")
    monkeypatch.setenv("QFD_FETCH_CONCURRENCY", "8")
    monkeypatch.setenv("QFD_REQUEST_TIMEOUT", "12.5")
    monkeypatch.setenv("QFD_LOG_LEVEL", "DEBUG")
    clear_config_cache()

    settings = get_settings()

    assert settings.environment == "test"
    assert settings.data_dir == data_dir.resolve()
    assert settings.sqlite_path == sqlite_path.resolve()
    assert settings.default_start_date == date(2020, 1, 2)
    assert settings.default_interval == "1wk"
    assert settings.stale_trading_days == 7
    assert settings.fetch_concurrency == 8
    assert settings.request_timeout == 12.5
    assert settings.log_level == "DEBUG"
    assert data_dir.is_dir()


def test_relative_paths_resolve_from_project_root(monkeypatch) -> None:
    monkeypatch.setenv("QFD_DATA_DIR", "data")
    monkeypatch.setenv("QFD_SQLITE_PATH", "data/custom/custom.sqlite")
    clear_config_cache()

    settings = get_settings()

    assert settings.data_dir == (PROJECT_ROOT / "data").resolve()
    assert settings.sqlite_path == (PROJECT_ROOT / "data/custom/custom.sqlite").resolve()
