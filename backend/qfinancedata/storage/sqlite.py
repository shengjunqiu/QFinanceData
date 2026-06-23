from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

SCHEMA_VERSION = 1

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS symbols (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    exchange TEXT NOT NULL DEFAULT '',
    asset_type TEXT NOT NULL DEFAULT 'equity',
    currency TEXT NOT NULL DEFAULT '',
    group_name TEXT NOT NULL DEFAULT 'Default',
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_symbols_enabled_group
    ON symbols (enabled, group_name);

CREATE TABLE IF NOT EXISTS fetch_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL CHECK (
        job_type IN ('prices', 'fundamentals', 'actions', 'metadata')
    ),
    status TEXT NOT NULL CHECK (
        status IN (
            'queued',
            'running',
            'success',
            'partial_success',
            'failed',
            'cancelled'
        )
    ),
    params_json TEXT NOT NULL DEFAULT '{}',
    progress_total INTEGER NOT NULL DEFAULT 0 CHECK (progress_total >= 0),
    progress_done INTEGER NOT NULL DEFAULT 0 CHECK (progress_done >= 0),
    error_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    started_at TEXT,
    finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_fetch_jobs_status_created_at
    ON fetch_jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS fetch_job_items (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN (
            'queued',
            'running',
            'success',
            'failed',
            'skipped'
        )
    ),
    error_type TEXT,
    error_message TEXT,
    started_at TEXT,
    finished_at TEXT,
    FOREIGN KEY (job_id) REFERENCES fetch_jobs (id) ON DELETE CASCADE,
    UNIQUE (job_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_fetch_job_items_job_status
    ON fetch_job_items (job_id, status);

CREATE INDEX IF NOT EXISTS idx_fetch_job_items_symbol
    ON fetch_job_items (symbol);

CREATE TABLE IF NOT EXISTS data_status (
    symbol TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (
        data_type IN ('prices', 'metadata', 'fundamentals', 'actions')
    ),
    status TEXT NOT NULL CHECK (
        status IN ('fresh', 'stale', 'missing', 'failed', 'partial')
    ),
    last_data_at TEXT,
    last_fetch_at TEXT,
    last_success_at TEXT,
    last_error TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (symbol, data_type),
    FOREIGN KEY (symbol) REFERENCES symbols (symbol) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_data_status_status
    ON data_status (status, data_type);
"""

EXPECTED_TABLES = frozenset(
    {
        "symbols",
        "fetch_jobs",
        "fetch_job_items",
        "data_status",
    }
)


def initialize_database(sqlite_path: Path) -> None:
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite_connection(sqlite_path) as connection:
        connection.executescript(SCHEMA_SQL)
        connection.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        connection.commit()


@contextmanager
def sqlite_connection(sqlite_path: Path) -> Iterator[sqlite3.Connection]:
    connection = connect(sqlite_path)
    try:
        yield connection
    finally:
        connection.close()


def connect(sqlite_path: Path) -> sqlite3.Connection:
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(sqlite_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def list_table_names(connection: sqlite3.Connection) -> set[str]:
    rows = connection.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    ).fetchall()
    return {row["name"] for row in rows}
