from datetime import date, datetime, timezone

from qfinancedata.schemas.actions import CorporateAction
from qfinancedata.schemas.fundamentals import FundamentalFact
from qfinancedata.schemas.prices import PriceBar
from qfinancedata.storage.parquet import (
    CorporateActionRepository,
    FundamentalFactRepository,
    PriceBarRepository,
)


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


def fundamental_fact(
    symbol: str,
    field: str,
    value: float,
    *,
    period_end: date = date(2023, 12, 31),
    statement_type: str = "income",
    fetched_at: datetime = datetime(2024, 1, 5, 12, 0, tzinfo=timezone.utc),
) -> FundamentalFact:
    return FundamentalFact(
        symbol=symbol,
        statement_type=statement_type,
        period_type="annual",
        period_end=period_end,
        field=field,
        value=value,
        currency="USD",
        fetched_at=fetched_at,
    )


def corporate_action(
    symbol: str,
    action_type: str,
    ex_date: date,
    value: float,
) -> CorporateAction:
    return CorporateAction(
        symbol=symbol,
        action_type=action_type,
        ex_date=ex_date,
        value=value,
        fetched_at=datetime(2024, 1, 5, 12, 0, tzinfo=timezone.utc),
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


def test_write_and_read_fundamental_facts_by_symbol(tmp_path) -> None:
    repository = FundamentalFactRepository(tmp_path / "parquet")

    written = repository.write_facts(
        [
            fundamental_fact("AAPL", "revenue", 100.0),
            fundamental_fact("AAPL", "net_income", 20.0),
            fundamental_fact("MSFT", "revenue", 200.0),
        ]
    )

    aapl_facts = repository.read_facts("aapl")
    msft_facts = repository.read_facts("MSFT")

    assert written == 3
    assert {fact.field: fact.value for fact in aapl_facts} == {
        "net_income": 20.0,
        "revenue": 100.0,
    }
    assert [fact.symbol for fact in msft_facts] == ["MSFT"]
    assert (
        tmp_path / "parquet/fundamental_facts/symbol=AAPL/part-00000.parquet"
    ).is_file()


def test_write_fundamental_facts_overwrites_duplicate_fields(tmp_path) -> None:
    repository = FundamentalFactRepository(tmp_path / "parquet")
    repository.write_facts([fundamental_fact("AAPL", "revenue", 100.0)])

    repository.write_facts(
        [
            fundamental_fact("AAPL", "revenue", 125.0),
            fundamental_fact("AAPL", "net_income", 25.0),
        ]
    )

    facts = repository.read_facts("AAPL")

    assert {fact.field: fact.value for fact in facts} == {
        "net_income": 25.0,
        "revenue": 125.0,
    }


def test_write_and_read_corporate_actions_by_symbol(tmp_path) -> None:
    repository = CorporateActionRepository(tmp_path / "parquet")

    written = repository.write_actions(
        [
            corporate_action("AAPL", "dividend", date(2024, 1, 10), 0.24),
            corporate_action("AAPL", "split", date(2020, 8, 31), 4.0),
            corporate_action("MSFT", "dividend", date(2024, 2, 15), 0.75),
        ]
    )

    aapl_actions = repository.read_actions("aapl")

    assert written == 3
    assert [action.action_type for action in aapl_actions] == ["dividend", "split"]
    assert [action.value for action in aapl_actions] == [0.24, 4.0]
    assert (
        tmp_path / "parquet/corporate_actions/symbol=AAPL/part-00000.parquet"
    ).is_file()


def test_write_corporate_actions_overwrites_duplicate_events(tmp_path) -> None:
    repository = CorporateActionRepository(tmp_path / "parquet")
    repository.write_actions(
        [corporate_action("AAPL", "dividend", date(2024, 1, 10), 0.22)]
    )

    repository.write_actions(
        [corporate_action("AAPL", "dividend", date(2024, 1, 10), 0.24)]
    )

    actions = repository.read_actions("AAPL")

    assert len(actions) == 1
    assert actions[0].value == 0.24
