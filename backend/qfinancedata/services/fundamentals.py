from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone

from qfinancedata.fetchers.fundamentals import FundamentalFetcher
from qfinancedata.fetchers.yf_client import normalize_symbols
from qfinancedata.schemas.fundamentals import (
    FinancialSummary,
    FundamentalFact,
    FundamentalMetrics,
    FundamentalSnapshotRead,
)
from qfinancedata.storage.parquet import FundamentalFactRepository
from qfinancedata.storage.repositories import DataStatusRepository


METRIC_FIELDS = (
    "market_cap",
    "trailing_pe",
    "price_to_book",
    "dividend_yield",
    "fifty_two_week_high",
    "fifty_two_week_low",
)


@dataclass(frozen=True)
class FundamentalFetchResult:
    symbol: str
    facts_written: int
    last_data_at: datetime | None
    fetched_at: datetime


class FundamentalFetchService:
    def __init__(
        self,
        fetcher: FundamentalFetcher,
        repository: FundamentalFactRepository,
    ) -> None:
        self.fetcher = fetcher
        self.repository = repository

    def fetch_symbol_fundamentals(self, symbol: str) -> FundamentalFetchResult:
        normalized = self.fetcher.fetch_symbol_fundamentals(symbol)
        facts_written = self.repository.write_facts(normalized.facts)
        return FundamentalFetchResult(
            symbol=normalized.symbol,
            facts_written=facts_written,
            last_data_at=latest_period_end(normalized.facts),
            fetched_at=normalized.fetched_at,
        )


class FundamentalQueryService:
    def __init__(
        self,
        repository: FundamentalFactRepository,
        data_status_repository: DataStatusRepository,
    ) -> None:
        self.repository = repository
        self.data_status_repository = data_status_repository

    def get_snapshot(self, symbol: str) -> FundamentalSnapshotRead:
        normalized_symbol = normalize_symbols([symbol])[0]
        facts = self.repository.read_facts(normalized_symbol)
        latest_facts = latest_fact_by_field(facts)
        status_record = self.data_status_repository.get_status(
            normalized_symbol,
            "fundamentals",
        )

        metrics = FundamentalMetrics(
            market_cap=value_for(latest_facts, "market_cap"),
            trailing_pe=value_for(latest_facts, "trailing_pe"),
            price_to_book=value_for(latest_facts, "price_to_book"),
            dividend_yield=value_for(latest_facts, "dividend_yield"),
            fifty_two_week_high=value_for(latest_facts, "fifty_two_week_high"),
            fifty_two_week_low=value_for(latest_facts, "fifty_two_week_low"),
        )
        financial_summary = FinancialSummary(
            revenue=value_for(latest_facts, "revenue"),
            net_income=value_for(latest_facts, "net_income"),
            free_cash_flow=free_cash_flow(latest_facts),
            debt_ratio=debt_ratio(latest_facts),
        )

        return FundamentalSnapshotRead(
            symbol=normalized_symbol,
            currency=read_currency(facts),
            metrics=metrics,
            financial_summary=financial_summary,
            missing_fields=missing_fields(metrics, financial_summary),
            last_fetch_at=latest_fetch_at(facts) or read_datetime(
                status_record,
                "last_fetch_at",
            ),
            status=(
                status_record["status"]
                if status_record is not None
                else ("fresh" if facts else "missing")
            ),
        )


def latest_fact_by_field(facts: list[FundamentalFact]) -> dict[str, FundamentalFact]:
    latest: dict[str, FundamentalFact] = {}

    for fact in facts:
        current = latest.get(fact.field)
        if current is None or fact_sort_key(fact) > fact_sort_key(current):
            latest[fact.field] = fact

    return latest


def fact_sort_key(fact: FundamentalFact) -> tuple[date, datetime]:
    fetched_at = ensure_utc(fact.fetched_at)
    return fact.period_end, fetched_at


def value_for(
    facts_by_field: dict[str, FundamentalFact],
    field: str,
) -> float | None:
    fact = facts_by_field.get(field)
    return fact.value if fact is not None else None


def free_cash_flow(facts_by_field: dict[str, FundamentalFact]) -> float | None:
    direct_value = value_for(facts_by_field, "free_cash_flow")
    if direct_value is not None:
        return direct_value

    operating_cash_flow = value_for(facts_by_field, "operating_cash_flow")
    capital_expenditure = value_for(facts_by_field, "capital_expenditure")
    if operating_cash_flow is None or capital_expenditure is None:
        return None

    if capital_expenditure < 0:
        return operating_cash_flow + capital_expenditure
    return operating_cash_flow - capital_expenditure


def debt_ratio(facts_by_field: dict[str, FundamentalFact]) -> float | None:
    total_assets = value_for(facts_by_field, "total_assets")
    total_debt = value_for(facts_by_field, "total_debt")
    if total_assets is None or total_debt is None or total_assets == 0:
        return None
    return total_debt / total_assets


def missing_fields(
    metrics: FundamentalMetrics,
    financial_summary: FinancialSummary,
) -> list[str]:
    fields = {
        **metrics.model_dump(),
        **financial_summary.model_dump(),
    }
    return [field for field, value in fields.items() if value is None]


def read_currency(facts: list[FundamentalFact]) -> str:
    for fact in sorted(facts, key=fact_sort_key, reverse=True):
        if fact.currency:
            return fact.currency
    return ""


def latest_fetch_at(facts: list[FundamentalFact]) -> datetime | None:
    if not facts:
        return None
    return max(ensure_utc(fact.fetched_at) for fact in facts)


def latest_period_end(facts: list[FundamentalFact]) -> datetime | None:
    if not facts:
        return None
    latest_date = max(fact.period_end for fact in facts)
    return datetime.combine(latest_date, time.min, tzinfo=timezone.utc)


def read_datetime(record: dict[str, object] | None, key: str) -> datetime | None:
    if record is None:
        return None

    value = record.get(key)
    if isinstance(value, datetime):
        return ensure_utc(value)
    if isinstance(value, str) and value:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return None


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
