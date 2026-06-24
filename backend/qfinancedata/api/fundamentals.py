from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from qfinancedata.fetchers.yf_client import YFinanceValidationError
from qfinancedata.schemas.fundamentals import FundamentalSnapshotRead
from qfinancedata.services.fundamentals import FundamentalQueryService
from qfinancedata.storage.parquet import FundamentalFactRepository
from qfinancedata.storage.repositories import DataStatusRepository

router = APIRouter(prefix="/api/fundamentals", tags=["fundamentals"])


def get_fundamental_query_service(request: Request) -> FundamentalQueryService:
    settings = request.app.state.settings
    repository = getattr(
        request.app.state,
        "fundamental_fact_repository",
        FundamentalFactRepository(settings.data_dir / "parquet"),
    )
    data_status_repository = getattr(
        request.app.state,
        "data_status_repository",
        DataStatusRepository(settings.sqlite_path),
    )
    return FundamentalQueryService(repository, data_status_repository)


@router.get("/{symbol}", response_model=FundamentalSnapshotRead)
def get_fundamentals(
    symbol: str,
    service: FundamentalQueryService = Depends(get_fundamental_query_service),
) -> FundamentalSnapshotRead:
    try:
        return service.get_snapshot(symbol)
    except YFinanceValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
