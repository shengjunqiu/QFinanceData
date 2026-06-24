from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from qfinancedata.fetchers.yf_client import YFinanceValidationError
from qfinancedata.schemas.actions import CorporateActionRead
from qfinancedata.services.actions import CorporateActionQueryService
from qfinancedata.storage.parquet import CorporateActionRepository

router = APIRouter(prefix="/api/actions", tags=["actions"])


def get_corporate_action_query_service(request: Request) -> CorporateActionQueryService:
    settings = request.app.state.settings
    repository = getattr(
        request.app.state,
        "corporate_action_repository",
        CorporateActionRepository(settings.data_dir / "parquet"),
    )
    return CorporateActionQueryService(repository)


@router.get("/{symbol}", response_model=list[CorporateActionRead])
def list_corporate_actions(
    symbol: str,
    service: CorporateActionQueryService = Depends(get_corporate_action_query_service),
) -> list[CorporateActionRead]:
    try:
        return service.list_actions(symbol)
    except YFinanceValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
