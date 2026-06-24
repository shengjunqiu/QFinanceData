from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from qfinancedata.schemas.data_status import DataStatusRead, DataTypeValue
from qfinancedata.services.data_status import DataStatusService
from qfinancedata.storage.repositories import DataStatusRepository

router = APIRouter(prefix="/api/data-status", tags=["data-status"])


def get_data_status_service(request: Request) -> DataStatusService:
    settings = request.app.state.settings
    return DataStatusService(DataStatusRepository(settings.sqlite_path))


@router.get("", response_model=list[DataStatusRead])
def list_data_status(
    symbol: str | None = Query(None),
    data_type: DataTypeValue | None = Query(None),
    service: DataStatusService = Depends(get_data_status_service),
) -> list[DataStatusRead]:
    return service.list_status(symbol=symbol, data_type=data_type)
