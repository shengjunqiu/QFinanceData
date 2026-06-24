import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/client";
import { useMarketOverviewQuery } from "../../api/market";
import { getPrices, pricesQueryKeys } from "../../api/prices";
import type { DataStatus, DataType, FetchJob, FreshnessByType, SymbolQuote } from "../../api/types";
import { ReturnChart } from "../../charts/ReturnChart";
import { StatusBadge } from "../../components/StatusBadge";
import {
  formatDashboardDataType,
  formatDashboardDateTime,
  formatDashboardSymbolCount,
  formatDashboardUpdatedAt,
  type DashboardCopy,
  type DashboardLocale,
  useDashboardLocale
} from "../../i18n/dashboard";

export function DashboardPage() {
  const { copy, locale, setLocale } = useDashboardLocale();
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
        <div className="dashboard-utility-row">
          <DashboardLanguageToggle copy={copy} locale={locale} onChange={setLocale} />
        </div>
        <EmptyState title={copy.overviewUnavailable} description={formatErrorMessage(error)} />
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="page">
        <div className="dashboard-utility-row">
          <DashboardLanguageToggle copy={copy} locale={locale} onChange={setLocale} />
        </div>
        <EmptyState title={copy.loadingDashboard} description={copy.fetchingDashboard} />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{copy.marketOverview}</p>
          <h1>{copy.dashboard}</h1>
        </div>
        <div className="dashboard-header-actions">
          <DashboardLanguageToggle copy={copy} locale={locale} onChange={setLocale} />
          <span className="status-pill">{dashboard.lastUpdateAt ? formatDashboardUpdatedAt(dashboard.lastUpdateAt, locale) : copy.notUpdatedYet}</span>
        </div>
      </div>

      {!hasWatchlist ? (
        <EmptyState title={copy.noSymbolsTitle} description={copy.noSymbolsDescription} />
      ) : (
        <>
          <section className="market-strip" aria-label={copy.marketSummaryLabel}>
            {dashboard.marketIndices.map((index) => (
              <MarketTile key={index.symbol} quote={index} />
            ))}
          </section>

          <div className="dashboard-grid">
            <section className="panel watchlist-panel">
              <div className="panel-heading">
                <h2>{copy.watchlist}</h2>
                <Link to="/watchlist">{copy.manage}</Link>
              </div>
              <div className="watchlist-table" role="table" aria-label={copy.watchlistOverviewLabel}>
                <div className="watchlist-row watchlist-row-header" role="row">
                  <span>{copy.symbol}</span>
                  <span>{copy.last}</span>
                  <span>{copy.change}</span>
                  <span>{copy.status}</span>
                </div>
                {dashboard.watchlist.slice(0, 8).map((quote) => (
                  <Link className="watchlist-row watchlist-row-link" key={quote.symbol} role="row" to={`/symbols/${quote.symbol}`}>
                    <span>
                      <strong>{quote.symbol}</strong>
                      <small>{quote.name}</small>
                    </span>
                    <span>{formatCurrency(quote.latestPrice, quote.currency)}</span>
                    <ChangeValue value={quote.changePct} />
                    <StatusBadge label={copy.statusLabels[quote.status]} status={quote.status} />
                  </Link>
                ))}
              </div>
            </section>

            <section className="panel panel-wide">
              <div className="panel-heading">
                <h2>{copy.watchlistTrend}</h2>
                <span>{copy.equalWeightReturn}</span>
              </div>
              {hasTrendData ? (
                <ReturnChart series={dashboard.trendSeries} />
              ) : (
                <EmptyState title={copy.noTrendDataTitle} description={copy.noTrendDataDescription} compact />
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>{copy.topMovers}</h2>
              </div>
              <div className="mover-columns">
                <MoverList emptyDescription={copy.noMovers} title={copy.gainers} quotes={dashboard.topGainers} />
                <MoverList emptyDescription={copy.noMovers} title={copy.losers} quotes={dashboard.topLosers} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>{copy.dataFreshness}</h2>
                <Link to="/jobs">{copy.review}</Link>
              </div>
              <div className="freshness-grid">
                {Object.entries(dashboard.freshness).map(([status, count]) => (
                  <Link className="freshness-cell" key={status} to="/jobs">
                    <StatusBadge label={copy.statusLabels[status as DataStatus]} status={status as DataStatus} />
                    <strong>{count}</strong>
                  </Link>
                ))}
              </div>
              <div className="freshness-type-list" aria-label="Data freshness by type">
                {Object.entries(dashboard.freshnessByType).map(([dataType, counts]) => (
                  <div className="freshness-type-row" key={dataType}>
                    <span>{formatDashboardDataType(dataType as DataType, copy)}</span>
                    <div className="freshness-status-counts">
                      {(["failed", "partial", "stale", "missing", "fresh"] as DataStatus[]).map((status) => (
                        <small key={`${dataType}-${status}`}>
                          {copy.statusLabels[status]}: {counts[status]}
                        </small>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel panel-full">
              <div className="panel-heading">
                <h2>{copy.recentFetchJobs}</h2>
                <Link to="/jobs">{copy.openJobs}</Link>
              </div>
              {dashboard.recentJobs.length === 0 ? (
                <EmptyState title={copy.noFetchJobsTitle} description={copy.noFetchJobsDescription} compact />
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

function DashboardLanguageToggle({
  copy,
  locale,
  onChange
}: {
  copy: DashboardCopy;
  locale: DashboardLocale;
  onChange: (locale: DashboardLocale) => void;
}) {
  return (
    <div className="language-toggle" aria-label={copy.language}>
      <button
        aria-pressed={locale === "en"}
        className={locale === "en" ? "language-toggle-button language-toggle-button-active" : "language-toggle-button"}
        onClick={() => onChange("en")}
        type="button"
      >
        EN
      </button>
      <button
        aria-pressed={locale === "zh"}
        className={locale === "zh" ? "language-toggle-button language-toggle-button-active" : "language-toggle-button"}
        onClick={() => onChange("zh")}
        type="button"
      >
        中文
      </button>
    </div>
  );
}

function MarketTile({ quote }: { quote: SymbolQuote }) {
  return (
    <Link className="market-tile" to={`/symbols/${quote.symbol}`}>
      <span>
        <strong>{quote.symbol}</strong>
        <small>{quote.name}</small>
      </span>
      <span>{formatCurrency(quote.latestPrice, quote.currency)}</span>
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
  copy: DashboardCopy;
  job: FetchJob;
  locale: DashboardLocale;
}) {
  const progress = job.progressTotal > 0 ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;
  const displayStatus = getJobDisplayStatus(job);

  return (
    <Link className="job-row" to={`/jobs?job=${job.id}`}>
      <span>
        <strong>{copy.jobTypeLabels[job.type]}</strong>
        <small>{formatDashboardDateTime(job.createdAt, locale)}</small>
      </span>
      <span>{formatDashboardSymbolCount(job.symbols.length, locale)}</span>
      <StatusBadge label={copy.statusLabels[displayStatus]} status={displayStatus} />
      <span className="progress-meter" aria-label={locale === "zh" ? `完成 ${progress}%` : `${progress}% complete`}>
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

function formatCurrency(value: number | null, currency: string) {
  if (value === null) {
    return "-";
  }

  if (!currency) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: value > 1000 ? 0 : 2
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: value > 1000 ? 0 : 2,
    style: "currency"
  }).format(value);
}

function formatErrorMessage(error: unknown) {
  if (isApiError(error)) {
    return error.status === 0 ? error.message : `${error.message} (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The overview data could not be loaded.";
}
