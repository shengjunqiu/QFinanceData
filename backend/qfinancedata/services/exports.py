from __future__ import annotations

import csv
from io import StringIO
from typing import Any

from fastapi import Response


def rows_to_csv(columns: list[str], rows: list[dict[str, Any]]) -> str:
    buffer = StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def csv_response(content: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
