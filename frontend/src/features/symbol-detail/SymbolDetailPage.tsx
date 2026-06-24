import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { useCorporateActionsQuery } from "../../api/actions";
import { isApiError } from "../../api/client";
import { useFundamentalsQuery } from "../../api/fundamentals";
import { createPriceFetchJob, jobsQueryKeys } from "../../api/jobs";
import { useDataStatusQuery, marketQueryKeys } from "../../api/market";
import { exportPricesCsv, pricesQueryKeys, useLatestPriceQuery, usePriceSeriesQuery } from "../../api/prices";
import { symbolsQueryKeys, useSymbolsQuery } from "../../api/symbols";
import type { CorporateAction, DataStatusRecord, FundamentalSnapshot, SymbolQuote } from "../../api/types";
import { PriceChart } from "../../charts/PriceChart";
import { VolumeChart } from "../../charts/VolumeChart";
import { StatusBadge } from "../../components/StatusBadge";
import { TimeRangeControl, type TimeRange } from "../../components/TimeRangeControl";
import {
  formatAssetType,
  formatCompactCurrency,
  formatCurrency,
  formatDataType,
  formatDateTime,
  formatFieldLabel,
  formatNumber,
  formatPercent,
  type AppCopy,
  type Locale,
  useI18n
} from "../../i18n";

const rangeMap: Record<TimeRange, string> = {
  "1D": "1d",
  "1M": "1mo",
  "3M": "3mo",
  "1Y": "1y",
  "5Y": "5y",
  MAX: "max"
};

