from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from qfinancedata.fetchers.metadata import MetadataFetcher
from qfinancedata.fetchers.yf_client import YFinanceClient
from qfinancedata.schemas.symbols import SymbolCreate, SymbolRead, SymbolUpdate
from qfinancedata.services.metadata import MetadataService
from qfinancedata.services.symbols import (
    SymbolAlreadyExistsError,
    SymbolNotFoundError,
    SymbolService,
)
from qfinancedata.storage.repositories import DataStatusRepository, SymbolRepository

router = APIRouter(prefix="/api/symbols", tags=["symbols"])


def get_symbol_service(request: Request) -> SymbolService:
    settings = request.app.state.settings
    symbol_repository = SymbolRepository(settings.sqlite_path)
    return SymbolService(
        symbol_repository,
        get_metadata_service(request, symbol_repository),
    )


def get_metadata_service(
    request: Request,
    symbol_repository: SymbolRepository,
) -> MetadataService | None:
    settings = request.app.state.settings
    metadata_fetcher = getattr(request.app.state, "metadata_fetcher", None)
    yfinance_module = getattr(request.app.state, "yfinance_module", None)
    yf_client = getattr(request.app.state, "yf_client", None)

    if metadata_fetcher is None:
        if settings.environment == "test" and yfinance_module is None and yf_client is None:
            return None
        metadata_fetcher = MetadataFetcher(
            yf_client
            or YFinanceClient(
                timeout=settings.request_timeout,
                yfinance_module=yfinance_module,
            ),
            raw_dir=settings.data_dir / "raw" / "metadata",
        )

    return MetadataService(
        symbol_repository,
        DataStatusRepository(settings.sqlite_path),
        metadata_fetcher,
    )


@router.get("", response_model=list[SymbolRead])
def list_symbols(
    include_disabled: bool = Query(False),
    group_name: str | None = Query(None),
    service: SymbolService = Depends(get_symbol_service),
) -> list[SymbolRead]:
    return service.list_symbols(
        include_disabled=include_disabled,
        group_name=group_name,
    )


@router.post("", response_model=SymbolRead, status_code=status.HTTP_201_CREATED)
def create_symbol(
    payload: SymbolCreate,
    response: Response,
    service: SymbolService = Depends(get_symbol_service),
) -> SymbolRead:
    try:
        record, created = service.add_symbol(payload)
    except SymbolAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if not created:
        response.status_code = status.HTTP_200_OK
    return record


@router.patch("/{symbol}", response_model=SymbolRead)
def update_symbol(
    symbol: str,
    payload: SymbolUpdate,
    service: SymbolService = Depends(get_symbol_service),
) -> SymbolRead:
    try:
        return service.update_symbol(symbol, payload)
    except SymbolNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.delete("/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
def delete_symbol(
    symbol: str,
    service: SymbolService = Depends(get_symbol_service),
) -> None:
    try:
        service.remove_from_watchlist(symbol)
    except SymbolNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
