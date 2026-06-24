from __future__ import annotations

from datetime import date, datetime, timezone

from qfinancedata.fetchers.yf_client import normalize_symbols
from qfinancedata.quality.validators import evaluate_data_status
from qfinancedata.schemas.jobs import FetchJobRead, PriceFetchRequest
from qfinancedata.services.prices import PriceFetchService
from qfinancedata.storage.repositories import (
    DataStatusRepository,
    JobRepository,
    SymbolRepository,
)


class JobNotFoundError(Exception):
    pass


class NoSymbolsError(Exception):
    pass


class JobService:
    def __init__(
        self,
        job_repository: JobRepository,
        symbol_repository: SymbolRepository,
        data_status_repository: DataStatusRepository,
        price_fetch_service: PriceFetchService,
        *,
        default_start_date: date,
        default_interval: str,
        stale_trading_days: int,
    ) -> None:
        self.job_repository = job_repository
        self.symbol_repository = symbol_repository
        self.data_status_repository = data_status_repository
        self.price_fetch_service = price_fetch_service
        self.default_start_date = default_start_date
        self.default_interval = default_interval
        self.stale_trading_days = stale_trading_days

    def list_jobs(self, *, limit: int = 50) -> list[FetchJobRead]:
        return [FetchJobRead(**record) for record in self.job_repository.list_jobs(limit=limit)]

    def get_job(self, job_id: str) -> FetchJobRead:
        record = self.job_repository.get_job(job_id)
        if record is None:
            raise JobNotFoundError(f"Job {job_id} was not found.")
        return FetchJobRead(**record)

    def run_price_fetch_job(self, payload: PriceFetchRequest) -> FetchJobRead:
        symbols = self.resolve_symbols(payload.symbols)
        interval = payload.interval or self.default_interval
        start = payload.start or self.default_start_date
        end = payload.end
        params = {
            "symbols": symbols,
            "start": start.isoformat() if isinstance(start, date) else start,
            "end": end.isoformat() if isinstance(end, date) else end,
            "interval": interval,
        }

        job = self.job_repository.create_job("prices", params=params, symbols=symbols)
        job_id = job["id"]
        self.job_repository.mark_job_running(job_id)

        success_count = 0
        failure_count = 0
        errors: list[str] = []

        for symbol in symbols:
            self.job_repository.mark_item_running(job_id, symbol)
            try:
                fetch_result = self.price_fetch_service.fetch_symbol_prices(
                    symbol,
                    start=start,
                    end=end,
                    interval=interval,
                )
            except Exception as exc:
                failure_count += 1
                error_type = type(exc).__name__
                error_message = str(exc) or error_type
                errors.append(f"{symbol}: {error_message}")
                self.job_repository.mark_item_finished(
                    job_id,
                    symbol,
                    status="failed",
                    error_type=error_type,
                    error_message=error_message,
                )
                self.data_status_repository.upsert_status(
                    symbol=symbol,
                    data_type="prices",
                    status="failed",
                    last_fetch_at=utc_now_iso(),
                    last_error=error_message,
                )
            else:
                success_count += 1
                self.job_repository.mark_item_finished(job_id, symbol, status="success")
                data_status = evaluate_data_status(
                    last_data_at=fetch_result.last_data_at,
                    reference_at=fetch_result.fetched_at,
                    stale_trading_days=self.stale_trading_days,
                )
                self.data_status_repository.upsert_status(
                    symbol=symbol,
                    data_type="prices",
                    status=data_status,
                    last_data_at=to_iso(fetch_result.last_data_at),
                    last_fetch_at=to_iso(fetch_result.fetched_at),
                    last_success_at=to_iso(fetch_result.fetched_at),
                    last_error=None,
                )

        status = resolve_job_status(success_count=success_count, failure_count=failure_count)
        error_summary = "; ".join(errors) if errors else None
        self.job_repository.mark_job_finished(
            job_id,
            status=status,
            error_summary=error_summary,
        )
        return self.get_job(job_id)

    def resolve_symbols(self, requested_symbols: list[str] | None) -> list[str]:
        if requested_symbols is not None:
            return normalize_symbols(requested_symbols)

        watchlist_symbols = [
            record["symbol"]
            for record in self.symbol_repository.list_symbols(include_disabled=False)
        ]
        if not watchlist_symbols:
            raise NoSymbolsError("No symbols were provided and the watchlist is empty.")
        return normalize_symbols(watchlist_symbols)


def resolve_job_status(*, success_count: int, failure_count: int) -> str:
    if failure_count == 0:
        return "success"
    if success_count == 0:
        return "failed"
    return "partial_success"


def to_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00",
        "Z",
    )


def utc_now_iso() -> str:
    return to_iso(datetime.now(timezone.utc))
