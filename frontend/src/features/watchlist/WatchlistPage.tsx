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

export function WatchlistPage() {
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
      setMessage("Enter a ticker before adding it.");
      return;
    }

    if (symbols.some((symbol) => symbol.symbol === ticker)) {
      setMessage(`${ticker} is already in the watchlist.`);
      return;
    }

    try {
      const created = await createSymbolMutation.mutateAsync({
        symbol: ticker,
        groupName: selectedGroup === "All" ? undefined : selectedGroup
      });
      setSelectedSymbols((current) => new Set(current).add(created.symbol));
      setTickerInput("");
      setMessage(`${created.symbol} added. Run an update to fetch price data.`);
    } catch (error) {
      setMessage(formatErrorMessage(error));
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
      setMessage(`${symbol} removed from Watchlist. Historical data is not deleted.`);
    } catch (error) {
      setMessage(formatErrorMessage(error));
    }
  }

  async function updateGroup(symbol: string, groupName: string) {
    const nextGroup = groupName.trim();
    if (!nextGroup) {
      setMessage("Group name cannot be empty.");
      return;
    }

    try {
      await updateSymbolMutation.mutateAsync({
        symbol,
        input: {
          groupName: nextGroup
        }
      });
      setMessage(`${symbol} moved to ${nextGroup}.`);
    } catch (error) {
      setMessage(formatErrorMessage(error));
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
      setMessage(`${symbol.symbol} ${symbol.enabled ?? true ? "disabled" : "enabled"}.`);
    } catch (error) {
      setMessage(formatErrorMessage(error));
    }
  }

  async function updateSelectedSymbols() {
    if (selectedSymbols.size === 0) {
      setMessage("Select at least one ticker before starting an update.");
      return;
    }

    try {
      await createPriceFetchJobMutation.mutateAsync({
        interval: "1d",
        symbols: Array.from(selectedSymbols)
      });
      setMessage(`Queued price update for ${selectedSymbols.size} selected ticker${selectedSymbols.size > 1 ? "s" : ""}.`);
    } catch (error) {
      setMessage(formatErrorMessage(error));
    }
  }

  async function exportVisibleSymbols() {
    if (visibleSymbols.length === 0) {
      setMessage("No symbols are available to export for the current view.");
      return;
    }

    setIsExporting(true);
    try {
      await exportSymbolsCsv({
        includeDisabled: true,
        groupName: selectedGroup === "All" ? undefined : selectedGroup
      });
      setMessage(`Exported ${visibleSymbols.length} symbol${visibleSymbols.length > 1 ? "s" : ""}.`);
    } catch (error) {
      setMessage(formatErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

  if (symbolsQuery.isLoading) {
    return (
      <section className="page">
        <EmptyState title="Loading watchlist" description="Fetching symbols from the local data store." />
      </section>
    );
  }

  if (symbolsQuery.error) {
    return (
      <section className="page">
        <EmptyState title="Watchlist unavailable" description={formatErrorMessage(symbolsQuery.error)} />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Symbol Management</p>
          <h1>Watchlist</h1>
        </div>
        <div className="page-actions">
          <button disabled={isMutating} onClick={() => void exportVisibleSymbols()} type="button">
            {isExporting ? "Exporting" : "Export CSV"}
          </button>
          <button className="primary-action" disabled={isMutating} onClick={() => void updateSelectedSymbols()} type="button">
            {createPriceFetchJobMutation.isPending ? "Queueing" : "Update Selected"}
          </button>
        </div>
      </div>

      <section className="watchlist-toolbar" aria-label="Watchlist controls">
        <form className="add-symbol-form" onSubmit={(event) => void handleAddSymbol(event)}>
          <label className="visually-hidden" htmlFor="watchlist-ticker">
            Add ticker
          </label>
          <input
            autoComplete="off"
            id="watchlist-ticker"
            onChange={(event) => setTickerInput(event.target.value)}
            placeholder="Add ticker..."
            value={tickerInput}
          />
          <button disabled={createSymbolMutation.isPending} type="submit">
            {createSymbolMutation.isPending ? "Adding" : "Add"}
          </button>
        </form>

        <div className="group-tabs" aria-label="Watchlist groups">
          {groups.map((group) => (
            <button
              aria-pressed={selectedGroup === group}
              className={selectedGroup === group ? "group-tab group-tab-active" : "group-tab"}
              key={group}
              onClick={() => setSelectedGroup(group)}
              type="button"
            >
              {group}
            </button>
          ))}
        </div>
      </section>

      {message ? <p className="inline-message">{message}</p> : null}
      {mutationError ? <p className="inline-message inline-message-error">{formatErrorMessage(mutationError)}</p> : null}

      <section className="panel watchlist-management-panel">
        <div className="panel-heading">
          <h2>{selectedGroup} Symbols</h2>
          <span>{visibleSymbols.length} shown · {selectedSymbols.size} selected</span>
        </div>

        {visibleSymbols.length === 0 ? (
          <EmptyState title="No symbols in this group" description="Add a ticker or switch to another group." />
        ) : (
          <div className="watchlist-management-table" role="table" aria-label="Watchlist management">
            <div className="watchlist-management-row watchlist-management-header" role="row">
              <span>
                <input
                  aria-label="Select visible symbols"
                  checked={allVisibleSelected}
                  onChange={toggleVisibleSymbols}
                  type="checkbox"
                />
              </span>
              <span>Symbol</span>
              <span>Type</span>
              <span>Currency</span>
              <span>Group</span>
              <span>Enabled</span>
              <span>Last Update</span>
              <span>Status</span>
              <span />
            </div>

            {visibleSymbols.map((symbol) => (
              <div className="watchlist-management-row" key={symbol.symbol} role="row">
                <span>
                  <input
                    aria-label={`Select ${symbol.symbol}`}
                    checked={selectedSymbols.has(symbol.symbol)}
                    onChange={() => toggleSymbol(symbol.symbol)}
                    type="checkbox"
                  />
                </span>
                <span>
                  <Link className="symbol-link" to={`/symbols/${symbol.symbol}`}>
                    <strong>{symbol.symbol}</strong>
                    <small>{symbol.name || "Pending metadata"}</small>
                  </Link>
                </span>
                <span>{formatAssetType(symbol.assetType)}</span>
                <span>{symbol.currency || "-"}</span>
                <span>
                  <input
                    aria-label={`Group for ${symbol.symbol}`}
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
                    aria-label={`Enabled ${symbol.symbol}`}
                    checked={symbol.enabled ?? true}
                    disabled={updateSymbolMutation.isPending}
                    onChange={() => void toggleEnabled(symbol)}
                    type="checkbox"
                  />
                </span>
                <span>{symbol.lastUpdate ?? "Never"}</span>
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
                    Remove
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

function formatAssetType(value: SymbolQuote["assetType"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
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
