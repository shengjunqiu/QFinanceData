from __future__ import annotations

from datetime import datetime, timezone

from qfinancedata.fetchers.metadata import MetadataFetcher, SymbolMetadata
from qfinancedata.storage.repositories import DataStatusRepository, SymbolRepository

METADATA_FIELDS = frozenset({"name", "exchange", "asset_type", "currency"})


class MetadataService:
    def __init__(
        self,
        symbol_repository: SymbolRepository,
        data_status_repository: DataStatusRepository,
        metadata_fetcher: MetadataFetcher,
    ) -> None:
        self.symbol_repository = symbol_repository
        self.data_status_repository = data_status_repository
        self.metadata_fetcher = metadata_fetcher

    def refresh_symbol_metadata(
        self,
        symbol: str,
        *,
        protected_fields: set[str] | None = None,
    ) -> dict[str, object] | None:
        protected = protected_fields or set()
        fetched_at = utc_now_iso()
        try:
            metadata = self.metadata_fetcher.fetch_symbol_metadata(symbol)
        except Exception as exc:
            self.data_status_repository.upsert_status(
                symbol=symbol,
                data_type="metadata",
                status="failed",
                last_fetch_at=fetched_at,
                last_error=str(exc),
            )
            return None

        current = self.symbol_repository.get_symbol(symbol, include_disabled=True)
        updates = metadata_updates(metadata, current or {}, protected_fields=protected)
        if updates:
            self.symbol_repository.update_symbol(metadata.symbol, updates)

        status = "fresh" if updates or any_metadata_field(metadata) else "missing"
        self.data_status_repository.upsert_status(
            symbol=metadata.symbol,
            data_type="metadata",
            status=status,
            last_fetch_at=fetched_at,
            last_success_at=fetched_at,
            last_error=None,
        )
        return self.symbol_repository.get_symbol(metadata.symbol, include_disabled=True)


def metadata_updates(
    metadata: SymbolMetadata,
    current: dict[str, object],
    *,
    protected_fields: set[str],
) -> dict[str, object]:
    candidates = {
        "name": metadata.name,
        "exchange": metadata.exchange,
        "asset_type": metadata.asset_type,
        "currency": metadata.currency,
    }
    updates: dict[str, object] = {}

    for field, value in candidates.items():
        if field in protected_fields or value is None:
            continue
        if should_update_field(field, current.get(field), value):
            updates[field] = value

    return updates


def should_update_field(field: str, current_value: object, next_value: str) -> bool:
    if not isinstance(current_value, str) or not current_value.strip():
        return True
    if field == "asset_type" and current_value == "equity" and next_value != "equity":
        return True
    return False


def any_metadata_field(metadata: SymbolMetadata) -> bool:
    return any(
        value is not None
        for value in (
            metadata.name,
            metadata.exchange,
            metadata.asset_type,
            metadata.currency,
        )
    )


def utc_now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
