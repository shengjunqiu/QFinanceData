from __future__ import annotations

from datetime import datetime, timedelta, timezone

from qfinancedata.schemas.data_status import DataStatusValue


def evaluate_data_status(
    *,
    last_data_at: datetime | None,
    reference_at: datetime | None = None,
    stale_trading_days: int,
    had_error: bool = False,
    partial: bool = False,
) -> DataStatusValue:
    if partial:
        return "partial"
    if had_error:
        return "failed"
    if last_data_at is None:
        return "missing"

    reference = ensure_utc(reference_at or datetime.now(timezone.utc))
    latest_data_at = ensure_utc(last_data_at)
    if trading_days_between(latest_data_at, reference) > stale_trading_days:
        return "stale"
    return "fresh"


def trading_days_between(start: datetime, end: datetime) -> int:
    start_date = ensure_utc(start).date()
    end_date = ensure_utc(end).date()
    if end_date <= start_date:
        return 0

    days = 0
    cursor = start_date + timedelta(days=1)
    while cursor <= end_date:
        if cursor.weekday() < 5:
            days += 1
        cursor += timedelta(days=1)
    return days


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
