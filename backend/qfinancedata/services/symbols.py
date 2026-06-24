from __future__ import annotations

from qfinancedata.schemas.symbols import SymbolCreate, SymbolRead, SymbolUpdate, normalize_symbol_value
from qfinancedata.services.metadata import MetadataService
from qfinancedata.storage.repositories import SymbolRepository


class SymbolAlreadyExistsError(Exception):
    pass


class SymbolNotFoundError(Exception):
    pass


class SymbolService:
    def __init__(
        self,
        repository: SymbolRepository,
        metadata_service: MetadataService | None = None,
    ) -> None:
        self.repository = repository
        self.metadata_service = metadata_service

    def list_symbols(
        self,
        *,
        include_disabled: bool = False,
        group_name: str | None = None,
    ) -> list[SymbolRead]:
        return [
            SymbolRead(**record)
            for record in self.repository.list_symbols(
                include_disabled=include_disabled,
                group_name=group_name.strip() if group_name else None,
            )
        ]

    def add_symbol(self, payload: SymbolCreate) -> tuple[SymbolRead, bool]:
        existing = self.repository.get_symbol(payload.symbol, include_disabled=True)
        if existing and existing["enabled"]:
            raise SymbolAlreadyExistsError(
                f"Symbol {payload.symbol} already exists in the watchlist."
            )

        fields = payload.model_dump()
        if existing:
            record = self.repository.update_symbol(
                payload.symbol,
                {**fields, "enabled": True},
            )
            if record is None:
                raise SymbolNotFoundError(f"Symbol {payload.symbol} was not found.")
            record = self._refresh_metadata(payload.symbol, payload.model_fields_set) or record
            return SymbolRead(**record), False

        try:
            record = self.repository.create_symbol(fields)
        except ValueError as exc:
            raise SymbolAlreadyExistsError(
                f"Symbol {payload.symbol} already exists in the watchlist."
            ) from exc
        record = self._refresh_metadata(payload.symbol, payload.model_fields_set) or record
        return SymbolRead(**record), True

    def update_symbol(self, symbol: str, payload: SymbolUpdate) -> SymbolRead:
        normalized_symbol = normalize_symbol_value(symbol)
        fields = payload.model_dump(exclude_unset=True)
        record = self.repository.update_symbol(normalized_symbol, fields)
        if record is None:
            raise SymbolNotFoundError(f"Symbol {normalized_symbol} was not found.")
        return SymbolRead(**record)

    def remove_from_watchlist(self, symbol: str) -> None:
        normalized_symbol = normalize_symbol_value(symbol)
        record = self.repository.update_symbol(normalized_symbol, {"enabled": False})
        if record is None:
            raise SymbolNotFoundError(f"Symbol {normalized_symbol} was not found.")

    def _refresh_metadata(
        self,
        symbol: str,
        protected_fields: set[str],
    ) -> dict[str, object] | None:
        if self.metadata_service is None:
            return None
        return self.metadata_service.refresh_symbol_metadata(
            symbol,
            protected_fields=protected_fields,
        )
