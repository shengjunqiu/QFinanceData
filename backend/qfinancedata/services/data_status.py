from __future__ import annotations

from qfinancedata.schemas.data_status import (
    DataStatusRead,
    DataTypeValue,
)
from qfinancedata.storage.repositories import DataStatusRepository

DATA_TYPES: tuple[DataTypeValue, ...] = (
    "prices",
    "metadata",
    "fundamentals",
    "actions",
)


class DataStatusService:
    def __init__(self, repository: DataStatusRepository) -> None:
        self.repository = repository

    def list_status(
        self,
        *,
        symbol: str | None = None,
        data_type: DataTypeValue | None = None,
    ) -> list[DataStatusRead]:
        normalized_symbol = symbol.strip().upper() if symbol else None

        if normalized_symbol and data_type:
            record = self.repository.get_status(normalized_symbol, data_type)
            return [
                DataStatusRead(
                    **(
                        record
                        or self.repository.missing_status(normalized_symbol, data_type)
                    )
                )
            ]

        if normalized_symbol:
            records = {
                record["data_type"]: record
                for record in self.repository.list_status(symbol=normalized_symbol)
            }
            return [
                DataStatusRead(
                    **records.get(
                        current_data_type,
                        self.repository.missing_status(
                            normalized_symbol,
                            current_data_type,
                        ),
                    )
                )
                for current_data_type in DATA_TYPES
            ]

        return [
            DataStatusRead(**record)
            for record in self.repository.list_status(data_type=data_type)
        ]
