from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pandas as pd

from qfinancedata.schemas.prices import PriceBar

PRICE_BAR_COLUMNS = [
    "symbol",
    "interval",
    "timestamp",
    "open",
    "high",
    "low",
    "close",
    "adj_close",
    "volume",
    "source",
    "fetched_at",
]


class PriceBarRepository:
    def __init__(self, parquet_root: Path) -> None:
        self.parquet_root = parquet_root
        self.price_bars_root = parquet_root / "price_bars"

    def write_price_bars(self, bars: Sequence[PriceBar]) -> int:
        grouped = group_price_bars(bars)
        written_count = 0

        for (symbol, interval), group in grouped.items():
            existing_frame = self._read_partition_frame(symbol, interval)
            incoming_frame = price_bars_to_frame(group)
            merged_frame = merge_price_frames(existing_frame, incoming_frame)
            partition_path = self._partition_file(symbol, interval)
            partition_path.parent.mkdir(parents=True, exist_ok=True)
            merged_frame.to_parquet(partition_path, index=False, engine="pyarrow")
            written_count += len(group)

        return written_count

    def read_price_bars(
        self,
        symbol: str,
        interval: str,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[PriceBar]:
        frame = self._read_partition_frame(symbol.strip().upper(), interval.strip())
        if frame.empty:
            return []

        frame = normalize_frame_types(frame)
        if start is not None:
            frame = frame[frame["timestamp"] >= to_utc_scalar(start)]
        if end is not None:
            frame = frame[frame["timestamp"] <= to_utc_scalar(end)]

        frame = frame.sort_values("timestamp", kind="stable")
        return [PriceBar(**row) for row in frame.to_dict(orient="records")]

    def _read_partition_frame(self, symbol: str, interval: str) -> pd.DataFrame:
        partition_path = self._partition_file(symbol, interval)
        if not partition_path.exists():
            return empty_price_bar_frame()

        frame = pd.read_parquet(partition_path, engine="pyarrow")
        return normalize_frame_types(frame)

    def _partition_file(self, symbol: str, interval: str) -> Path:
        normalized_symbol = symbol.strip().upper()
        normalized_interval = interval.strip()
        return (
            self.price_bars_root
            / f"interval={quote(normalized_interval, safe='')}"
            / f"symbol={quote(normalized_symbol, safe='.-_^=')}"
            / "part-00000.parquet"
        )


def group_price_bars(
    bars: Sequence[PriceBar],
) -> dict[tuple[str, str], list[PriceBar]]:
    grouped: dict[tuple[str, str], list[PriceBar]] = {}
    for bar in bars:
        grouped.setdefault((bar.symbol, bar.interval), []).append(bar)
    return grouped


def price_bars_to_frame(bars: Iterable[PriceBar]) -> pd.DataFrame:
    rows = [bar.model_dump(mode="python") for bar in bars]
    if not rows:
        return empty_price_bar_frame()
    return normalize_frame_types(pd.DataFrame(rows, columns=PRICE_BAR_COLUMNS))


def empty_price_bar_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=PRICE_BAR_COLUMNS)


def merge_price_frames(existing_frame: pd.DataFrame, incoming_frame: pd.DataFrame) -> pd.DataFrame:
    if incoming_frame.empty:
        return normalize_frame_types(existing_frame)

    merged_frame = pd.concat([existing_frame, incoming_frame], ignore_index=True)
    merged_frame = normalize_frame_types(merged_frame)
    merged_frame = merged_frame.drop_duplicates(
        subset=["symbol", "interval", "timestamp"],
        keep="last",
    )
    return merged_frame.sort_values("timestamp", kind="stable").reset_index(drop=True)


def normalize_frame_types(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return empty_price_bar_frame()

    normalized = frame.copy()
    normalized = normalized.reindex(columns=PRICE_BAR_COLUMNS)
    normalized["symbol"] = normalized["symbol"].astype(str).str.strip().str.upper()
    normalized["interval"] = normalized["interval"].astype(str).str.strip()
    normalized["source"] = normalized["source"].astype(str).str.strip()
    normalized["timestamp"] = to_utc_timestamp(normalized["timestamp"])
    normalized["fetched_at"] = to_utc_timestamp(normalized["fetched_at"])
    normalized["volume"] = normalized["volume"].astype("int64")
    for column in ("open", "high", "low", "close", "adj_close"):
        normalized[column] = normalized[column].astype("float64")
    return normalized


def to_utc_timestamp(values: Any) -> pd.Series:
    return pd.to_datetime(values, utc=True)


def to_utc_scalar(value: datetime) -> pd.Timestamp:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        return timestamp.tz_localize("UTC")
    return timestamp.tz_convert("UTC")
