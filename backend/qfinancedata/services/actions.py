from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timezone

from qfinancedata.fetchers.actions import CorporateActionFetcher
from qfinancedata.fetchers.yf_client import normalize_symbols
from qfinancedata.schemas.actions import CorporateAction, CorporateActionRead
from qfinancedata.storage.parquet import CorporateActionRepository


@dataclass(frozen=True)
class CorporateActionFetchResult:
    symbol: str
    actions_written: int
    last_data_at: datetime | None
    fetched_at: datetime


class CorporateActionFetchService:
    def __init__(
        self,
        fetcher: CorporateActionFetcher,
        repository: CorporateActionRepository,
    ) -> None:
        self.fetcher = fetcher
        self.repository = repository

    def fetch_symbol_actions(self, symbol: str) -> CorporateActionFetchResult:
        normalized = self.fetcher.fetch_symbol_actions(symbol)
        actions_written = self.repository.write_actions(normalized.actions)
        return CorporateActionFetchResult(
            symbol=normalized.symbol,
            actions_written=actions_written,
            last_data_at=latest_action_date(normalized.actions),
            fetched_at=normalized.fetched_at,
        )


class CorporateActionQueryService:
    def __init__(self, repository: CorporateActionRepository) -> None:
        self.repository = repository

    def list_actions(self, symbol: str) -> list[CorporateActionRead]:
        normalized_symbol = normalize_symbols([symbol])[0]
        actions = self.repository.read_actions(normalized_symbol)
        return [
            CorporateActionRead(
                symbol=action.symbol,
                action_type=action.action_type,
                ex_date=action.ex_date,
                value=action.value,
            )
            for action in actions
        ]


def latest_action_date(actions: list[CorporateAction]) -> datetime | None:
    if not actions:
        return None
    latest_date = max(action.ex_date for action in actions)
    return datetime.combine(latest_date, time.min, tzinfo=timezone.utc)
