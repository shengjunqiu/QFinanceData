from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from qfinancedata.schemas.prices import LatestPriceResponse, PriceSeriesResponse
from qfinancedata.services.prices import PriceQueryService
from qfinancedata.storage.parquet import PriceBarRepository

router = APIRouter(prefix="/api/prices", tags=["prices"])


def get_price_query_service(request: Request) -> PriceQueryService:
    settings = request.app.state.settings
    price_bar_repository = getattr(
        request.app.state,
        "price_bar_repository",
        PriceBarRepository(settings.data_dir / "parquet"),
    )
    return PriceQueryService(price_bar_repository)


@router.get("/{symbol}", response_model=PriceSeriesResponse)
def get_price_series(
    symbol: str,
    interval: str = Query("1d"),
    range: str = Query("1y"),
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    service: PriceQueryService = Depends(get_price_query_service),
) -> PriceSeriesResponse:
    try:
        return service.get_price_series(
            symbol,
            interval=interval,
            range_value=range,
            start=start,
            end=end,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/{symbol}/latest", response_model=LatestPriceResponse)
def get_latest_price(
    symbol: str,
    interval: str = Query("1d"),
    service: PriceQueryService = Depends(get_price_query_service),
) -> LatestPriceResponse:
    try:
        return service.get_latest_price(symbol, interval=interval)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
