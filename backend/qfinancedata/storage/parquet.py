from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pandas as pd

from qfinancedata.schemas.actions import CorporateAction
from qfinancedata.schemas.fundamentals import FundamentalFact
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

FUNDAMENTAL_FACT_COLUMNS = [
    "symbol",
    "statement_type",
    "period_type",
    "period_end",
    "field",
    "value",
    "currency",
    "fetched_at",
]

CORPORATE_ACTION_COLUMNS = [
    "symbol",
    "action_type",
    "ex_date",
    "value",
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


class FundamentalFactRepository:
    def __init__(self, parquet_root: Path) -> None:
        self.parquet_root = parquet_root
        self.fundamental_facts_root = parquet_root / "fundamental_facts"

    def write_facts(self, facts: Sequence[FundamentalFact]) -> int:
        grouped = group_by_symbol(facts)
        written_count = 0

        for symbol, group in grouped.items():
            existing_frame = self._read_partition_frame(symbol)
            incoming_frame = fundamental_facts_to_frame(group)
            merged_frame = merge_fundamental_frames(existing_frame, incoming_frame)
            partition_path = self._partition_file(symbol)
            partition_path.parent.mkdir(parents=True, exist_ok=True)
            merged_frame.to_parquet(partition_path, index=False, engine="pyarrow")
            written_count += len(group)

        return written_count

    def read_facts(self, symbol: str) -> list[FundamentalFact]:
        frame = self._read_partition_frame(symbol.strip().upper())
        if frame.empty:
            return []

        frame = normalize_fundamental_frame(frame)
        frame = frame.sort_values(["period_end", "field"], kind="stable")
        return [FundamentalFact(**row) for row in frame.to_dict(orient="records")]

    def _read_partition_frame(self, symbol: str) -> pd.DataFrame:
        partition_path = self._partition_file(symbol)
        if not partition_path.exists():
            return empty_fundamental_frame()

        frame = pd.read_parquet(partition_path, engine="pyarrow")
        return normalize_fundamental_frame(frame)

    def _partition_file(self, symbol: str) -> Path:
        normalized_symbol = symbol.strip().upper()
        return (
            self.fundamental_facts_root
            / f"symbol={quote(normalized_symbol, safe='.-_^=')}"
            / "part-00000.parquet"
        )


class CorporateActionRepository:
    def __init__(self, parquet_root: Path) -> None:
        self.parquet_root = parquet_root
        self.corporate_actions_root = parquet_root / "corporate_actions"

    def write_actions(self, actions: Sequence[CorporateAction]) -> int:
        grouped = group_by_symbol(actions)
        written_count = 0

        for symbol, group in grouped.items():
            existing_frame = self._read_partition_frame(symbol)
            incoming_frame = corporate_actions_to_frame(group)
            merged_frame = merge_corporate_action_frames(existing_frame, incoming_frame)
            partition_path = self._partition_file(symbol)
            partition_path.parent.mkdir(parents=True, exist_ok=True)
            merged_frame.to_parquet(partition_path, index=False, engine="pyarrow")
            written_count += len(group)

        return written_count

    def read_actions(self, symbol: str) -> list[CorporateAction]:
        frame = self._read_partition_frame(symbol.strip().upper())
        if frame.empty:
            return []

        frame = normalize_corporate_action_frame(frame)
        frame = frame.sort_values("ex_date", ascending=False, kind="stable")
        return [CorporateAction(**row) for row in frame.to_dict(orient="records")]

    def _read_partition_frame(self, symbol: str) -> pd.DataFrame:
        partition_path = self._partition_file(symbol)
        if not partition_path.exists():
            return empty_corporate_action_frame()

        frame = pd.read_parquet(partition_path, engine="pyarrow")
        return normalize_corporate_action_frame(frame)

    def _partition_file(self, symbol: str) -> Path:
        normalized_symbol = symbol.strip().upper()
        return (
            self.corporate_actions_root
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


def fundamental_facts_to_frame(facts: Iterable[FundamentalFact]) -> pd.DataFrame:
    rows = [fact.model_dump(mode="python") for fact in facts]
    if not rows:
        return empty_fundamental_frame()
    return normalize_fundamental_frame(pd.DataFrame(rows, columns=FUNDAMENTAL_FACT_COLUMNS))


def corporate_actions_to_frame(actions: Iterable[CorporateAction]) -> pd.DataFrame:
    rows = [action.model_dump(mode="python") for action in actions]
    if not rows:
        return empty_corporate_action_frame()
    return normalize_corporate_action_frame(pd.DataFrame(rows, columns=CORPORATE_ACTION_COLUMNS))


def empty_price_bar_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=PRICE_BAR_COLUMNS)


def empty_fundamental_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=FUNDAMENTAL_FACT_COLUMNS)