export function SymbolDetailPage() {
  const { copy, locale } = useI18n();
  const t = copy.symbolDetail;
  const { symbol: symbolParam } = useParams();
  const symbol = decodeURIComponent(symbolParam ?? "").toUpperCase();
  const [range, setRange] = useState<TimeRange>("1Y");
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
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
      setPageMessage(`${t.queuedPriceRefresh} ${symbol}.`);
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
        <EmptyState title={t.loadingSymbol} description={t.loadingSymbolDescription} />
      </section>
    );
  }

  if (symbolsQuery.error) {
    return (
      <section className="page">
        <EmptyState title={t.symbolUnavailable} description={formatErrorMessage(symbolsQuery.error, copy)} />
      </section>
    );
  }

  if (!detailQuote) {
    return (
      <section className="page">
        <div className="detail-empty">
          <h1>{t.symbolNotFound}</h1>
          <p>{t.symbolNotFoundDescription}</p>
          <Link to="/watchlist">{t.openWatchlist}</Link>
        </div>
      </section>
    );
  }

  const bars = priceSeriesQuery.data?.bars ?? [];
  const priceError = priceSeriesQuery.error;
  const detailSymbol = detailQuote.symbol;
  const fundamentals = fundamentalsQuery.data;
  const fundamentalsCurrency = fundamentals?.currency || detailQuote.currency;
  const actions = actionsQuery.data ?? [];
  const statuses = dataStatusQuery.data ?? [];

  async function exportCurrentPrices() {
    if (bars.length === 0) {
      setPageMessage(t.noPriceDataForRange);
      return;
    }

    setIsExporting(true);
    try {
      await exportPricesCsv(detailSymbol, {
        interval: "1d",
        range: rangeMap[range]
      });
      setPageMessage(`${detailSymbol} ${t.exportedPriceData}`);
    } catch (error) {
      setPageMessage(formatErrorMessage(error, copy));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="page symbol-detail-page">
      <header className="symbol-hero">
        <div>
          <p className="eyebrow">{detailQuote.exchange || t.unknownExchange} · {formatAssetType(detailQuote.assetType, copy)}</p>
          <h1>{detailQuote.symbol} <span>{detailQuote.name || t.unnamedSymbol}</span></h1>
          <div className="symbol-price-line">
            <strong>{formatCurrency(detailQuote.latestPrice, detailQuote.currency, locale)}</strong>
            <ChangeValue value={detailQuote.changePct} />
            <span>{latestPriceQuery.isLoading ? t.loadingLatestPrice : `${copy.common.updated} ${detailQuote.lastUpdate ? formatDateTime(detailQuote.lastUpdate, locale) : copy.common.never}`}</span>
          </div>
          {latestPriceQuery.error ? <p className="inline-message inline-message-error">{formatErrorMessage(latestPriceQuery.error, copy)}</p> : null}
        </div>
        <div className="symbol-actions">
          <button disabled={refreshMutation.isPending} onClick={() => refreshMutation.mutate()} type="button">
            {refreshMutation.isPending ? copy.common.refreshing : copy.common.refresh}
          </button>
          <button disabled={isExporting} onClick={() => void exportCurrentPrices()} type="button">
            {isExporting ? copy.common.exporting : t.exportPriceData}
          </button>
        </div>
      </header>
      {refreshMutation.error ? <p className="inline-message inline-message-error">{formatErrorMessage(refreshMutation.error, copy)}</p> : null}
      {pageMessage ? <p className="inline-message">{pageMessage}</p> : null}

      <div className="symbol-detail-grid">
        <section className="panel chart-panel panel-full">
          <div className="panel-heading">
            <h2>{t.priceChart}</h2>
            <TimeRangeControl value={range} onChange={setRange} />
          </div>
          <PricePanelContent
            barsLength={bars.length}
            copy={copy}
            error={priceError}
            isLoading={priceSeriesQuery.isLoading}
            onRefresh={() => refreshMutation.mutate()}
          >
            <PriceChart bars={bars} seriesLabels={t.chartSeries} />
          </PricePanelContent>
        </section>

        <section className="panel chart-panel panel-full">
          <div className="panel-heading">
            <h2>{t.volume}</h2>
            <span>{range}</span>
          </div>
          <PricePanelContent
            barsLength={bars.length}
            copy={copy}
            error={priceError}
            isLoading={priceSeriesQuery.isLoading}
            onRefresh={() => refreshMutation.mutate()}
          >
            <VolumeChart bars={bars} />
          </PricePanelContent>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>{t.keyMetrics}</h2>
            <StatusBadge status={fundamentalsQuery.error ? "failed" : fundamentals?.status ?? "missing"} />
          </div>
          {fundamentalsQuery.isLoading ? (
            <EmptyState compact title={t.loadingMetrics} description={t.loadingMetricsDescription} />
          ) : fundamentalsQuery.error ? (
            <EmptyState compact title={t.metricsUnavailable} description={formatErrorMessage(fundamentalsQuery.error, copy)} />
          ) : (
            <MetricGrid items={buildMetricItems(fundamentals, fundamentalsCurrency, copy, locale)} />
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>{t.financialSummary}</h2>
            <span>{fundamentals?.lastFetchAt ? formatDateTime(fundamentals.lastFetchAt, locale) : t.notFetched}</span>
          </div>
          {fundamentalsQuery.isLoading ? (
            <EmptyState compact title={t.loadingSummary} description={t.loadingSummaryDescription} />
          ) : fundamentalsQuery.error ? (
            <EmptyState compact title={t.summaryUnavailable} description={formatErrorMessage(fundamentalsQuery.error, copy)} />
          ) : (
            <>
              <MetricGrid items={buildFinancialItems(fundamentals, fundamentalsCurrency, copy, locale)} />
              <MissingFieldsNotice copy={copy} fields={fundamentals?.missingFields ?? []} />
            </>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>{t.corporateActions}</h2>
            <span>{actionsQuery.isLoading ? copy.common.loading : formatEventCount(actions.length, copy, locale)}</span>
          </div>
          {actionsQuery.isLoading ? (
            <EmptyState compact title={t.loadingEvents} description={t.loadingEventsDescription} />
          ) : actionsQuery.error ? (
            <EmptyState compact title={t.eventsUnavailable} description={formatErrorMessage(actionsQuery.error, copy)} />
          ) : (
            <CorporateActionList actions={actions} copy={copy} currency={fundamentalsCurrency} locale={locale} />
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>{t.dataStatus}</h2>
            <Link to="/jobs">{copy.dashboard.openJobs}</Link>
          </div>
          {dataStatusQuery.error ? (
            <EmptyState compact title={t.statusUnavailable} description={formatErrorMessage(dataStatusQuery.error, copy)} />
          ) : (
            <DataStatusList copy={copy} quote={detailQuote} statuses={statuses} />
          )}
        </section>
      </div>
    </section>
  );
}

function PricePanelContent({
  barsLength,
  children,
  copy,
  error,
  isLoading,
  onRefresh
}: {
  barsLength: number;
  children: ReactNode;
  copy: AppCopy;
  error: unknown;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return <EmptyState title={copy.symbolDetail.loadingPriceData} description={copy.symbolDetail.loadingPriceDataDescription} />;
  }

  if (error) {
    return <EmptyState title={copy.symbolDetail.priceDataUnavailable} description={formatErrorMessage(error, copy)} />;
  }

  if (barsLength === 0) {
    return (
      <div className="empty-state">
        <strong>{copy.symbolDetail.noPriceData}</strong>
        <p>{copy.symbolDetail.noPriceDataDescription}</p>
        <button className="primary-action" onClick={onRefresh} type="button">{copy.common.updatePrices}</button>
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

function CorporateActionList({ actions, copy, currency, locale }: { actions: CorporateAction[]; copy: AppCopy; currency: string; locale: Locale }) {
  if (actions.length === 0) {
    return <EmptyState compact title={copy.symbolDetail.noEvents} description={copy.symbolDetail.noEventsDescription} />;
  }

  return (
    <div className="action-list">
      {actions.map((action) => (
        <div className="action-row" key={`${action.symbol}-${action.actionType}-${action.exDate}`}>
          <span>
            <strong>{action.actionType === "dividend" ? copy.symbolDetail.dividend : copy.symbolDetail.split}</strong>
            <small>{action.exDate}</small>
          </span>
          <span>{action.actionType === "dividend" ? formatCurrency(action.value, currency, locale) : `${action.value}:1`}</span>
        </div>
      ))}
    </div>
  );
}

function MissingFieldsNotice({ copy, fields }: { copy: AppCopy; fields: string[] }) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <p className="panel-note">
      {copy.symbolDetail.missingFields}: {fields.map((field) => formatFieldLabel(field, copy)).join(", ")}
    </p>
  );
}

function DataStatusList({ copy, quote, statuses }: { copy: AppCopy; quote: SymbolQuote; statuses: DataStatusRecord[] }) {
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
            lastError: quote.status === "failed" ? copy.symbolDetail.latestPriceUpdateFailed : null
          }
        ];

  return (
    <div className="data-status-list">
      {fallbackStatuses.map((status) => (
        <div className="data-status-row" key={`${status.symbol}-${status.dataType}`}>
          <span>
            <strong>{formatDataType(status.dataType, copy)}</strong>
            <small>{status.lastDataAt ? `${copy.symbolDetail.dataThrough} ${status.lastDataAt}` : copy.symbolDetail.noLocalData}</small>
          </span>
          <StatusBadge status={status.status} />
        </div>
      ))}
    </div>
  );
}

function buildMetricItems(fundamentals: FundamentalSnapshot | undefined, currency: string, copy: AppCopy, locale: Locale) {
  return [
    { label: copy.symbolDetail.metricLabels.marketCap, value: formatCompactCurrency(fundamentals?.metrics.marketCap ?? null, currency, locale) },
    { label: copy.symbolDetail.metricLabels.trailingPe, value: formatNumber(fundamentals?.metrics.trailingPe ?? null, locale) },
    { label: copy.symbolDetail.metricLabels.priceToBook, value: formatNumber(fundamentals?.metrics.priceToBook ?? null, locale) },
    { label: copy.symbolDetail.metricLabels.dividendYield, value: formatPercent(fundamentals?.metrics.dividendYield ?? null, locale) },
    { label: copy.symbolDetail.metricLabels.fiftyTwoWeekHigh, value: formatCurrency(fundamentals?.metrics.fiftyTwoWeekHigh ?? null, currency, locale) },
    { label: copy.symbolDetail.metricLabels.fiftyTwoWeekLow, value: formatCurrency(fundamentals?.metrics.fiftyTwoWeekLow ?? null, currency, locale) }
  ];
}

function buildFinancialItems(fundamentals: FundamentalSnapshot | undefined, currency: string, copy: AppCopy, locale: Locale) {
  return [
    { label: copy.symbolDetail.metricLabels.revenue, value: formatCompactCurrency(fundamentals?.financialSummary.revenue ?? null, currency, locale) },
    { label: copy.symbolDetail.metricLabels.netIncome, value: formatCompactCurrency(fundamentals?.financialSummary.netIncome ?? null, currency, locale) },
    { label: copy.symbolDetail.metricLabels.freeCashFlow, value: formatCompactCurrency(fundamentals?.financialSummary.freeCashFlow ?? null, currency, locale) },
    { label: copy.symbolDetail.metricLabels.debtRatio, value: formatPercent(fundamentals?.financialSummary.debtRatio ?? null, locale) }
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

function formatEventCount(value: number, copy: AppCopy, locale: Locale) {
  return locale === "zh" ? `${value} ${copy.symbolDetail.events}` : `${value} event${value === 1 ? "" : "s"}`;
}

function formatErrorMessage(error: unknown, copy: AppCopy) {
  if (isApiError(error)) {
    return error.status === 0 ? error.message : `${error.message} (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return copy.common.unknownRequestError;
}
