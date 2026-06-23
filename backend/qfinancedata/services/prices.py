from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from qfinancedata.fetchers.prices import normalize_price_frame
from qfinancedata.fetchers.yf_client import YFinanceClient
from qfinancedata.schemas.prices import (
    LatestPriceResponse,
    PriceBar,
    PriceBarRead,
    PriceSeriesResponse,
)
from qfinancedata.storage.parquet import PriceBarRepository


@dataclass(frozen=True)
class PriceFetchResult:
    symbol: str
    bars_written: int


class PriceFetchService:
    def __init__(
        self,
        yf_client: YFinanceClient,
        price_bar_repository: PriceBarRepository,
    ) -> None:
        self.yf_client = yf_client
        self.price_bar_repository = price_bar_repository

    def fetch_symbol_prices(
        self,
        symbol: str,
        *,
        start: date | str | None,
        end: date | str | None,
        interval: str,
    ) -> PriceFetchResult:
        frame = self.yf_client.download_prices(
            [symbol],
            start=start,
            end=end,
            interval=interval,
        )
        bars = normalize_price_frame(frame, [symbol], interval=interval)
        bars_written = self.price_bar_repository.write_price_bars(bars)
        return PriceFetchResult(symbol=symbol, bars_written=bars_written)


class PriceQueryService:
    def __init__(self, price_bar_repository: PriceBarRepository) -> None:
        self.price_bar_repository = price_bar_repository

    def get_price_series(
        self,
        symbol: str,
        *,
        interval: str,
        range_value: str,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> PriceSeriesResponse:
        normalized_symbol = normalize_symbol(symbol)
        normalized_interval = normalize_interval(interval)
        normalized_range = normalize_range(range_value)
        bars = self.price_bar_repository.read_price_bars(
            normalized_symbol,
            normalized_interval,
            start=start,
            end=end,
        )
        bars = filter_bars_by_range(bars, normalized_range)

        return PriceSeriesResponse(
            symbol=normalized_symbol,
            interval=normalized_interval,
            range=normalized_range,
            status="ok" if bars else "missing",
            bars=[to_price_bar_read(bar) for bar in bars],
        )

    def get_latest_price(
        self,
        symbol: str,
        *,
        interval: str,
    ) -> LatestPriceResponse:
        normalized_symbol = normalize_symbol(symbol)
        normalized_interval = normalize_interval(interval)
        bars = self.price_bar_repository.read_price_bars(
            normalized_symbol,
            normalized_interval,
        )
        if not bars:
            return LatestPriceResponse(
                symbol=normalized_symbol,
                interval=normalized_interval,
                status="missing",
            )

        latest = bars[-1]
        previous = bars[-2] if len(bars) >= 2 else None
        change = latest.close - previous.close if previous else None
        change_percent = (
            (change / previous.close) * 100
            if previous and previous.close != 0 and change is not None
            else None
        )

        return LatestPriceResponse(
            symbol=normalized_symbol,
            interval=normalized_interval,
            status="ok",
            latest_data_at=latest.timestamp,
            latest_price=latest.close,
            change=change,
            change_percent=change_percent,
            volume=latest.volume,
        )


def normalize_symbol(symbol: str) -> str:
    normalized = symbol.strip().upper()
    if not normalized:
        raise ValueError("symbol is required.")
    return normalized


def normalize_interval(interval: str) -> str:
    normalized = interval.strip()
    if not normalized:
        raise ValueError("interval is required.")
    return normalized


def normalize_range(range_value: str) -> str:
    normalized = range_value.strip().lower()
    if not normalized:
        raise ValueError("range is required.")
    return normalized


def filter_bars_by_range(bars: list[PriceBar], range_value: str) -> list[PriceBar]:
    if not bars or range_value in {"max", "all"}:
        return bars

    latest_timestamp = bars[-1].timestamp
    start_timestamp = range_start(latest_timestamp, range_value)
    return [bar for bar in bars if bar.timestamp >= start_timestamp]


def range_start(latest_timestamp: datetime, range_value: str) -> datetime:
    if range_value == "ytd":
        return latest_timestamp.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    units = {
        "d": 1,
        "w": 7,
        "mo": 31,
        "m": 31,
        "y": 365,
    }
    for suffix, days in units.items():
        if range_value.endswith(suffix):
            amount_text = range_value[: -len(suffix)]
            if amount_text.isdigit():
                return latest_timestamp - timedelta(days=int(amount_text) * days)

    raise ValueError(
        "range must be one of all, max, ytd, or a value like 5d, 1mo, 6mo, 1y."
    )


def to_price_bar_read(bar: PriceBar) -> PriceBarRead:
    return PriceBarRead(
        timestamp=bar.timestamp,
        open=bar.open,
        high=bar.high,
        low=bar.low,
        close=bar.close,
        adj_close=bar.adj_close,
        volume=bar.volume,
    )
