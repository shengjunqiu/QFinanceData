import sqlite3

from qfinancedata.storage.sqlite import (
    EXPECTED_TABLES,
    SCHEMA_VERSION,
    initialize_database,
    list_table_names,
    sqlite_connection,
)


def test_initialize_database_creates_file_and_expected_tables(tmp_path) -> None:
    sqlite_path = tmp_path / "nested" / "qfinancedata.sqlite"

    initialize_database(sqlite_path)

    assert sqlite_path.is_file()
    with sqlite_connection(sqlite_path) as connection:
        assert list_table_names(connection) == EXPECTED_TABLES
        user_version = connection.execute("PRAGMA user_version").fetchone()[0]
        assert user_version == SCHEMA_VERSION


def test_initialize_database_is_idempotent_and_preserves_rows(tmp_path) -> None:
    sqlite_path = tmp_path / "qfinancedata.sqlite"
    initialize_database(sqlite_path)

    with sqlite_connection(sqlite_path) as connection:
        connection.execute(
            """
            INSERT INTO symbols (symbol, name, exchange, asset_type, currency)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("AAPL", "Apple Inc.", "NASDAQ", "equity", "USD"),
        )
        connection.commit()

    initialize_database(sqlite_path)

    with sqlite_connection(sqlite_path) as connection:
        row = connection.execute(
            "SELECT symbol, name, enabled FROM symbols WHERE symbol = ?",
            ("AAPL",),
        ).fetchone()

    assert dict(row) == {"symbol": "AAPL", "name": "Apple Inc.", "enabled": 1}


def test_fetch_job_items_require_existing_job(tmp_path) -> None:
    sqlite_path = tmp_path / "qfinancedata.sqlite"
    initialize_database(sqlite_path)

    with sqlite_connection(sqlite_path) as connection:
        try:
            connection.execute(
                """
                INSERT INTO fetch_job_items (id, job_id, symbol, status)
                VALUES (?, ?, ?, ?)
                """,
                ("item-1", "missing-job", "AAPL", "queued"),
            )
        except sqlite3.IntegrityError as exc:
            assert "FOREIGN KEY" in str(exc)
        else:
            raise AssertionError("Expected missing job to violate foreign key.")
