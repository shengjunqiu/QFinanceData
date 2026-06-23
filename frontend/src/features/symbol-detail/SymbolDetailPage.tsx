import { Link, useParams } from "react-router-dom";

import {
  mockCorporateActions,
  mockDataStatus,
  mockFundamentals,
  mockPriceBarsBySymbol,
  mockWatchlist
} from "../../api/mockData";
import type { CorporateAction, DataStatus, DataStatusRecord, FundamentalSnapshot, SymbolQuote } from "../../api/types";
import { PriceChart } from "../../charts/PriceChart";
import { VolumeChart } from "../../charts/VolumeChart";
import { StatusBadge } from "../../components/StatusBadge";

export function SymbolDetailPage() {
  const { symbol: symbolParam } = useParams();
  const symbol = decodeURIComponent(symbolParam ?? "").toUpperCase();
  const quote = mockWatchlist.find((item) => item.symbol.toUpperCase() === symbol);

  if (!quote) {
    return (
      <section className="page">
        <div className="detail-empty">
          <h1>Symbol not found</h1>
          <p>The ticker is not in the mock watchlist yet.</p>
          <Link to="/watchlist">Open Watchlist</Link>
        </div>
      </section>
    );
  }

  const bars = mockPriceBarsBySymbol[quote.symbol] ?? [];
  const fundamentals = mockFundamentals.find((item) => item.symbol === quote.symbol);
  const actions = mockCorporateActions.filter((item) => item.symbol === quote.symbol);
  const statuses = mockDataStatus.filter((item) => item.symbol === quote.symbol);

  return (
    <section className="page symbol-detail-page">
      <header className="symbol-hero">
        <div>
          <p className="eyebrow">{quote.exchange} · {quote.assetType}</p>
          <h1>{quote.symbol} <span>{quote.name}</span></h1>
          <div className="symbol-price-line">
            <strong>{formatCurrency(quote.latestPrice, quote.currency)}</strong>
            <ChangeValue value={quote.changePct} />
            <span>Updated {quote.lastUpdate ?? "never"}</span>
          </div>
        </div>
        <div className="symbol-actions">
          <button type="button">Refresh</button>
          <button type="button">Export</button>
        </div>
      </header>

      <div className="symbol-detail-grid">
        <section className="panel chart-panel panel-full">
          <div className="panel-heading">
            <h2>Price Chart</h2>
            <span>OHLC + adjusted close</span>
          </div>
          {bars.length > 0 ? <PriceChart bars={bars} /> : <EmptyState title="No price data" description="Run a price update to populate this chart." />}
        </section>

        <section className="panel chart-panel panel-full">
          <div className="panel-heading">
            <h2>Volume</h2>
            <span>Daily shares traded</span>
          </div>
          {bars.length > 0 ? <VolumeChart bars={bars} /> : <EmptyState title="No volume data" description="Volume appears when price bars are available." />}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Key Metrics</h2>
            {fundamentals ? <StatusBadge status={fundamentals.status} /> : <StatusBadge status="missing" />}
          </div>
          <MetricGrid items={buildMetricItems(fundamentals, quote.currency)} />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Financial Summary</h2>
            <span>{fundamentals?.lastFetchAt ? formatDateTime(fundamentals.lastFetchAt) : "Not fetched"}</span>
          </div>
          <MetricGrid items={buildFinancialItems(fundamentals, quote.currency)} />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Corporate Actions</h2>
            <span>{actions.length} events</span>
          </div>
          <CorporateActionList actions={actions} currency={quote.currency} />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Data Status</h2>
            <Link to="/jobs">Open Jobs</Link>
          </div>
          <DataStatusList quote={quote} statuses={statuses} />
        </section>
      </div>
    </section>
  );
}

function MetricGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="metric-grid">
      {items.map((item) => (
        <div className="metric-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function CorporateActionList({ actions, currency }: { actions: CorporateAction[]; currency: string }) {
  if (actions.length === 0) {
    return <EmptyState compact title="No events" description="No dividends or splits are available for this symbol." />;
  }

  return (
    <div className="action-list">
      {actions.map((action) => (
        <div className="action-row" key={`${action.symbol}-${action.actionType}-${action.exDate}`}>
          <span>
            <strong>{action.actionType === "dividend" ? "Dividend" : "Split"}</strong>
            <small>{action.exDate}</small>
          </span>
          <span>{action.actionType === "dividend" ? formatCurrency(action.value, currency) : `${action.value}:1`}</span>
        </div>
      ))}
    </div>
  );
}

function DataStatusList({ quote, statuses }: { quote: SymbolQuote; statuses: DataStatusRecord[] }) {
  const fallbackStatuses: DataStatusRecord[] =
    statuses.length > 0
      ? statuses
      : [
          {
            symbol: quote.symbol,
            dataType: "prices",
            status: quote.status,
            lastDataAt: quote.lastUpdate,
            lastFetchAt: null,
            lastSuccessAt: null,
            lastError: quote.status === "failed" ? "Latest price update failed" : null
          }
        ];

  return (
    <div className="data-status-list">
      {fallbackStatuses.map((status) => (
        <div className="data-status-row" key={`${status.symbol}-${status.dataType}`}>
          <span>
            <strong>{status.dataType}</strong>
            <small>{status.lastDataAt ? `Data through ${status.lastDataAt}` : "No local data"}</small>
          </span>
          <StatusBadge status={status.status} />
        </div>
      ))}
    </div>
  );
}

function buildMetricItems(fundamentals: FundamentalSnapshot | undefined, currency: string) {
  return [
    { label: "Market Cap", value: formatCompactCurrency(fundamentals?.metrics.marketCap ?? null, currency) },
    { label: "Trailing PE", value: formatNumber(fundamentals?.metrics.trailingPe ?? null) },
    { label: "Price / Book", value: formatNumber(fundamentals?.metrics.priceToBook ?? null) },
    { label: "Dividend Yield", value: formatPercent(fundamentals?.metrics.dividendYield ?? null) },
    { label: "52W High", value: formatCurrency(fundamentals?.metrics.fiftyTwoWeekHigh ?? null, currency) },
    { label: "52W Low", value: formatCurrency(fundamentals?.metrics.fiftyTwoWeekLow ?? null, currency) }
  ];
}

function buildFinancialItems(fundamentals: FundamentalSnapshot | undefined, currency: string) {
  return [
    { label: "Revenue", value: formatCompactCurrency(fundamentals?.financialSummary.revenue ?? null, currency) },
    { label: "Net Income", value: formatCompactCurrency(fundamentals?.financialSummary.netIncome ?? null, currency) },
    { label: "Free Cash Flow", value: formatCompactCurrency(fundamentals?.financialSummary.freeCashFlow ?? null, currency) },
    { label: "Debt Ratio", value: formatPercent(fundamentals?.financialSummary.debtRatio ?? null) }
  ];
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

function formatCompactCurrency(value: number | null, currency: string) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    notation: "compact",
    style: "currency"
  }).format(value);
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    style: "percent"
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
