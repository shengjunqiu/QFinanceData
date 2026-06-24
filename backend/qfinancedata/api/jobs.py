from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from qfinancedata.fetchers.actions import CorporateActionFetcher
from qfinancedata.fetchers.fundamentals import FundamentalFetcher
from qfinancedata.fetchers.yf_client import YFinanceClient, YFinanceValidationError
from qfinancedata.schemas.jobs import FetchJobRead, PriceFetchRequest, SymbolFetchRequest
from qfinancedata.services.actions import CorporateActionFetchService
from qfinancedata.services.fundamentals import FundamentalFetchService
from qfinancedata.services.jobs import JobNotFoundError, JobService, NoSymbolsError
from qfinancedata.services.prices import PriceFetchService
from qfinancedata.storage.parquet import (
    CorporateActionRepository,
    FundamentalFactRepository,
    PriceBarRepository,
)
from qfinancedata.storage.repositories import (
    DataStatusRepository,
    JobRepository,
    SymbolRepository,
)

router = APIRouter(tags=["jobs"])


def get_job_service(request: Request) -> JobService:
    settings = request.app.state.settings
    yfinance_module = getattr(request.app.state, "yfinance_module", None)
    yf_client = getattr(
        request.app.state,
        "yf_client",
        YFinanceClient(
            timeout=settings.request_timeout,
            yfinance_module=yfinance_module,
        ),
    )
    price_bar_repository = getattr(
        request.app.state,
        "price_bar_repository",
        PriceBarRepository(settings.data_dir / "parquet"),
    )
    fundamental_fact_repository = getattr(
        request.app.state,
        "fundamental_fact_repository",
        FundamentalFactRepository(settings.data_dir / "parquet"),
    )
    corporate_action_repository = getattr(
        request.app.state,
        "corporate_action_repository",
        CorporateActionRepository(settings.data_dir / "parquet"),
    )

    return JobService(
        JobRepository(settings.sqlite_path),
        SymbolRepository(settings.sqlite_path),
        DataStatusRepository(settings.sqlite_path),
        PriceFetchService(yf_client, price_bar_repository),
        FundamentalFetchService(
            FundamentalFetcher(yf_client),
            fundamental_fact_repository,
        ),
        CorporateActionFetchService(
            CorporateActionFetcher(yf_client),
            corporate_action_repository,
        ),
        default_start_date=settings.default_start_date,
        default_interval=settings.default_interval,
        stale_trading_days=settings.stale_trading_days,
    )


@router.post(
    "/api/fetch/prices",
    response_model=FetchJobRead,
    status_code=status.HTTP_201_CREATED,
)
def create_price_fetch_job(
    payload: PriceFetchRequest,
    service: JobService = Depends(get_job_service),
) -> FetchJobRead:
    try:
        return service.run_price_fetch_job(payload)
    except (NoSymbolsError, YFinanceValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/api/fetch/fundamentals",
    response_model=FetchJobRead,
    status_code=status.HTTP_201_CREATED,
)
def create_fundamentals_fetch_job(
    payload: SymbolFetchRequest,
    service: JobService = Depends(get_job_service),
) -> FetchJobRead:
    try:
        return service.run_fundamentals_fetch_job(payload)
    except (NoSymbolsError, YFinanceValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/api/fetch/actions",
    response_model=FetchJobRead,
    status_code=status.HTTP_201_CREATED,
)
def create_actions_fetch_job(
    payload: SymbolFetchRequest,
    service: JobService = Depends(get_job_service),
) -> FetchJobRead:
    try:
        return service.run_actions_fetch_job(payload)
    except (NoSymbolsError, YFinanceValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/api/jobs", response_model=list[FetchJobRead])
def list_jobs(
    limit: int = Query(50, ge=1, le=200),
    service: JobService = Depends(get_job_service),
) -> list[FetchJobRead]:
    return service.list_jobs(limit=limit)


@router.get("/api/jobs/{job_id}", response_model=FetchJobRead)
def get_job(
    job_id: str,
    service: JobService = Depends(get_job_service),
) -> FetchJobRead:
    try:
        return service.get_job(job_id)
    except JobNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
