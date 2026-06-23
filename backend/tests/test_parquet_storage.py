from datetime import datetime, timezone

from qfinancedata.schemas.prices import PriceBar
from qfinancedata.storage.parquet import PriceBarRepository


def price_bar(
    symbol: str,
    day: str,
    *,
    close: float,
    interval: str = "1d",
    fetched_at: datetime = datetime(2024, 1, 5, 12, 0, tzinfo=timezone.utc),
) -> PriceBar:
    return PriceBar(
        symbol=symbol,
        interval=interval,
        timestamp=datetime.fromisoformat(day).replace(tzinfo=timezone.utc),
        open=close - 1,
        high=close + 1,
        low=close - 2,
        close=close,
        adj_close=close - 0.5,
        volume=1000,
        source="yfinance",
        fetched_at=fetched_at,
    )


def test_write_and_read_price_bars_by_symbol_and_interval(tmp_path) -> None:
    repository = PriceBarRepository(tmp_path / "parquet")
    bars = [
        price_bar("AAPL", "2024-01-02", close=101.0),
        price_bar("AAPL", "2024-01-03", close=102.0),
        price_bar("MSFT", "2024-01-02", close=201.0),
    ]

    written = repository.write_price_bars(bars)
    aapl_bars = repository.read_price_bars("aapl", "1d")
    msft_bars = repository.read_price_bars("MSFT", "1d")

    assert written == 3
    assert [bar.close for bar in aapl_bars] == [101.0, 102.0]
    assert [bar.symbol for bar in msft_bars] == ["MSFT"]
    assert (
        tmp_path
        / "parquet/price_bars/interval=1d/symbol=AAPL/part-00000.parquet"
    ).is_file()
    assert (
        tmp_path
        / "parquet/price_bars/interval=1d/symbol=MSFT/part-00000.parquet"
    ).is_file()


def test_write_price_bars_overwrites_duplicate_timestamps(tmp_path) -> None:
    repository = PriceBarRepository(tmp_path / "parquet")
    repository.write_price_bars([price_bar("AAPL", "2024-01-02", close=101.0)])

    repository.write_price_bars(
        [
            price_bar("AAPL", "2024-01-02", close=105.0),
            price_bar("AAPL", "2024-01-03", close=106.0),
        ]
    )

    bars = repository.read_price_bars("AAPL", "1d")

    assert [bar.timestamp.date().isoformat() for bar in bars] == [
        "2024-01-02",
        "2024-01-03",
    ]
    assert [bar.close for bar in bars] == [105.0, 106.0]


def test_read_price_bars_supports_time_filters(tmp_path) -> None:
    repository = PriceBarRepository(tmp_path / "parquet")
    repository.write_price_bars(
        [
            price_bar("AAPL", "2024-01-02", close=101.0),
            price_bar("AAPL", "2024-01-03", close=102.0),
            price_bar("AAPL", "2024-01-04", close=103.0),
        ]
    )

    bars = repository.read_price_bars(
        "AAPL",
        "1d",
        start=datetime(2024, 1, 3),
        end=datetime(2024, 1, 4),
    )

    assert [bar.timestamp.date().isoformat() for bar in bars] == [
        "2024-01-03",
        "2024-01-04",
    ]


def test_read_price_bars_returns_empty_list_for_missing_partition(tmp_path) -> None:
    repository = PriceBarRepository(tmp_path / "parquet")

    assert repository.read_price_bars("AAPL", "1d") == []
