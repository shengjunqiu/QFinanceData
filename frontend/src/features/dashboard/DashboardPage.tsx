import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/client";
import { useMarketOverviewQuery } from "../../api/market";
import { getPrices, pricesQueryKeys } from "../../api/prices";
import type { DataStatus, DataType, FetchJob, FreshnessByType, SymbolQuote } from "../../api/types";
import { ReturnChart } from "../../charts/ReturnChart";
import { StatusBadge } from "../../components/StatusBadge";
import {
  formatCurrency,
  formatDataType,
  formatDateTime,
  formatPercentComplete,
  formatSymbolCount,
  formatUpdatedAt,
  type AppCopy,
  type Locale,
  useI18n
} from "../../i18n";

export function DashboardPage() {
  const { copy, locale } = useI18n();
  const t = copy.dashboard;
  const overviewQuery = useMarketOverviewQuery();
  const overview = overviewQuery.data;
  const trendSymbols = overview?.watchlist.slice(0, 5).map((quote) => quote.symbol) ?? [];

  const priceSeriesQueries = useQueries({
    queries: trendSymbols.map((symbol) => ({
      enabled: trendSymbols.length > 0,
      queryFn: ({ signal }) => getPrices(symbol, { interval: "1d", range: "1y" }, { signal }),
      queryKey: pricesQueryKeys.series(symbol, { interval: "1d", range: "1y" })
    }))
  });

  const dashboard = {
    lastUpdateAt: overview?.lastUpdateAt ?? null,
    marketIndices: overview?.marketIndices ?? [],
    watchlist: overview?.watchlist ?? [],
    topGainers: overview?.topGainers ?? [],
    topLosers: overview?.topLosers ?? [],
    freshness: overview?.freshness ?? {
      fresh: 0,
      stale: 0,
      missing: 0,
      failed: 0,
      partial: 0
    },
    freshnessByType: overview?.freshnessByType ?? emptyFreshnessByType(),
    recentJobs: overview?.recentJobs ?? [],
    trendSeries: priceSeriesQueries.map((query) => query.data?.bars ?? [])
  };
  const hasWatchlist = dashboard.watchlist.length > 0;
  const hasTrendData = dashboard.trendSeries.some((series) => series.length > 0);
  const isLoading = overviewQuery.isLoading || priceSeriesQueries.some((query) => query.isLoading);
  const error = overviewQuery.error ?? priceSeriesQueries.find((query) => query.error)?.error;

  if (error) {
    return (
      <section className="page">
        <EmptyState title={t.overviewUnavailable} description={formatErrorMessage(error, copy)} />
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="page">
        <EmptyState title={t.loadingDashboard} description={t.fetchingDashboard} />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t.marketOverview}</p>
          <h1>{t.dashboard}</h1>
        </div>
        <div className="dashboard-header-actions">
          <span className="status-pill">{dashboard.lastUpdateAt ? formatUpdatedAt(dashboard.lastUpdateAt, locale, copy) : t.notUpdatedYet}</span>
        </div>
      </div>

      {!hasWatchlist ? (
        <EmptyState title={t.noSymbolsTitle} description={t.noSymbolsDescription} />
      ) : (
        <>
          <section className="market-strip" aria-label={t.marketSummaryLabel}>
            {dashboard.marketIndices.map((index) => (
              <MarketTile key={index.symbol} locale={locale} quote={index} />
            ))}
          </section>

          <div className="dashboard-grid">
            <section className="panel watchlist-panel">
              <div className="panel-heading">
                <h2>{copy.nav.watchlist}</h2>
                <Link to="/watchlist">{t.manage}</Link>
              </div>
              <div className="watchlist-table" role="table" aria-label={t.watchlistOverviewLabel}>
                <div className="watchlist-row watchlist-row-header" role="row">
                  <span>{copy.common.symbol}</span>
                  <span>{t.last}</span>
                  <span>{copy.common.change}</span>
                  <span>{copy.common.status}</span>
                </div>
                {dashboard.watchlist.slice(0, 8).map((quote) => (
                  <Link className="watchlist-row watchlist-row-link" key={quote.symbol} role="row" to={`/symbols/${quote.symbol}`}>
                    <span>
                      <strong>{quote.symbol}</strong>
                      <small>{quote.name}</small>
                    </span>
                    <span>{formatCurrency(quote.latestPrice, quote.currency, locale)}</span>
                    <ChangeValue value={quote.changePct} />
                    <StatusBadge status={quote.status} />
                  </Link>
                ))}
              </div>
            </section>

            <section className="panel panel-wide">
              <div className="panel-heading">
                <h2>{t.watchlistTrend}</h2>
                <span>{t.equalWeightReturn}</span>
              </div>
              {hasTrendData ? (
                <ReturnChart series={dashboard.trendSeries} seriesName={copy.symbolDetail.chartSeries.equalWeightReturn} />
              ) : (
                <EmptyState title={t.noTrendDataTitle} description={t.noTrendDataDescription} compact />
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>{t.topMovers}</h2>
              </div>
              <div className="mover-columns">
                <MoverList emptyDescription={t.noMovers} title={t.gainers} quotes={dashboard.topGainers} />
                <MoverList emptyDescription={t.noMovers} title={t.losers} quotes={dashboard.topLosers} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>{t.dataFreshness}</h2>
                <Link to="/jobs">{t.review}</Link>
              </div>
              <div className="freshness-grid">
                {Object.entries(dashboard.freshness).map(([status, count]) => (
                  <Link className="freshness-cell" key={status} to="/jobs">
                    <StatusBadge status={status as DataStatus} />
                    <strong>{count}</strong>
                  </Link>
                ))}
              </div>
              <div className="freshness-type-list" aria-label={copy.common.dataFreshnessByType}>
                {Object.entries(dashboard.freshnessByType).map(([dataType, counts]) => (
                  <div className="freshness-type-row" key={dataType}>
                    <span>{formatDataType(dataType as DataType, copy)}</span>
                    <div className="freshness-status-counts">
                      {(["failed", "partial", "stale", "missing", "fresh"] as DataStatus[]).map((status) => (
                        <small key={`${dataType}-${status}`}>
                          {copy.common.statusLabels[status]}: {counts[status]}
                        </small>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel panel-full">
              <div className="panel-heading">
                <h2>{t.recentFetchJobs}</h2>
                <Link to="/jobs">{t.openJobs}</Link>
              </div>
              {dashboard.recentJobs.length === 0 ? (
                <EmptyState title={t.noFetchJobsTitle} description={t.noFetchJobsDescription} compact />
              ) : (
                <div className="jobs-list">
                  {dashboard.recentJobs.map((job) => (
                    <RecentJobRow copy={copy} job={job} key={job.id} locale={locale} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function MarketTile({ locale, quote }: { locale: Locale; quote: SymbolQuote }) {
  return (
    <Link className="market-tile" to={`/symbols/${quote.symbol}`}>
      <span>
        <strong>{quote.symbol}</strong>
        <small>{quote.name}</small>
      </span>
      <span>{formatCurrency(quote.latestPrice, quote.currency, locale)}</span>
      <ChangeValue value={quote.changePct} />
    </Link>
  );
}

function MoverList({ emptyDescription, quotes, title }: { emptyDescription: string; quotes: SymbolQuote[]; title: string }) {
  if (quotes.length === 0) {
    return <EmptyState title={title} description={emptyDescription} compact />;
  }

  return (
    <div className="mover-list">
      <h3>{title}</h3>
      {quotes.map((quote) => (
        <Link className="mover-row" key={`${title}-${quote.symbol}`} to={`/symbols/${quote.symbol}`}>
          <span>{quote.symbol}</span>
          <ChangeValue value={quote.changePct} />
        </Link>
      ))}
    </div>
  );
}

function RecentJobRow({
  copy,
  job,
  locale
}: {
  copy: AppCopy;
  job: FetchJob;
  locale: Locale;
}) {
  const progress = job.progressTotal > 0 ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;
  const displayStatus = getJobDisplayStatus(job);

  return (
    <Link className="job-row" to={`/jobs?job=${job.id}`}>
      <span>
        <strong>{copy.common.jobTypeLabels[job.type]}</strong>
        <small>{formatDateTime(job.createdAt, locale)}</small>
      </span>
      <span>{formatSymbolCount(job.symbols.length, locale)}</span>
      <StatusBadge status={displayStatus} />
      <span className="progress-meter" aria-label={formatPercentComplete(progress, locale)}>
        <span style={{ width: `${progress}%` }} />
      </span>
    </Link>
  );
}

function ChangeValue({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="change-value change-neutral">-</span>;
  }

  const tone = value > 0 ? "change-positive" : value < 0 ? "change-negative" : "change-neutral";
  const prefix = value > 0 ? "+" : "";

  return <span className={`change-value ${tone}`}>{prefix}{value.toFixed(2)}%</span>;
}

function EmptyState({ compact = false, description, title }: { compact?: boolean; description: string; title: string }) {
  return (
    <div className={compact ? "empty-state empty-state-compact" : "empty-state"}>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function getJobDisplayStatus(job: FetchJob): DataStatus {
  if (job.status === "success") {
    return "fresh";
  }

  if (job.status === "partial_success") {
    return "partial";
  }

  if (job.status === "failed") {
    return "failed";
  }

  return "stale";
}

function emptyFreshnessByType(): FreshnessByType {
  const empty = {
    fresh: 0,
    stale: 0,
    missing: 0,
    failed: 0,
    partial: 0
  };
  return {
    prices: { ...empty },
    metadata: { ...empty },
    fundamentals: { ...empty },
    actions: { ...empty }
  };
}

function formatErrorMessage(error: unknown, copy: AppCopy) {
  if (isApiError(error)) {
    return error.status === 0 ? error.message : `${error.message} (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return copy.dashboard.overviewFallbackError;
}
