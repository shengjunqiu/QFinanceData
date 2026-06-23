import { Link } from "react-router-dom";

import { mockDashboardSummary, mockPriceBarsBySymbol } from "../../api/mockData";
import type { DataStatus, FetchJob, SymbolQuote } from "../../api/types";
import { ReturnChart } from "../../charts/ReturnChart";

const statusLabels: Record<DataStatus, string> = {
  fresh: "Fresh",
  stale: "Stale",
  missing: "Missing",
  failed: "Failed",
  partial: "Partial"
};

export function DashboardPage() {
  const dashboard = mockDashboardSummary;
  const hasWatchlist = dashboard.watchlist.length > 0;
  const hasError = false;

  if (hasError) {
    return (
      <section className="page">
        <EmptyState title="Dashboard unavailable" description="The overview data could not be loaded." />
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
        <span className="status-pill">Updated {formatDateTime(dashboard.lastUpdateAt)}</span>
      </div>

      <section className="market-strip" aria-label="Market summary">
        {dashboard.marketIndices.map((index) => (
          <MarketTile key={index.symbol} quote={index} />
        ))}
      </section>

      {!hasWatchlist ? (
        <EmptyState title="No symbols yet" description="Add a ticker in Watchlist to start building the dashboard." />
      ) : (
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
            <ReturnChart series={dashboard.watchlist.slice(0, 5).map((quote) => mockPriceBarsBySymbol[quote.symbol] ?? [])} />
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
            <div className="jobs-list">
              {dashboard.recentJobs.map((job) => (
                <RecentJobRow job={job} key={job.id} />
              ))}
            </div>
          </section>
        </div>
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

function StatusBadge({ status }: { status: DataStatus }) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>;
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
