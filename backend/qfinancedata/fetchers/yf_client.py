from __future__ import annotations

import time
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any, Protocol

REQUIRED_PRICE_FIELDS = frozenset({"open", "high", "low", "close", "volume"})


class YFinanceError(Exception):
    """Base error for yfinance adapter failures."""


class YFinanceDependencyError(YFinanceError):
    pass


class YFinanceValidationError(YFinanceError):
    pass


class YFinanceTimeoutError(YFinanceError):
    pass


class YFinanceRequestError(YFinanceError):
    pass


class YFinanceEmptyResponseError(YFinanceError):
    pass


class YFinanceSchemaError(YFinanceError):
    pass


class YFinanceDownloadClient(Protocol):
    def download(self, tickers: Sequence[str] | str, **kwargs: Any) -> Any:
        pass

    def Ticker(self, ticker: str) -> Any:
        pass


@dataclass(frozen=True)
class YFinanceClient:
    timeout: float = 20.0
    max_retries: int = 2
    retry_backoff_seconds: float = 0.0
    yfinance_module: YFinanceDownloadClient | None = None

    def download_prices(
        self,
        symbols: Sequence[str],
        *,
        start: date | str | None = None,
        end: date | str | None = None,
        interval: str = "1d",
    ) -> Any:
        normalized_symbols = normalize_symbols(symbols)
        if not interval.strip():
            raise YFinanceValidationError("interval is required.")

        frame = self._download_with_retries(
            normalized_symbols,
            start=start,
            end=end,
            interval=interval.strip(),
        )
        validate_price_frame(frame)
        return frame

    def fetch_metadata(self, symbol: str) -> dict[str, Any]:
        normalized_symbol = normalize_symbols([symbol])[0]
        return self._metadata_with_retries(normalized_symbol)

    def fetch_fundamentals(self, symbol: str) -> dict[str, Any]:
        normalized_symbol = normalize_symbols([symbol])[0]
        return self._fundamentals_with_retries(normalized_symbol)

    def fetch_actions(self, symbol: str) -> dict[str, Any]:
        normalized_symbol = normalize_symbols([symbol])[0]
        return self._actions_with_retries(normalized_symbol)

    def _download_with_retries(
        self,
        symbols: Sequence[str],
        *,
        start: date | str | None,
        end: date | str | None,
        interval: str,
    ) -> Any:
        client = self._get_yfinance_module()
        last_error: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                return client.download(
                    symbols,
                    start=format_date(start),
                    end=format_date(end),
                    interval=interval,
                    group_by="ticker",
                    auto_adjust=False,
                    actions=False,
                    threads=True,
                    progress=False,
                    timeout=self.timeout,
                )
            except Exception as exc:
                last_error = exc
                if not is_timeout_error(exc):
                    raise YFinanceRequestError(str(exc)) from exc
                if attempt >= self.max_retries:
                    break
                if self.retry_backoff_seconds > 0:
                    time.sleep(self.retry_backoff_seconds)

        raise YFinanceTimeoutError("Timed out while downloading prices.") from last_error

    def _metadata_with_retries(self, symbol: str) -> dict[str, Any]:
        client = self._get_yfinance_module()
        last_error: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                ticker_factory = getattr(client, "Ticker")
                ticker = ticker_factory(symbol)
                info = getattr(ticker, "info", None)
                if callable(info):
                    info = info()
                validate_metadata(info)
                return info
            except (YFinanceEmptyResponseError, YFinanceSchemaError):
                raise
            except Exception as exc:
                last_error = exc
                if not is_timeout_error(exc):
                    raise YFinanceRequestError(str(exc)) from exc
                if attempt >= self.max_retries:
                    break
                if self.retry_backoff_seconds > 0:
                    time.sleep(self.retry_backoff_seconds)

        raise YFinanceTimeoutError("Timed out while fetching metadata.") from last_error

    def _fundamentals_with_retries(self, symbol: str) -> dict[str, Any]:
        last_error: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                ticker = self._ticker(symbol)
                payload = {
                    "info": read_ticker_attr(ticker, "info"),
                    "income": read_first_ticker_attr(ticker, "income_stmt", "financials"),
                    "balance_sheet": read_first_ticker_attr(ticker, "balance_sheet", "balancesheet"),
                    "cashflow": read_first_ticker_attr(ticker, "cashflow", "cash_flow"),
                }
                validate_fundamentals(payload)
                return payload
            except (YFinanceEmptyResponseError, YFinanceSchemaError):
                raise
            except Exception as exc:
                last_error = exc
                if not is_timeout_error(exc):
                    raise YFinanceRequestError(str(exc)) from exc
                if attempt >= self.max_retries:
                    break
                if self.retry_backoff_seconds > 0:
                    time.sleep(self.retry_backoff_seconds)

        raise YFinanceTimeoutError("Timed out while fetching fundamentals.") from last_error

    def _actions_with_retries(self, symbol: str) -> dict[str, Any]:
        last_error: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                ticker = self._ticker(symbol)
                return {
                    "dividends": read_ticker_attr(ticker, "dividends"),
                    "splits": read_ticker_attr(ticker, "splits"),
                }
            except Exception as exc:
                last_error = exc
                if not is_timeout_error(exc):
                    raise YFinanceRequestError(str(exc)) from exc
                if attempt >= self.max_retries:
                    break
                if self.retry_backoff_seconds > 0:
                    time.sleep(self.retry_backoff_seconds)

        raise YFinanceTimeoutError("Timed out while fetching corporate actions.") from last_error

    def _ticker(self, symbol: str) -> Any:
        client = self._get_yfinance_module()
        ticker_factory = getattr(client, "Ticker")
        return ticker_factory(symbol)

    def _get_yfinance_module(self) -> YFinanceDownloadClient:
        if self.yfinance_module is not None:
            return self.yfinance_module

        try:
            import yfinance
        except ImportError as exc:
            raise YFinanceDependencyError("yfinance is not installed.") from exc

        return yfinance


