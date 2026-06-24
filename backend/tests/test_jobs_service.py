from datetime import date, datetime, timezone

import pytest

from qfinancedata.schemas.jobs import PriceFetchRequest
from qfinancedata.services.jobs import JobService, NoSymbolsError
from qfinancedata.services.prices import PriceFetchResult
from qfinancedata.storage.repositories import (
    DataStatusRepository,
    JobRepository,
    SymbolRepository,
)
from qfinancedata.storage.sqlite import initialize_database


class FakePriceFetchService:
    def __init__(self, outcomes) -> None:
        self.outcomes = outcomes
        self.calls = []

    def fetch_symbol_prices(self, symbol, *, start, end, interval):
        self.calls.append(
            {
                "symbol": symbol,
                "start": start,
                "end": end,
                "interval": interval,
            }
        )
        outcome = self.outcomes[symbol]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


@pytest.fixture
def repositories(tmp_path):
    sqlite_path = tmp_path / "qfinancedata.sqlite"
    initialize_database(sqlite_path)
    return {
        "jobs": JobRepository(sqlite_path),
        "symbols": SymbolRepository(sqlite_path),
        "statuses": DataStatusRepository(sqlite_path),
    }


def build_service(repositories, fake_price_fetch_service) -> JobService:
    return JobService(
        repositories["jobs"],
        repositories["symbols"],
        repositories["statuses"],
        fake_price_fetch_service,
        default_start_date=date(2020, 1, 1),
        default_interval="1d",
        stale_trading_days=2,
    )


def fetch_result(symbol: str, latest_day: str) -> PriceFetchResult:
    fetched_at = datetime(2024, 1, 8, 12, 0, tzinfo=timezone.utc)
    return PriceFetchResult(
        symbol=symbol,
        bars_written=2,
        last_data_at=datetime.fromisoformat(latest_day).replace(tzinfo=timezone.utc),
        fetched_at=fetched_at,
    )


def test_job_service_records_success_and_data_status(repositories) -> None:
    fake_price_fetch_service = FakePriceFetchService(
        {"AAPL": fetch_result("AAPL", "2024-01-05")}
    )
    service = build_service(repositories, fake_price_fetch_service)

    job = service.run_price_fetch_job(
        PriceFetchRequest(symbols=["aapl"], start=date(2024, 1, 1))
    )

    assert job.status == "success"
    assert job.progress_total == 1
    assert job.progress_done == 1
    assert job.items[0].status == "success"
    assert fake_price_fetch_service.calls == [
        {
            "symbol": "AAPL",
            "start": date(2024, 1, 1),
            "end": None,
            "interval": "1d",
        }
    ]

    status = repositories["statuses"].get_status("AAPL", "prices")
    assert status["status"] == "fresh"
    assert status["last_error"] is None


def test_job_service_records_partial_success_and_failed_item(repositories) -> None:
    fake_price_fetch_service = FakePriceFetchService(
        {
            "AAPL": fetch_result("AAPL", "2024-01-05"),
            "MSFT": RuntimeError("download failed"),
        }
    )
    service = build_service(repositories, fake_price_fetch_service)

    job = service.run_price_fetch_job(PriceFetchRequest(symbols=["AAPL", "MSFT"]))

    assert job.status == "partial_success"
    assert job.progress_total == 2
    assert job.progress_done == 2
    items = {item.symbol: item for item in job.items}
    assert items["AAPL"].status == "success"
    assert items["MSFT"].status == "failed"
    assert items["MSFT"].error_type == "RuntimeError"
    assert "download failed" in job.error_summary

    failed_status = repositories["statuses"].get_status("MSFT", "prices")
    assert failed_status["status"] == "failed"
    assert failed_status["last_error"] == "download failed"


def test_job_service_uses_enabled_watchlist_when_symbols_are_omitted(repositories) -> None:
    repositories["symbols"].create_symbol({"symbol": "AAPL", "enabled": True})
    fake_price_fetch_service = FakePriceFetchService(
        {"AAPL": fetch_result("AAPL", "2024-01-05")}
    )
    service = build_service(repositories, fake_price_fetch_service)

    job = service.run_price_fetch_job(PriceFetchRequest())

    assert job.params["symbols"] == ["AAPL"]
    assert fake_price_fetch_service.calls[0]["symbol"] == "AAPL"


def test_job_service_rejects_empty_watchlist_when_symbols_are_omitted(repositories) -> None:
    service = build_service(repositories, FakePriceFetchService({}))

    with pytest.raises(NoSymbolsError, match="watchlist is empty"):
        service.run_price_fetch_job(PriceFetchRequest())
