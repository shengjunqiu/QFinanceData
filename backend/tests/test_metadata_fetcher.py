from __future__ import annotations

import json

from qfinancedata.fetchers.metadata import MetadataFetcher, normalize_metadata


class FakeYFinanceClient:
    def __init__(self, raw):
        self.raw = raw
        self.calls = []

    def fetch_metadata(self, symbol: str):
        self.calls.append(symbol)
        return self.raw


def test_normalize_metadata_maps_known_yfinance_fields() -> None:
    metadata = normalize_metadata(
        "spy",
        {
            "longName": "SPDR S&P 500 ETF Trust",
            "exchange": "PCX",
            "quoteType": "ETF",
            "currency": "USD",
        },
    )

    assert metadata.symbol == "SPY"
    assert metadata.name == "SPDR S&P 500 ETF Trust"
    assert metadata.exchange == "PCX"
    assert metadata.asset_type == "etf"
    assert metadata.currency == "USD"


def test_normalize_metadata_allows_missing_fields() -> None:
    metadata = normalize_metadata("AAPL", {"quoteType": "UNKNOWN"})

    assert metadata.name is None
    assert metadata.exchange is None
    assert metadata.asset_type is None
    assert metadata.currency is None


def test_metadata_fetcher_saves_raw_response(tmp_path) -> None:
    raw = {
        "longName": "Apple Inc.",
        "exchange": "NMS",
        "quoteType": "EQUITY",
        "currency": "USD",
    }
    fake_client = FakeYFinanceClient(raw)
    fetcher = MetadataFetcher(fake_client, raw_dir=tmp_path / "raw" / "metadata")

    metadata = fetcher.fetch_symbol_metadata("aapl")

    assert metadata.name == "Apple Inc."
    assert fake_client.calls == ["AAPL"]
    raw_file = tmp_path / "raw" / "metadata" / "AAPL.json"
    assert json.loads(raw_file.read_text(encoding="utf-8")) == raw