def empty_corporate_action_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=CORPORATE_ACTION_COLUMNS)


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


def merge_fundamental_frames(existing_frame: pd.DataFrame, incoming_frame: pd.DataFrame) -> pd.DataFrame:
    if incoming_frame.empty:
        return normalize_fundamental_frame(existing_frame)

    merged_frame = pd.concat([existing_frame, incoming_frame], ignore_index=True)
    merged_frame = normalize_fundamental_frame(merged_frame)
    merged_frame = merged_frame.drop_duplicates(
        subset=["symbol", "statement_type", "period_type", "period_end", "field"],
        keep="last",
    )
    return merged_frame.sort_values(["period_end", "field"], kind="stable").reset_index(drop=True)


def merge_corporate_action_frames(existing_frame: pd.DataFrame, incoming_frame: pd.DataFrame) -> pd.DataFrame:
    if incoming_frame.empty:
        return normalize_corporate_action_frame(existing_frame)

    merged_frame = pd.concat([existing_frame, incoming_frame], ignore_index=True)
    merged_frame = normalize_corporate_action_frame(merged_frame)
    merged_frame = merged_frame.drop_duplicates(
        subset=["symbol", "action_type", "ex_date"],
        keep="last",
    )
    return merged_frame.sort_values("ex_date", kind="stable").reset_index(drop=True)


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


def normalize_fundamental_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return empty_fundamental_frame()

    normalized = frame.copy()
    normalized = normalized.reindex(columns=FUNDAMENTAL_FACT_COLUMNS)
    normalized["symbol"] = normalized["symbol"].astype(str).str.strip().str.upper()
    normalized["statement_type"] = normalized["statement_type"].astype(str).str.strip()
    normalized["period_type"] = normalized["period_type"].astype(str).str.strip()
    normalized["period_end"] = to_date_series(normalized["period_end"])
    normalized["field"] = normalized["field"].astype(str).str.strip()
    normalized["value"] = normalized["value"].astype("float64")
    normalized["currency"] = normalized["currency"].fillna("").astype(str).str.strip()
    normalized["fetched_at"] = to_utc_timestamp(normalized["fetched_at"])
    return normalized


def normalize_corporate_action_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return empty_corporate_action_frame()

    normalized = frame.copy()
    normalized = normalized.reindex(columns=CORPORATE_ACTION_COLUMNS)
    normalized["symbol"] = normalized["symbol"].astype(str).str.strip().str.upper()
    normalized["action_type"] = normalized["action_type"].astype(str).str.strip()
    normalized["ex_date"] = to_date_series(normalized["ex_date"])
    normalized["value"] = normalized["value"].astype("float64")
    normalized["fetched_at"] = to_utc_timestamp(normalized["fetched_at"])
    return normalized


def to_utc_timestamp(values: Any) -> pd.Series:
    return pd.to_datetime(values, utc=True)


def to_utc_scalar(value: datetime) -> pd.Timestamp:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        return timestamp.tz_localize("UTC")
    return timestamp.tz_convert("UTC")


def to_date_series(values: Any) -> pd.Series:
    return pd.to_datetime(values, utc=True).dt.date


def group_by_symbol(items: Sequence[Any]) -> dict[str, list[Any]]:
    grouped: dict[str, list[Any]] = {}
    for item in items:
        grouped.setdefault(item.symbol, []).append(item)
    return grouped
