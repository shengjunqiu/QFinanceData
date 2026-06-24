from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from qfinancedata.fetchers.actions import normalize_corporate_actions


def test_normalize_corporate_actions_extracts_dividends_and_splits() -> None:
    fetched_at = datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc)
    raw = {
        "dividends": pd.Series(
            [0.24, 0.0],
            index=pd.to_datetime(["2024-01-10", "2024-04-10"]),
        ),
        "splits": pd.Series(
            [4.0],
            index=pd.to_datetime(["2020-08-31"]),
        ),
    }

    normalized = normalize_corporate_actions(" aapl ", raw, fetched_at=fetched_at)

    assert normalized.symbol == "AAPL"
    assert [(action.action_type, action.ex_date.isoformat(), action.value) for action in normalized.actions] == [
        ("split", "2020-08-31", 4.0),
        ("dividend", "2024-01-10", 0.24),
    ]
    assert {action.fetched_at for action in normalized.actions} == {fetched_at}


def test_normalize_corporate_actions_returns_empty_list_for_missing_payload() -> None:
    fetched_at = datetime(2024, 1, 15, tzinfo=timezone.utc)

    normalized = normalize_corporate_actions("MSFT", {}, fetched_at=fetched_at)

    assert normalized.actions == []
