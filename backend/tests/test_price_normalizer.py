from datetime import datetime, timezone

import pandas as pd
import pytest

from qfinancedata.fetchers.prices import (
    DuplicatePriceBarError,
    PriceFrameEmptyError,
    PriceFrameSchemaError,
    normalize_price_frame,
)

FETCHED_AT = datetime(2024, 1, 5, 12, 0, tzinfo=timezone.utc)


def test_normalize_single_ticker_price_frame() -> None:
    frame = pd.DataFrame(
        {
            "Open": [100.0, 101.0],
            "High": [102.0, 103.0],
            "Low": [99.0, 100.5],
            "Close": [101.5, 102.5],
            "Adj Close": [101.0, 102.0],
            "Volume": [1000, 2000],
        },
        index=pd.to_datetime(["2024-01-02", "2024-01-03"]),
    )

    bars = normalize_price_frame(
        frame,
        [" aapl "],
        interval="1d",
        fetched_at=FETCHED_AT,
    )

    assert [bar.symbol for bar in bars] == ["AAPL", "AAPL"]
    assert bars[0].timestamp == datetime(2024, 1, 2, tzinfo=timezone.utc)
    assert bars[0].open == 100.0
    assert bars[0].high == 102.0
    assert bars[0].low == 99.0
    assert bars[0].close == 101.5
    assert bars[0].adj_close == 101.0
    assert bars[0].volume == 1000
    assert bars[0].source == "yfinance"
    assert bars[0].fetched_at == FETCHED_AT


def test_normalize_multi_ticker_frame_with_ticker_first_columns() -> None:
    frame = pd.DataFrame(
        [
            [100, 102, 99, 101, 100.5, 1000, 200, 205, 199, 204, 203.5, 3000],
            [101, 103, 100, 102, 101.5, 1100, 204, 206, 202, 205, 204.5, 3100],
        ],
        index=pd.to_datetime(["2024-01-02", "2024-01-03"]),
        columns=pd.MultiIndex.from_product(
            [["AAPL", "MSFT"], ["Open", "High", "Low", "Close", "Adj Close", "Volume"]]
        ),
    )

    bars = normalize_price_frame(
        frame,
        ["MSFT", "AAPL"],
        interval="1d",
        fetched_at=FETCHED_AT,
    )

    assert [bar.symbol for bar in bars] == ["MSFT", "MSFT", "AAPL", "AAPL"]
    assert bars[0].open == 200.0
    assert bars[0].volume == 3000
    assert bars[2].open == 100.0


def test_normalize_multi_ticker_frame_with_field_first_columns() -> None:
    frame = pd.DataFrame(
        [
            [100, 200, 102, 205, 99, 199, 101, 204, 1000, 3000],
        ],
        index=pd.to_datetime(["2024-01-02"]),
        columns=pd.MultiIndex.from_tuples(
            [
                ("Open", "aapl"),
                ("Open", "MSFT"),
                ("High", "aapl"),
                ("High", "MSFT"),
                ("Low", "aapl"),
                ("Low", "MSFT"),
                ("Close", "aapl"),
                ("Close", "MSFT"),
                ("Volume", "aapl"),
                ("Volume", "MSFT"),
            ]
        ),
    )

    bars = normalize_price_frame(
        frame,
        ["AAPL", "MSFT"],
        interval="1d",
        fetched_at=FETCHED_AT,
    )

    assert [bar.symbol for bar in bars] == ["AAPL", "MSFT"]
    assert bars[0].adj_close == bars[0].close
    assert bars[1].open == 200.0


def test_normalize_price_frame_rejects_missing_required_columns() -> None:
    frame = pd.DataFrame(
        {
            "Open": [100.0],
            "High": [102.0],
            "Close": [101.5],
            "Volume": [1000],
        },
        index=pd.to_datetime(["2024-01-02"]),
    )

    with pytest.raises(PriceFrameSchemaError, match="missing fields: low"):
        normalize_price_frame(frame, ["AAPL"], interval="1d", fetched_at=FETCHED_AT)


def test_normalize_price_frame_rejects_empty_data() -> None:
    frame = pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

    with pytest.raises(PriceFrameEmptyError, match="empty"):
        normalize_price_frame(frame, ["AAPL"], interval="1d", fetched_at=FETCHED_AT)


def test_normalize_price_frame_rejects_duplicate_timestamps() -> None:
    frame = pd.DataFrame(
        {
            "Open": [100.0, 101.0],
            "High": [102.0, 103.0],
            "Low": [99.0, 100.5],
            "Close": [101.5, 102.5],
            "Volume": [1000, 2000],
        },
        index=pd.to_datetime(["2024-01-02", "2024-01-02"]),
    )

    with pytest.raises(DuplicatePriceBarError, match="duplicate timestamps"):
        normalize_price_frame(frame, ["AAPL"], interval="1d", fetched_at=FETCHED_AT)
