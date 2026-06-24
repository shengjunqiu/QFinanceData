from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone
import math
from typing import Any

import pandas as pd

from qfinancedata.fetchers.yf_client import (
    YFinanceValidationError,
    normalize_price_field,
    normalize_symbols,
)
from qfinancedata.schemas.prices import PriceBar

REQUIRED_PRICE_FIELDS = frozenset({"open", "high", "low", "close", "volume"})
OPTIONAL_PRICE_FIELDS = frozenset({"adj_close"})


class PriceNormalizationError(Exception):
    pass


class PriceFrameEmptyError(PriceNormalizationError):
    pass


class PriceFrameSchemaError(PriceNormalizationError):
    pass


class DuplicatePriceBarError(PriceNormalizationError):
    pass


class PriceFrameValueError(PriceNormalizationError):
    pass


def normalize_price_frame(
    frame: pd.DataFrame,
    symbols: Sequence[str],
    *,
    interval: str,
    fetched_at: datetime | None = None,
) -> list[PriceBar]:
    if frame is None or frame.empty:
        raise PriceFrameEmptyError("Price frame is empty.")
    if not interval.strip():
        raise PriceFrameSchemaError("interval is required.")

    try:
        normalized_symbols = normalize_symbols(symbols)
    except YFinanceValidationError as exc:
        raise PriceFrameSchemaError(str(exc)) from exc
    fetched_at = ensure_utc(fetched_at or datetime.now(timezone.utc))
    bars: list[PriceBar] = []

    for symbol in normalized_symbols:
        symbol_frame = extract_symbol_frame(frame, symbol, normalized_symbols)
        bars.extend(
            normalize_symbol_frame(
                symbol_frame,
                symbol=symbol,
                interval=interval.strip(),
                fetched_at=fetched_at,
            )
        )

    if not bars:
        raise PriceFrameEmptyError("Price frame did not contain complete price rows.")
    return bars


def extract_symbol_frame(
    frame: pd.DataFrame,
    symbol: str,
    symbols: Sequence[str],
) -> pd.DataFrame:
    if isinstance(frame.columns, pd.MultiIndex):
        return extract_multi_index_symbol_frame(frame, symbol)

    if len(symbols) != 1:
        raise PriceFrameSchemaError(
            "Single-level price frame can only be normalized for one symbol."
        )
    return frame.copy()


def extract_multi_index_symbol_frame(frame: pd.DataFrame, symbol: str) -> pd.DataFrame:
    columns = frame.columns
    for level in range(columns.nlevels):
        values = {
            str(value).strip().upper(): value
            for value in columns.get_level_values(level)
        }
        if symbol in values:
            return frame.xs(values[symbol], axis=1, level=level, drop_level=True).copy()

    raise PriceFrameSchemaError(f"Price frame does not contain symbol {symbol}.")


def normalize_symbol_frame(
    frame: pd.DataFrame,
    *,
    symbol: str,
    interval: str,
    fetched_at: datetime,
) -> list[PriceBar]:
    field_columns = map_price_columns(frame.columns)
    missing_fields = REQUIRED_PRICE_FIELDS - set(field_columns)
    if missing_fields:
        missing = ", ".join(sorted(missing_fields))
        raise PriceFrameSchemaError(f"{symbol} price frame is missing fields: {missing}.")

    if not frame.index.is_unique:
        raise DuplicatePriceBarError(f"{symbol} price frame contains duplicate timestamps.")

    bars: list[PriceBar] = []
    for timestamp, row in frame.iterrows():
        values = {field: row[column] for field, column in field_columns.items()}
        if missing_required_values(values):
            continue

        open_value = to_float_value(values["open"], "open", symbol, timestamp)
        high_value = to_float_value(values["high"], "high", symbol, timestamp)
        low_value = to_float_value(values["low"], "low", symbol, timestamp)
        close_value = to_float_value(values["close"], "close", symbol, timestamp)
        volume_value = to_volume_value(values["volume"], symbol, timestamp)
        validate_ohlc_values(
            symbol,
            timestamp,
            open_value=open_value,
            high_value=high_value,
            low_value=low_value,
            close_value=close_value,
        )

        adj_close_value = values.get("adj_close")
        if pd.isna(adj_close_value):
            adj_close_value = close_value
        else:
            adj_close_value = to_float_value(
                adj_close_value,
                "adj_close",
                symbol,
                timestamp,
            )

        bars.append(
            PriceBar(
                symbol=symbol,
                interval=interval,
                timestamp=ensure_utc(pd.Timestamp(timestamp).to_pydatetime()),
                open=open_value,
                high=high_value,
                low=low_value,
                close=close_value,
                adj_close=adj_close_value,
                volume=volume_value,
                source="yfinance",
                fetched_at=fetched_at,
            )
        )

    return bars


def map_price_columns(columns: pd.Index) -> dict[str, Any]:
    field_columns: dict[str, Any] = {}
    for column in columns:
        field_name = normalize_price_field(column)
        if field_name in REQUIRED_PRICE_FIELDS or field_name in OPTIONAL_PRICE_FIELDS:
            field_columns.setdefault(field_name, column)
    return field_columns


def missing_required_values(values: dict[str, Any]) -> bool:
    return any(pd.isna(values[field]) for field in REQUIRED_PRICE_FIELDS)


def to_float_value(value: Any, field: str, symbol: str, timestamp: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise PriceFrameValueError(
            f"{symbol} price row {timestamp} has non-numeric {field}."
        ) from exc

    if not math.isfinite(number):
        raise PriceFrameValueError(
            f"{symbol} price row {timestamp} has non-finite {field}."
        )
    if number < 0:
        raise PriceFrameValueError(
            f"{symbol} price row {timestamp} has negative {field}."
        )
    return number


def to_volume_value(value: Any, symbol: str, timestamp: Any) -> int:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise PriceFrameValueError(
            f"{symbol} price row {timestamp} has non-numeric volume."
        ) from exc

    if not math.isfinite(number):
        raise PriceFrameValueError(
            f"{symbol} price row {timestamp} has non-finite volume."
        )
    if number < 0:
        raise PriceFrameValueError(
            f"{symbol} price row {timestamp} has negative volume."
        )
    return int(number)


def validate_ohlc_values(
    symbol: str,
    timestamp: Any,
    *,
    open_value: float,
    high_value: float,
    low_value: float,
    close_value: float,
) -> None:
    if high_value < max(open_value, low_value, close_value):
        raise PriceFrameValueError(
            f"{symbol} price row {timestamp} has high below OHLC values."
        )
    if low_value > min(open_value, high_value, close_value):
        raise PriceFrameValueError(
            f"{symbol} price row {timestamp} has low above OHLC values."
        )


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
