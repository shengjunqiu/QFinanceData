import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/client";
import { useCreatePriceFetchJobMutation } from "../../api/jobs";
import {
  exportSymbolsCsv,
  useCreateSymbolMutation,
  useDeleteSymbolMutation,
  useSymbolsQuery,
  useUpdateSymbolMutation
} from "../../api/symbols";
import type { SymbolQuote } from "../../api/types";
import { StatusBadge } from "../../components/StatusBadge";
import { formatAssetType, formatDateTime, type AppCopy, type Locale, useI18n } from "../../i18n";

export function WatchlistPage() {
  const { copy, locale } = useI18n();
  const t = copy.watchlist;
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
  const [tickerInput, setTickerInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const symbolsQuery = useSymbolsQuery({ includeDisabled: true });
  const createSymbolMutation = useCreateSymbolMutation();
  const updateSymbolMutation = useUpdateSymbolMutation();
  const deleteSymbolMutation = useDeleteSymbolMutation();
  const createPriceFetchJobMutation = useCreatePriceFetchJobMutation();
  const symbols = symbolsQuery.data ?? [];
  const isMutating =
    createSymbolMutation.isPending ||
    updateSymbolMutation.isPending ||
    deleteSymbolMutation.isPending ||
    createPriceFetchJobMutation.isPending ||
    isExporting;
  const mutationError =
    createSymbolMutation.error ??
    updateSymbolMutation.error ??
    deleteSymbolMutation.error ??
    createPriceFetchJobMutation.error ??
    null;

  const groups = useMemo(() => ["All", ...Array.from(new Set(symbols.map((symbol) => symbol.groupName)))], [symbols]);
  const visibleSymbols = useMemo(
    () => symbols.filter((symbol) => selectedGroup === "All" || symbol.groupName === selectedGroup),
    [selectedGroup, symbols]
  );
  const allVisibleSelected = visibleSymbols.length > 0 && visibleSymbols.every((symbol) => selectedSymbols.has(symbol.symbol));

  async function handleAddSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ticker = tickerInput.trim().toUpperCase();

    if (!ticker) {
      setMessage(t.enterTicker);
      return;
    }

    if (symbols.some((symbol) => symbol.symbol === ticker)) {
      setMessage(`${ticker} ${t.alreadyInWatchlist}`);
      return;
    }

    try {
      const created = await createSymbolMutation.mutateAsync({
        symbol: ticker,
        groupName: selectedGroup === "All" ? undefined : selectedGroup
      });
      setSelectedSymbols((current) => new Set(current).add(created.symbol));
      setTickerInput("");
      setMessage(`${created.symbol} ${t.tickerAddedSuffix}`);
    } catch (error) {
      setMessage(formatErrorMessage(error, copy));
    }
  }

  function toggleSymbol(symbol: string) {
    setSelectedSymbols((current) => {
      const next = new Set(current);

      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }

      return next;
    });
  }

  function toggleVisibleSymbols() {
    setSelectedSymbols((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        visibleSymbols.forEach((symbol) => next.delete(symbol.symbol));
      } else {
        visibleSymbols.forEach((symbol) => next.add(symbol.symbol));
      }

      return next;
    });
  }

  async function removeSymbol(symbol: string) {
    try {
      await deleteSymbolMutation.mutateAsync(symbol);
      setSelectedSymbols((current) => {
        const next = new Set(current);
        next.delete(symbol);
        return next;
      });
      setMessage(`${symbol} ${t.removedSuffix}`);
    } catch (error) {
      setMessage(formatErrorMessage(error, copy));
    }
  }

  async function updateGroup(symbol: string, groupName: string) {
    const nextGroup = groupName.trim();
    if (!nextGroup) {
      setMessage(t.groupNameEmpty);
      return;
    }

    try {
      await updateSymbolMutation.mutateAsync({
        symbol,
        input: {
          groupName: nextGroup
        }
      });
      setMessage(`${symbol} ${t.movedTo} ${nextGroup}.`);
    } catch (error) {
      setMessage(formatErrorMessage(error, copy));
    }
  }

  async function toggleEnabled(symbol: SymbolQuote) {
    try {
      await updateSymbolMutation.mutateAsync({
        symbol: symbol.symbol,
        input: {
          enabled: !(symbol.enabled ?? true)
        }
      });
      setMessage(`${symbol.symbol} ${symbol.enabled ?? true ? t.disabledMessage : t.enabledMessage}`);
    } catch (error) {
      setMessage(formatErrorMessage(error, copy));
    }
  }

  async function updateSelectedSymbols() {
    if (selectedSymbols.size === 0) {
      setMessage(t.selectAtLeastOne);
      return;
    }

    try {
      await createPriceFetchJobMutation.mutateAsync({
        interval: "1d",
        symbols: Array.from(selectedSymbols)
      });
      setMessage(formatQueuedPriceMessage(selectedSymbols.size, copy, locale));
    } catch (error) {
      setMessage(formatErrorMessage(error, copy));
    }
  }

  async function exportVisibleSymbols() {
    if (visibleSymbols.length === 0) {
      setMessage(t.exportEmpty);
      return;
    }

    setIsExporting(true);
    try {
      await exportSymbolsCsv({
        includeDisabled: true,
        groupName: selectedGroup === "All" ? undefined : selectedGroup
      });
      setMessage(formatExportedMessage(visibleSymbols.length, copy, locale));
    } catch (error) {
      setMessage(formatErrorMessage(error, copy));
    } finally {
      setIsExporting(false);
    }
  }

  if (symbolsQuery.isLoading) {
    return (
      <section className="page">
        <EmptyState title={t.loadingTitle} description={t.fetchingSymbols} />
      </section>
    );
  }

  if (symbolsQuery.error) {
    return (
      <section className="page">
        <EmptyState title={t.unavailableTitle} description={formatErrorMessage(symbolsQuery.error, copy)} />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t.headerEyebrow}</p>
          <h1>{t.title}</h1>
        </div>
        <div className="page-actions">
          <button disabled={isMutating} onClick={() => void exportVisibleSymbols()} type="button">
            {isExporting ? copy.common.exporting : copy.common.exportCsv}
          </button>
          <button className="primary-action" disabled={isMutating} onClick={() => void updateSelectedSymbols()} type="button">
            {createPriceFetchJobMutation.isPending ? t.queueing : t.updateSelected}
          </button>
        </div>
      </div>

      <section className="watchlist-toolbar" aria-label={t.watchlistControls}>
        <form className="add-symbol-form" onSubmit={(event) => void handleAddSymbol(event)}>
          <label className="visually-hidden" htmlFor="watchlist-ticker">
            {t.addTicker}
          </label>
          <input
            autoComplete="off"
            id="watchlist-ticker"
            onChange={(event) => setTickerInput(event.target.value)}
            placeholder={t.addTickerPlaceholder}
            value={tickerInput}
          />
          <button disabled={createSymbolMutation.isPending} type="submit">
            {createSymbolMutation.isPending ? copy.common.adding : copy.common.add}
          </button>
        </form>

        <div className="group-tabs" aria-label={t.watchlistGroups}>
          {groups.map((group) => (
            <button
              aria-pressed={selectedGroup === group}
              className={selectedGroup === group ? "group-tab group-tab-active" : "group-tab"}
              key={group}
              onClick={() => setSelectedGroup(group)}
              type="button"
            >
              {formatGroupName(group, copy)}
            </button>
          ))}
        </div>
      </section>

      {message ? <p className="inline-message">{message}</p> : null}
      {mutationError ? <p className="inline-message inline-message-error">{formatErrorMessage(mutationError, copy)}</p> : null}

      <section className="panel watchlist-management-panel">
        <div className="panel-heading">
          <h2>{formatGroupTitle(selectedGroup, copy)}</h2>
          <span>{formatSelectionSummary(visibleSymbols.length, selectedSymbols.size, copy, locale)}</span>
        </div>

        {visibleSymbols.length === 0 ? (
          <EmptyState title={t.emptyGroupTitle} description={t.emptyGroupDescription} />
        ) : (
          <div className="watchlist-management-table" role="table" aria-label={t.managementLabel}>
            <div className="watchlist-management-row watchlist-management-header" role="row">
              <span>
                <input
                  aria-label={t.selectVisibleSymbols}
                  checked={allVisibleSelected}
                  onChange={toggleVisibleSymbols}
                  type="checkbox"
                />
              </span>
              <span>{copy.common.symbol}</span>
              <span>{copy.common.type}</span>
              <span>{copy.common.currency}</span>
              <span>{copy.common.group}</span>
              <span>{copy.common.enabled}</span>
              <span>{copy.common.lastUpdate}</span>
              <span>{copy.common.status}</span>
              <span />
            </div>

            {visibleSymbols.map((symbol) => (
              <div className="watchlist-management-row" key={symbol.symbol} role="row">
                <span>
                  <input
                    aria-label={`${copy.common.select} ${symbol.symbol}`}
                    checked={selectedSymbols.has(symbol.symbol)}
                    onChange={() => toggleSymbol(symbol.symbol)}
                    type="checkbox"
                  />
                </span>
                <span>
                  <Link className="symbol-link" to={`/symbols/${symbol.symbol}`}>
                    <strong>{symbol.symbol}</strong>
                    <small>{symbol.name || t.pendingMetadata}</small>
                  </Link>
                </span>
                <span>{formatAssetType(symbol.assetType, copy)}</span>
                <span>{symbol.currency || "-"}</span>
                <span>
                  <input
                    aria-label={`${copy.common.group} ${symbol.symbol}`}
                    className="table-input"
                    defaultValue={symbol.groupName}
                    disabled={updateSymbolMutation.isPending}
                    key={`${symbol.symbol}-${symbol.groupName}`}
                    onBlur={(event) => {
                      if (event.currentTarget.value !== symbol.groupName) {
                        void updateGroup(symbol.symbol, event.currentTarget.value);
                      }
                    }}
                  />
                </span>
                <span>
                  <input
                    aria-label={`${copy.common.enabled} ${symbol.symbol}`}
                    checked={symbol.enabled ?? true}
                    disabled={updateSymbolMutation.isPending}
                    onChange={() => void toggleEnabled(symbol)}
                    type="checkbox"
                  />
                </span>
                <span>{symbol.lastUpdate ? formatDateTime(symbol.lastUpdate, locale) : copy.common.never}</span>
                <span>
                  <StatusBadge status={symbol.status} />
                </span>
                <span>
                  <button
                    className="text-action danger-action"
                    disabled={deleteSymbolMutation.isPending}
                    onClick={() => void removeSymbol(symbol.symbol)}
                    type="button"
                  >
                    {copy.common.remove}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function formatGroupName(group: string, copy: AppCopy) {
  return group === "All" ? copy.common.all : group;
}

function formatGroupTitle(group: string, copy: AppCopy) {
  return group === "All" && copy.common.all === "全部" ? `${copy.common.all}${copy.common.symbols}` : `${formatGroupName(group, copy)} ${copy.common.symbols}`;
}

function formatSelectionSummary(visibleCount: number, selectedCount: number, copy: AppCopy, locale: Locale) {
  return locale === "zh"
    ? `${copy.watchlist.shown} ${visibleCount} 个 · ${copy.watchlist.selected} ${selectedCount} 个`
    : `${visibleCount} ${copy.watchlist.shown} · ${selectedCount} ${copy.watchlist.selected}`;
}

function formatQueuedPriceMessage(count: number, copy: AppCopy, locale: Locale) {
  if (locale === "zh") {
    return `${copy.watchlist.queuedPricePrefix}${count} 个已选 ticker。`;
  }

  return `${copy.watchlist.queuedPricePrefix} ${count} selected ticker${count === 1 ? "" : "s"}.`;
}

function formatExportedMessage(count: number, copy: AppCopy, locale: Locale) {
  if (locale === "zh") {
    return `${copy.watchlist.exportedPrefix} ${count} 个标的。`;
  }

  return `${copy.watchlist.exportedPrefix} ${count} symbol${count === 1 ? "" : "s"}.`;
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
