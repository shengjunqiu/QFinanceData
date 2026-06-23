from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from qfinancedata.schemas.symbols import SymbolCreate, SymbolRead, SymbolUpdate
from qfinancedata.services.symbols import (
    SymbolAlreadyExistsError,
    SymbolNotFoundError,
    SymbolService,
)
from qfinancedata.storage.repositories import SymbolRepository

router = APIRouter(prefix="/api/symbols", tags=["symbols"])


def get_symbol_service(request: Request) -> SymbolService:
    return SymbolService(SymbolRepository(request.app.state.settings.sqlite_path))


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
