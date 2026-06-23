from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
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


class JobRepository:
    def __init__(self, sqlite_path: Path) -> None:
        self.sqlite_path = sqlite_path

    def create_job(
        self,
        job_type: str,
        *,
        params: dict[str, Any],
        symbols: list[str],
    ) -> dict[str, Any]:
        job_id = uuid.uuid4().hex
        with sqlite_connection(self.sqlite_path) as connection:
            connection.execute(
                """
                INSERT INTO fetch_jobs (
                    id,
                    job_type,
                    status,
                    params_json,
                    progress_total,
                    progress_done
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    job_type,
                    "queued",
                    json.dumps(params, sort_keys=True),
                    len(symbols),
                    0,
                ),
            )
            connection.executemany(
                """
                INSERT INTO fetch_job_items (id, job_id, symbol, status)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (uuid.uuid4().hex, job_id, symbol, "queued")
                    for symbol in symbols
                ],
            )
            connection.commit()

        record = self.get_job(job_id)
        if record is None:
            raise RuntimeError(f"Created job {job_id} could not be read.")
        return record

    def list_jobs(self, *, limit: int = 50) -> list[dict[str, Any]]:
        with sqlite_connection(self.sqlite_path) as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM fetch_jobs
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [self._job_with_items(row) for row in rows]

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with sqlite_connection(self.sqlite_path) as connection:
            row = connection.execute(
                "SELECT * FROM fetch_jobs WHERE id = ?",
                (job_id,),
            ).fetchone()

        return self._job_with_items(row) if row else None

    def mark_job_running(self, job_id: str) -> None:
        now = utc_now_iso()
        with sqlite_connection(self.sqlite_path) as connection:
            connection.execute(
                """
                UPDATE fetch_jobs
                SET status = ?, started_at = ?
                WHERE id = ?
                """,
                ("running", now, job_id),
            )
            connection.commit()

    def mark_job_finished(
        self,
        job_id: str,
        *,
        status: str,
        error_summary: str | None = None,
    ) -> None:
        now = utc_now_iso()
        with sqlite_connection(self.sqlite_path) as connection:
            connection.execute(
                """
                UPDATE fetch_jobs
                SET status = ?, error_summary = ?, finished_at = ?
                WHERE id = ?
                """,
                (status, error_summary, now, job_id),
            )
            connection.commit()

    def mark_item_running(self, job_id: str, symbol: str) -> None:
        now = utc_now_iso()
        with sqlite_connection(self.sqlite_path) as connection:
            connection.execute(
                """
                UPDATE fetch_job_items
                SET status = ?, started_at = ?
                WHERE job_id = ? AND symbol = ?
                """,
                ("running", now, job_id, symbol),
            )
            connection.commit()

    def mark_item_finished(
        self,
        job_id: str,
        symbol: str,
        *,
        status: str,
        error_type: str | None = None,
        error_message: str | None = None,
    ) -> None:
        now = utc_now_iso()
        with sqlite_connection(self.sqlite_path) as connection:
            connection.execute(
                """
                UPDATE fetch_job_items
                SET
                    status = ?,
                    error_type = ?,
                    error_message = ?,
                    finished_at = ?
                WHERE job_id = ? AND symbol = ?
                """,
                (status, error_type, error_message, now, job_id, symbol),
            )
            connection.execute(
                """
                UPDATE fetch_jobs
                SET progress_done = (
                    SELECT COUNT(*)
                    FROM fetch_job_items
                    WHERE job_id = ?
                      AND status IN ('success', 'failed', 'skipped')
                )
                WHERE id = ?
                """,
                (job_id, job_id),
            )
            connection.commit()

    def _job_with_items(self, row: sqlite3.Row) -> dict[str, Any]:
        record = dict(row)
        record["params"] = json.loads(record.pop("params_json") or "{}")
        record["items"] = self._list_job_items(record["id"])
        return record

    def _list_job_items(self, job_id: str) -> list[dict[str, Any]]:
        with sqlite_connection(self.sqlite_path) as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM fetch_job_items
                WHERE job_id = ?
                ORDER BY symbol ASC
                """,
                (job_id,),
            ).fetchall()
        return [dict(row) for row in rows]


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


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00",
        "Z",
    )
