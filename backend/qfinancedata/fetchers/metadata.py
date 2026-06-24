from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from qfinancedata.fetchers.yf_client import YFinanceClient, normalize_symbols

ASSET_TYPE_MAP = {
    "EQUITY": "equity",
    "ETF": "etf",
    "INDEX": "index",
}


@dataclass(frozen=True)
class SymbolMetadata:
    symbol: str
    name: str | None
    exchange: str | None
    asset_type: str | None
    currency: str | None
    raw: dict[str, Any]


class MetadataFetcher:
    def __init__(
        self,
        yf_client: YFinanceClient,
        *,
        raw_dir: Path | None = None,
    ) -> None:
        self.yf_client = yf_client
        self.raw_dir = raw_dir

    def fetch_symbol_metadata(self, symbol: str) -> SymbolMetadata:
        normalized_symbol = normalize_symbols([symbol])[0]
        raw = self.yf_client.fetch_metadata(normalized_symbol)
        if self.raw_dir is not None:
            save_raw_metadata(self.raw_dir, normalized_symbol, raw)
        return normalize_metadata(normalized_symbol, raw)


def normalize_metadata(symbol: str, raw: dict[str, Any]) -> SymbolMetadata:
    return SymbolMetadata(
        symbol=normalize_symbols([symbol])[0],
        name=first_text(raw, "longName", "shortName", "displayName"),
        exchange=first_text(raw, "exchange", "fullExchangeName"),
        asset_type=normalize_asset_type(first_text(raw, "quoteType", "typeDisp")),
        currency=first_text(raw, "currency", "financialCurrency"),
        raw=raw,
    )


def save_raw_metadata(raw_dir: Path, symbol: str, raw: dict[str, Any]) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / f"{symbol.replace('/', '_')}.json"
    path.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2, sort_keys=True, default=str),
        encoding="utf-8",
    )


def first_text(raw: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def normalize_asset_type(value: str | None) -> str | None:
    if value is None:
        return None
    return ASSET_TYPE_MAP.get(value.strip().upper())
