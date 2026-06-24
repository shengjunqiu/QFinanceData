from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from qfinancedata.schemas.market import MarketOverviewRead
from qfinancedata.services.market import MarketOverviewService
from qfinancedata.services.prices import PriceQueryService
from qfinancedata.storage.parquet import PriceBarRepository
from qfinancedata.storage.repositories import JobRepository, SymbolRepository

router = APIRouter(prefix="/api/market", tags=["market"])


def get_market_overview_service(request: Request) -> MarketOverviewService:
    settings = request.app.state.settings
    price_bar_repository = getattr(
        request.app.state,
        "price_bar_repository",
        PriceBarRepository(settings.data_dir / "parquet"),
    )
    return MarketOverviewService(
        SymbolRepository(settings.sqlite_path),
        JobRepository(settings.sqlite_path),
        PriceQueryService(price_bar_repository),
    )


@router.get("/overview", response_model=MarketOverviewRead)
def get_market_overview(
    service: MarketOverviewService = Depends(get_market_overview_service),
) -> MarketOverviewRead:
    return service.get_overview()
