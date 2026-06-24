import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/client";
import { useMarketOverviewQuery } from "../../api/market";
import { getPrices, pricesQueryKeys } from "../../api/prices";
import type { DataStatus, FetchJob, SymbolQuote } from "../../api/types";
import { ReturnChart } from "../../charts/ReturnChart";
import { StatusBadge } from "../../components/StatusBadge";

export function DashboardPage() {
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
        <EmptyState title="Dashboard unavailable" description={formatErrorMessage(error)} />
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="page">
        <EmptyState title="Loading dashboard" description="Fetching symbols, prices, data status and recent jobs." />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Market Overview</p>
          <h1>Dashboard</h1>
        </div>
        <span className="status-pill">{dashboard.lastUpdateAt ? `Updated ${formatDateTime(dashboard.lastUpdateAt)}` : "Not updated yet"}</span>
      </div>

      {!hasWatchlist ? (
        <EmptyState title="No symbols yet" description="Add a ticker in Watchlist to start building the dashboard." />
      ) : (
        <>
          <section className="market-strip" aria-label="Market summary">
            {dashboard.marketIndices.map((index) => (
              <MarketTile key={index.symbol} quote={index} />
            ))}
          </section>

          <div className="dashboard-grid">
            <section className="panel watchlist-panel">
              <div className="panel-heading">
                <h2>Watchlist</h2>
                <Link to="/watchlist">Manage</Link>
              </div>
              <div className="watchlist-table" role="table" aria-label="Watchlist overview">
                <div className="watchlist-row watchlist-row-header" role="row">
                  <span>Symbol</span>
                  <span>Last</span>
                  <span>Change</span>
                  <span>Status</span>
                </div>
                {dashboard.watchlist.slice(0, 8).map((quote) => (
                  <Link className="watchlist-row watchlist-row-link" key={quote.symbol} role="row" to={`/symbols/${quote.symbol}`}>
                    <span>
                      <strong>{quote.symbol}</strong>
                      <small>{quote.name}</small>
                    </span>
                    <span>{formatCurrency(quote.latestPrice, quote.currency)}</span>
                    <ChangeValue value={quote.changePct} />
                    <StatusBadge status={quote.status} />
                  </Link>
                ))}
              </div>
            </section>

            <section className="panel panel-wide">
              <div className="panel-heading">
                <h2>Watchlist Trend</h2>
                <span>Equal weight return</span>
              </div>
              {hasTrendData ? (
                <ReturnChart series={dashboard.trendSeries} />
              ) : (
                <EmptyState title="No trend data" description="Run a price fetch job to populate watchlist history." compact />
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>Top Movers</h2>
              </div>
              <div className="mover-columns">
                <MoverList title="Gainers" quotes={dashboard.topGainers} />
                <MoverList title="Losers" quotes={dashboard.topLosers} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>Data Freshness</h2>
                <Link to="/jobs">Review</Link>
              </div>
              <div className="freshness-grid">
                {Object.entries(dashboard.freshness).map(([status, count]) => (
                  <Link className="freshness-cell" key={status} to="/jobs">
                    <StatusBadge status={status as DataStatus} />
                    <strong>{count}</strong>
                  </Link>
                ))}
              </div>
            </section>

            <section className="panel panel-full">
              <div className="panel-heading">
                <h2>Recent Fetch Jobs</h2>
                <Link to="/jobs">Open Jobs</Link>
              </div>
              {dashboard.recentJobs.length === 0 ? (
                <EmptyState title="No fetch jobs yet" description="Start a job from the Jobs page to update prices." compact />
              ) : (
                <div className="jobs-list">
                  {dashboard.recentJobs.map((job) => (
                    <RecentJobRow job={job} key={job.id} />
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

function MoverList({ quotes, title }: { quotes: SymbolQuote[]; title: string }) {
  if (quotes.length === 0) {
    return <EmptyState title={title} description="No movers to show." compact />;
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

function RecentJobRow({ job }: { job: FetchJob }) {
  const progress = job.progressTotal > 0 ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;

  return (
    <Link className="job-row" to={`/jobs?job=${job.id}`}>
      <span>
        <strong>{job.type}</strong>
        <small>{formatDateTime(job.createdAt)}</small>
      </span>
      <span>{job.symbols.length} symbols</span>
      <StatusBadge status={getJobDisplayStatus(job)} />
      <span className="progress-meter" aria-label={`${progress}% complete`}>
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
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
