from __future__ import annotations

from datetime import datetime, timezone

from qfinancedata.schemas.data_status import DataStatusValue, DataTypeValue
from qfinancedata.schemas.jobs import FetchJobRead
from qfinancedata.schemas.market import MarketOverviewRead, MarketQuoteRead
from qfinancedata.schemas.prices import LatestPriceResponse
from qfinancedata.schemas.symbols import SymbolRead
from qfinancedata.services.data_status import DATA_TYPES
from qfinancedata.services.prices import PriceQueryService
from qfinancedata.storage.repositories import (
    DataStatusRepository,
    JobRepository,
    SymbolRepository,
)

FRESHNESS_STATUSES: tuple[DataStatusValue, ...] = (
    "fresh",
    "stale",
    "missing",
    "failed",
    "partial",
)
MARKET_SYMBOLS = {"SPY", "QQQ", "DIA", "^GSPC", "^IXIC", "^DJI"}


class MarketOverviewService:
    def __init__(
        self,
        symbol_repository: SymbolRepository,
        job_repository: JobRepository,
        data_status_repository: DataStatusRepository,
        price_query_service: PriceQueryService,
    ) -> None:
        self.symbol_repository = symbol_repository
        self.job_repository = job_repository
        self.data_status_repository = data_status_repository
        self.price_query_service = price_query_service

    def get_overview(self) -> MarketOverviewRead:
        symbols = [
            SymbolRead(**record)
            for record in self.symbol_repository.list_symbols(include_disabled=False)
        ]
        quotes = [self._build_quote(symbol) for symbol in symbols]
        recent_jobs = [
            FetchJobRead(**record)
            for record in self.job_repository.list_jobs(limit=4)
        ]
        movers = [quote for quote in quotes if quote.change_percent is not None]

        return MarketOverviewRead(
            last_update_at=latest_timestamp(quotes, recent_jobs),
            indices=market_indices(quotes),
            watchlist=quotes,
            top_gainers=sorted(
                movers,
                key=lambda quote: quote.change_percent or 0,
                reverse=True,
            )[:3],
            top_losers=sorted(movers, key=lambda quote: quote.change_percent or 0)[:3],
            freshness=count_freshness(quotes),
            freshness_by_type=count_freshness_by_type(
                symbols,
                self.data_status_repository,
            ),
            recent_jobs=recent_jobs,
        )

    def _build_quote(self, symbol: SymbolRead) -> MarketQuoteRead:
        latest = self.price_query_service.get_latest_price(
            symbol.symbol,
            interval="1d",
        )
        return quote_from_symbol(symbol, latest)


def quote_from_symbol(
    symbol: SymbolRead,
    latest: LatestPriceResponse,
) -> MarketQuoteRead:
    return MarketQuoteRead(
        symbol=symbol.symbol,
        name=symbol.name,
        exchange=symbol.exchange,
        asset_type=symbol.asset_type,
        currency=symbol.currency,
        group_name=symbol.group_name,
        enabled=symbol.enabled,
        status=symbol.status,
        last_data_at=symbol.last_data_at,
        last_fetch_at=symbol.last_fetch_at,
        created_at=symbol.created_at,
        updated_at=symbol.updated_at,
        latest_data_at=latest.latest_data_at,
        latest_price=latest.latest_price,
        change=latest.change,
        change_percent=latest.change_percent,
        volume=latest.volume,
    )


def market_indices(quotes: list[MarketQuoteRead]) -> list[MarketQuoteRead]:
    indices = [
        quote
        for quote in quotes
        if quote.asset_type == "index" or quote.symbol in MARKET_SYMBOLS
    ]
    return (indices or quotes)[:4]


def count_freshness(quotes: list[MarketQuoteRead]) -> dict[DataStatusValue, int]:
    counts = {status: 0 for status in FRESHNESS_STATUSES}

    for quote in quotes:
        counts[quote.status] += 1

    return counts


def count_freshness_by_type(
    symbols: list[SymbolRead],
    repository: DataStatusRepository,
) -> dict[DataTypeValue, dict[DataStatusValue, int]]:
    counts: dict[DataTypeValue, dict[DataStatusValue, int]] = {
        data_type: {status: 0 for status in FRESHNESS_STATUSES}
        for data_type in DATA_TYPES
    }
    if not symbols:
        return counts

    symbol_set = {symbol.symbol for symbol in symbols}
    records = {
        (record["symbol"], record["data_type"]): record["status"]
        for record in repository.list_status()
        if record["symbol"] in symbol_set and record["data_type"] in DATA_TYPES
    }

    for symbol in symbols:
        for data_type in DATA_TYPES:
            status = records.get((symbol.symbol, data_type), "missing")
            counts[data_type][status] += 1

    return counts


def latest_timestamp(
    quotes: list[MarketQuoteRead],
    recent_jobs: list[FetchJobRead],
) -> datetime | None:
    timestamps: list[datetime] = []

    for quote in quotes:
        timestamps.extend(
            value
            for value in (
                coerce_datetime(quote.latest_data_at),
                coerce_datetime(quote.last_data_at),
                coerce_datetime(quote.last_fetch_at),
            )
            if value is not None
        )

    for job in recent_jobs:
        timestamps.extend(
            value
            for value in (
                coerce_datetime(job.created_at),
                coerce_datetime(job.started_at),
                coerce_datetime(job.finished_at),
            )
            if value is not None
        )

    return max(timestamps) if timestamps else None


def coerce_datetime(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