def normalize_symbols(symbols: Sequence[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for symbol in symbols:
        normalized_symbol = symbol.strip().upper()
        if not normalized_symbol:
            continue
        if normalized_symbol not in seen:
            normalized.append(normalized_symbol)
            seen.add(normalized_symbol)

    if not normalized:
        raise YFinanceValidationError("At least one symbol is required.")
    return normalized


def format_date(value: date | str | None) -> str | None:
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        return value.strip() or None
    return None


def validate_price_frame(frame: Any) -> None:
    if frame is None or bool(getattr(frame, "empty", False)):
        raise YFinanceEmptyResponseError("yfinance returned no price rows.")

    columns = getattr(frame, "columns", None)
    if columns is None:
        raise YFinanceSchemaError("yfinance response does not expose columns.")

    normalized_fields = extract_price_fields(columns)
    missing_fields = REQUIRED_PRICE_FIELDS - normalized_fields
    if missing_fields:
        missing = ", ".join(sorted(missing_fields))
        raise YFinanceSchemaError(f"yfinance response is missing fields: {missing}.")


def validate_metadata(info: Any) -> None:
    if info is None:
        raise YFinanceEmptyResponseError("yfinance returned no metadata.")
    if not isinstance(info, dict):
        raise YFinanceSchemaError("yfinance metadata response must be a mapping.")
    if not info:
        raise YFinanceEmptyResponseError("yfinance returned no metadata.")


def validate_fundamentals(payload: dict[str, Any]) -> None:
    if not any(has_payload(value) for value in payload.values()):
        raise YFinanceEmptyResponseError("yfinance returned no fundamentals.")


def read_ticker_attr(ticker: Any, name: str) -> Any:
    value = getattr(ticker, name, None)
    if callable(value):
        return value()
    return value


def read_first_ticker_attr(ticker: Any, *names: str) -> Any:
    for name in names:
        value = read_ticker_attr(ticker, name)
        if has_payload(value):
            return value
    return None


def has_payload(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, dict):
        return bool(value)
    empty = getattr(value, "empty", None)
    if empty is not None:
        return not bool(empty)
    return True


def extract_price_fields(columns: Any) -> set[str]:
    fields: set[str] = set()

    for column in columns:
        if isinstance(column, tuple):
            fields.update(normalize_price_field(part) for part in column)
        else:
            fields.add(normalize_price_field(column))

    return {field for field in fields if field}


def normalize_price_field(value: Any) -> str:
    return str(value).strip().lower().replace(" ", "_").replace("-", "_")


def is_timeout_error(exc: Exception) -> bool:
    name = type(exc).__name__.lower()
    message = str(exc).lower()
    return isinstance(exc, TimeoutError) or "timeout" in name or "timed out" in message
