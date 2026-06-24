import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { useCorporateActionsQuery } from "../../api/actions";
import { isApiError } from "../../api/client";
import { useFundamentalsQuery } from "../../api/fundamentals";
import { createPriceFetchJob, jobsQueryKeys } from "../../api/jobs";
import { useDataStatusQuery, marketQueryKeys } from "../../api/market";
import { pricesQueryKeys, useLatestPriceQuery, usePriceSeriesQuery } from "../../api/prices";
import { symbolsQueryKeys, useSymbolsQuery } from "../../api/symbols";
import type { CorporateAction, DataStatusRecord, FundamentalSnapshot, SymbolQuote } from "../../api/types";
import { PriceChart } from "../../charts/PriceChart";
import { VolumeChart } from "../../charts/VolumeChart";
import { StatusBadge } from "../../components/StatusBadge";
import { TimeRangeControl, type TimeRange } from "../../components/TimeRangeControl";

const rangeMap: Record<TimeRange, string> = {
  "1D": "1d",
  "1M": "1mo",
  "3M": "3mo",
  "1Y": "1y",
  "5Y": "5y",
  MAX: "max"
};

export function SymbolDetailPage() {
  const { symbol: symbolParam } = useParams();
  const symbol = decodeURIComponent(symbolParam ?? "").toUpperCase();
  const [range, setRange] = useState<TimeRange>("1Y");
  const symbolsQuery = useSymbolsQuery({ includeDisabled: true });
  const priceSeriesQuery = usePriceSeriesQuery(symbol, { interval: "1d", range: rangeMap[range] });
  const latestPriceQuery = useLatestPriceQuery(symbol, { interval: "1d" });
  const dataStatusQuery = useDataStatusQuery({ symbol });
  const fundamentalsQuery = useFundamentalsQuery(symbol);
  const actionsQuery = useCorporateActionsQuery(symbol);
  const queryClient = useQueryClient();
  const refreshMutation = useMutation({
    mutationFn: () => createPriceFetchJob({ interval: "1d", symbols: [symbol] }),
    onSuccess: (job) => {
      queryClient.setQueryData(jobsQueryKeys.detail(job.id), job);
      void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: pricesQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: symbolsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
    }
  });

  const quote = symbolsQuery.data?.find((item) => item.symbol.toUpperCase() === symbol);
  const latest = latestPriceQuery.data;
  const detailQuote = quote
    ? {
        ...quote,
        latestPrice: latest?.latestPrice ?? quote.latestPrice,
        change: latest?.change ?? quote.change,
        changePct: latest?.changePct ?? quote.changePct,
        volume: latest?.volume ?? quote.volume,
        lastUpdate: latest?.latestDataAt ?? quote.lastUpdate
      }
    : undefined;

  if (symbolsQuery.isLoading) {
    return (
      <section className="page">
        <EmptyState title="Loading symbol" description="Fetching symbol profile and local price data." />
      </section>
    );
  }

  if (symbolsQuery.error) {
    return (
      <section className="page">
        <EmptyState title="Symbol unavailable" description={formatErrorMessage(symbolsQuery.error)} />
      </section>
    );
  }

  if (!detailQuote) {
    return (
      <section className="page">
        <div className="detail-empty">
          <h1>Symbol not found</h1>
          <p>The ticker is not in the watchlist yet.</p>
          <Link to="/watchlist">Open Watchlist</Link>
        </div>
      </section>
    );
  }

  const bars = priceSeriesQuery.data?.bars ?? [];
  const priceError = priceSeriesQuery.error;
  const fundamentals = fundamentalsQuery.data;
  const fundamentalsCurrency = fundamentals?.currency || detailQuote.currency;
  const actions = actionsQuery.data ?? [];
  const statuses = dataStatusQuery.data ?? [];

  return (
    <section className="page symbol-detail-page">
      <header className="symbol-hero">
        <div>
          <p className="eyebrow">{detailQuote.exchange || "Unknown exchange"} · {detailQuote.assetType}</p>
          <h1>{detailQuote.symbol} <span>{detailQuote.name || "Unnamed symbol"}</span></h1>
          <div className="symbol-price-line">
            <strong>{formatCurrency(detailQuote.latestPrice, detailQuote.currency)}</strong>
            <ChangeValue value={detailQuote.changePct} />
            <span>{latestPriceQuery.isLoading ? "Loading latest price" : `Updated ${detailQuote.lastUpdate ? formatDateTime(detailQuote.lastUpdate) : "never"}`}</span>
          </div>
          {latestPriceQuery.error ? <p className="inline-message inline-message-error">{formatErrorMessage(latestPriceQuery.error)}</p> : null}
        </div>
        <div className="symbol-actions">
          <button disabled={refreshMutation.isPending} onClick={() => refreshMutation.mutate()} type="button">
            {refreshMutation.isPending ? "Refreshing" : "Refresh"}
          </button>
          <button type="button">Export</button>
        </div>
      </header>
      {refreshMutation.error ? <p className="inline-message inline-message-error">{formatErrorMessage(refreshMutation.error)}</p> : null}
      {refreshMutation.isSuccess ? <p className="inline-message">Queued price refresh for {detailQuote.symbol}.</p> : null}

      <div className="symbol-detail-grid">
        <section className="panel chart-panel panel-full">
          <div className="panel-heading">
            <h2>Price Chart</h2>
            <TimeRangeControl value={range} onChange={setRange} />
          </div>
          <PricePanelContent
            barsLength={bars.length}
            error={priceError}
            isLoading={priceSeriesQuery.isLoading}
            onRefresh={() => refreshMutation.mutate()}
          >
            <PriceChart bars={bars} />
          </PricePanelContent>
        </section>

        <section className="panel chart-panel panel-full">
          <div className="panel-heading">
            <h2>Volume</h2>
            <span>{range}</span>
          </div>
          <PricePanelContent
            barsLength={bars.length}
            error={priceError}
            isLoading={priceSeriesQuery.isLoading}
            onRefresh={() => refreshMutation.mutate()}
          >
            <VolumeChart bars={bars} />
          </PricePanelContent>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Key Metrics</h2>
            <StatusBadge status={fundamentalsQuery.error ? "failed" : fundamentals?.status ?? "missing"} />
          </div>
          {fundamentalsQuery.isLoading ? (
            <EmptyState compact title="Loading metrics" description="Fetching local fundamentals snapshot." />
          ) : fundamentalsQuery.error ? (
            <EmptyState compact title="Metrics unavailable" description={formatErrorMessage(fundamentalsQuery.error)} />
          ) : (
            <MetricGrid items={buildMetricItems(fundamentals, fundamentalsCurrency)} />
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Financial Summary</h2>
            <span>{fundamentals?.lastFetchAt ? formatDateTime(fundamentals.lastFetchAt) : "Not fetched"}</span>
          </div>
          {fundamentalsQuery.isLoading ? (
            <EmptyState compact title="Loading summary" description="Fetching latest financial statement facts." />
          ) : fundamentalsQuery.error ? (
            <EmptyState compact title="Summary unavailable" description={formatErrorMessage(fundamentalsQuery.error)} />
          ) : (
            <MetricGrid items={buildFinancialItems(fundamentals, fundamentalsCurrency)} />
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Corporate Actions</h2>
            <span>{actionsQuery.isLoading ? "Loading" : `${actions.length} events`}</span>
          </div>
          {actionsQuery.isLoading ? (
            <EmptyState compact title="Loading events" description="Fetching dividends and split history." />
          ) : actionsQuery.error ? (
            <EmptyState compact title="Events unavailable" description={formatErrorMessage(actionsQuery.error)} />
          ) : (
            <CorporateActionList actions={actions} currency={fundamentalsCurrency} />
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Data Status</h2>
            <Link to="/jobs">Open Jobs</Link>
          </div>
          {dataStatusQuery.error ? (
            <EmptyState compact title="Status unavailable" description={formatErrorMessage(dataStatusQuery.error)} />
          ) : (
            <DataStatusList quote={detailQuote} statuses={statuses} />
          )}
        </section>
      </div>
    </section>
  );
}

function PricePanelContent({
  barsLength,
  children,
  error,
  isLoading,
  onRefresh
}: {
  barsLength: number;
  children: ReactNode;
  error: unknown;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return <EmptyState title="Loading price data" description="Fetching local price bars for this range." />;
  }

  if (error) {
    return <EmptyState title="Price data unavailable" description={formatErrorMessage(error)} />;
  }

  if (barsLength === 0) {
    return (
      <div className="empty-state">
        <strong>No price data</strong>
        <p>Run a price update to populate this chart.</p>
        <button className="primary-action" onClick={onRefresh} type="button">Update Prices</button>
      </div>
    );
  }

  return children;
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

function formatCompactCurrency(value: number | null, currency: string) {
  if (value === null) {
    return "-";
  }

  if (!currency) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      notation: "compact"
    }).format(value);
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

function formatErrorMessage(error: unknown) {
  if (isApiError(error)) {
    return error.status === 0 ? error.message : `${error.message} (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The request could not be completed.";
}
