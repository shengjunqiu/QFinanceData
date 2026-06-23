from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from qfinancedata.storage.sqlite import sqlite_connection

SYMBOL_COLUMNS = (
    "symbol",
    "name",
    "exchange",
    "asset_type",
    "currency",
    "group_name",
    "enabled",
)

SYMBOL_UPDATE_COLUMNS = frozenset(
    {
        "name",
        "exchange",
        "asset_type",
        "currency",
        "group_name",
        "enabled",
    }
)


class SymbolRepository:
    def __init__(self, sqlite_path: Path) -> None:
        self.sqlite_path = sqlite_path

    def list_symbols(
        self,
        *,
        include_disabled: bool = False,
        group_name: str | None = None,
    ) -> list[dict[str, Any]]:
        where_clauses: list[str] = []
        params: list[Any] = []

        if not include_disabled:
            where_clauses.append("s.enabled = 1")
        if group_name:
            where_clauses.append("s.group_name = ?")
            params.append(group_name)

        query = _symbol_select_sql()
        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)
        query += " ORDER BY s.group_name ASC, s.symbol ASC"

        with sqlite_connection(self.sqlite_path) as connection:
            rows = connection.execute(query, params).fetchall()
        return [_symbol_from_row(row) for row in rows]

    def get_symbol(
        self,
        symbol: str,
        *,
        include_disabled: bool = False,
    ) -> dict[str, Any] | None:
        query = _symbol_select_sql() + " WHERE s.symbol = ?"
        params: list[Any] = [symbol]

        if not include_disabled:
            query += " AND s.enabled = 1"

        with sqlite_connection(self.sqlite_path) as connection:
            row = connection.execute(query, params).fetchone()

        return _symbol_from_row(row) if row else None

    def create_symbol(self, fields: dict[str, Any]) -> dict[str, Any]:
        insert_fields = {key: fields[key] for key in SYMBOL_COLUMNS if key in fields}
        columns = ", ".join(insert_fields)
        placeholders = ", ".join("?" for _ in insert_fields)

        try:
            with sqlite_connection(self.sqlite_path) as connection:
                connection.execute(
                    f"INSERT INTO symbols ({columns}) VALUES ({placeholders})",
                    list(insert_fields.values()),
                )
                connection.commit()
        except sqlite3.IntegrityError as exc:
            raise ValueError(f"Symbol {fields['symbol']} already exists.") from exc

        record = self.get_symbol(fields["symbol"], include_disabled=True)
        if record is None:
            raise RuntimeError(f"Created symbol {fields['symbol']} could not be read.")
        return record

    def update_symbol(
        self,
        symbol: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        if not fields:
            return self.get_symbol(symbol, include_disabled=True)

        update_fields = {
            key: value
            for key, value in fields.items()
            if key in SYMBOL_UPDATE_COLUMNS
        }
        if not update_fields:
            return self.get_symbol(symbol, include_disabled=True)

        assignments = [f"{key} = ?" for key in update_fields]
        assignments.append("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
        params = list(update_fields.values())
        params.append(symbol)

        with sqlite_connection(self.sqlite_path) as connection:
            cursor = connection.execute(
                f"""
                UPDATE symbols
                SET {", ".join(assignments)}
                WHERE symbol = ?
                """,
                params,
            )
            connection.commit()

        if cursor.rowcount == 0:
            return None
        return self.get_symbol(symbol, include_disabled=True)


def _symbol_select_sql() -> str:
    return """
        SELECT
            s.symbol,
            s.name,
            s.exchange,
            s.asset_type,
            s.currency,
            s.group_name,
            s.enabled,
            s.created_at,
            s.updated_at,
            COALESCE(ds.status, 'missing') AS status,
            ds.last_data_at,
            ds.last_fetch_at
        FROM symbols AS s
        LEFT JOIN data_status AS ds
            ON ds.symbol = s.symbol
           AND ds.data_type = 'prices'
    """


def _symbol_from_row(row: sqlite3.Row) -> dict[str, Any]:
    record = dict(row)
    record["enabled"] = bool(record["enabled"])
    return record
