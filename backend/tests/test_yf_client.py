from datetime import date

import pytest

from qfinancedata.fetchers.yf_client import (
    YFinanceClient,
    YFinanceEmptyResponseError,
    YFinanceRequestError,
    YFinanceSchemaError,
    YFinanceTimeoutError,
    YFinanceValidationError,
)


class FakeFrame:
    def __init__(self, *, columns, empty: bool = False) -> None:
        self.columns = columns
        self.empty = empty


class FakeYFinance:
    def __init__(self, responses) -> None:
        self.responses = list(responses)
        self.calls = []

    def download(self, tickers, **kwargs):
        self.calls.append({"tickers": tickers, **kwargs})
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response


def valid_frame() -> FakeFrame:
    return FakeFrame(
        columns=[
            ("AAPL", "Open"),
            ("AAPL", "High"),
            ("AAPL", "Low"),
            ("AAPL", "Close"),
            ("AAPL", "Adj Close"),
            ("AAPL", "Volume"),
        ]
    )


def test_download_prices_calls_yfinance_with_normalized_batch_options() -> None:
    frame = valid_frame()
    fake_yfinance = FakeYFinance([frame])
    client = YFinanceClient(
        timeout=12.5,
        max_retries=0,
        yfinance_module=fake_yfinance,
    )

    result = client.download_prices(
        [" aapl ", "MSFT", "aapl"],
        start=date(2020, 1, 2),
        end="2020-02-03",
        interval="1d",
    )

    assert result is frame
    assert fake_yfinance.calls == [
        {
            "tickers": ["AAPL", "MSFT"],
            "start": "2020-01-02",
            "end": "2020-02-03",
            "interval": "1d",
            "group_by": "ticker",
            "auto_adjust": False,
            "actions": False,
            "threads": True,
            "progress": False,
            "timeout": 12.5,
        }
    ]


def test_download_prices_retries_timeout_and_returns_success() -> None:
    frame = valid_frame()
    fake_yfinance = FakeYFinance([TimeoutError("timed out"), frame])
    client = YFinanceClient(
        max_retries=1,
        retry_backoff_seconds=0,
        yfinance_module=fake_yfinance,
    )

    result = client.download_prices(["AAPL"])

    assert result is frame
    assert len(fake_yfinance.calls) == 2


def test_download_prices_maps_repeated_timeouts() -> None:
    fake_yfinance = FakeYFinance(
        [
            TimeoutError("timed out"),
            TimeoutError("timed out again"),
        ]
    )
    client = YFinanceClient(max_retries=1, yfinance_module=fake_yfinance)

    with pytest.raises(YFinanceTimeoutError, match="Timed out"):
        client.download_prices(["AAPL"])

    assert len(fake_yfinance.calls) == 2


def test_download_prices_maps_request_errors_without_retry() -> None:
    fake_yfinance = FakeYFinance([RuntimeError("service changed")])
    client = YFinanceClient(max_retries=3, yfinance_module=fake_yfinance)

    with pytest.raises(YFinanceRequestError, match="service changed"):
        client.download_prices(["AAPL"])

    assert len(fake_yfinance.calls) == 1


def test_download_prices_maps_empty_response() -> None:
    fake_yfinance = FakeYFinance(
        [FakeFrame(columns=["Open", "High", "Low", "Close", "Volume"], empty=True)]
    )
    client = YFinanceClient(yfinance_module=fake_yfinance)

    with pytest.raises(YFinanceEmptyResponseError, match="no price rows"):
        client.download_prices(["AAPL"])


def test_download_prices_maps_missing_columns_to_schema_error() -> None:
    fake_yfinance = FakeYFinance([FakeFrame(columns=["Open", "High", "Close"])])
    client = YFinanceClient(yfinance_module=fake_yfinance)

    with pytest.raises(YFinanceSchemaError, match="missing fields"):
        client.download_prices(["AAPL"])


def test_download_prices_rejects_empty_symbols() -> None:
    client = YFinanceClient(yfinance_module=FakeYFinance([valid_frame()]))

    with pytest.raises(YFinanceValidationError, match="At least one symbol"):
        client.download_prices([" ", ""])
