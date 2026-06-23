import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { mockWatchlist } from "../../api/mockData";
import type { DataStatus, SymbolQuote } from "../../api/types";

const statusLabels: Record<DataStatus, string> = {
  fresh: "Fresh",
  stale: "Stale",
  missing: "Missing",
  failed: "Failed",
  partial: "Partial"
};

export function WatchlistPage() {
  const [symbols, setSymbols] = useState<SymbolQuote[]>(mockWatchlist);
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
  const [tickerInput, setTickerInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const groups = useMemo(() => ["All", ...Array.from(new Set(symbols.map((symbol) => symbol.groupName)))], [symbols]);
  const visibleSymbols = useMemo(
    () => symbols.filter((symbol) => selectedGroup === "All" || symbol.groupName === selectedGroup),
    [selectedGroup, symbols]
  );
  const allVisibleSelected = visibleSymbols.length > 0 && visibleSymbols.every((symbol) => selectedSymbols.has(symbol.symbol));

  function handleAddSymbol(event: FormEvent<HTMLFormElement>) {
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

    const newSymbol: SymbolQuote = {
      symbol: ticker,
      name: "Pending metadata",
      exchange: "Unknown",
      assetType: "equity",
      currency: "USD",
      groupName: selectedGroup === "All" ? "US Stocks" : selectedGroup,
      latestPrice: null,
      change: null,
      changePct: null,
      volume: null,
      lastUpdate: null,
      status: "missing"
    };

    setSymbols((current) => [newSymbol, ...current]);
    setSelectedSymbols((current) => new Set(current).add(ticker));
    setTickerInput("");
    setMessage(`${ticker} added. Run an update to fetch price data.`);
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

  function deleteSymbol(symbol: string) {
    setSymbols((current) => current.filter((item) => item.symbol !== symbol));
    setSelectedSymbols((current) => {
      const next = new Set(current);
      next.delete(symbol);
      return next;
    });
    setMessage(`${symbol} removed from Watchlist. Historical data is not deleted.`);
  }

  function updateSelectedSymbols() {
    if (selectedSymbols.size === 0) {
      setMessage("Select at least one ticker before starting an update.");
      return;
    }

    setMessage(`Queued price update for ${selectedSymbols.size} selected ticker${selectedSymbols.size > 1 ? "s" : ""}.`);
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Symbol Management</p>
          <h1>Watchlist</h1>
        </div>
        <button className="primary-action" onClick={updateSelectedSymbols} type="button">
          Update Selected
        </button>
      </div>

      <section className="watchlist-toolbar" aria-label="Watchlist controls">
        <form className="add-symbol-form" onSubmit={handleAddSymbol}>
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
          <button type="submit">Add</button>
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

      <section className="panel watchlist-management-panel">
        <div className="panel-heading">
          <h2>{selectedGroup} Symbols</h2>
          <span>{visibleSymbols.length} shown · {selectedSymbols.size} selected</span>
        </div>

        {visibleSymbols.length === 0 ? (
          <div className="empty-state">
            <strong>No symbols in this group</strong>
            <p>Add a ticker or switch to another group.</p>
          </div>
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
                    <small>{symbol.name}</small>
                  </Link>
                </span>
                <span>{formatAssetType(symbol.assetType)}</span>
                <span>{symbol.currency}</span>
                <span>{symbol.lastUpdate ?? "Never"}</span>
                <span>
                  <StatusBadge status={symbol.status} />
                </span>
                <span>
                  <button className="text-action danger-action" onClick={() => deleteSymbol(symbol.symbol)} type="button">
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

function StatusBadge({ status }: { status: DataStatus }) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>;
}

function formatAssetType(value: SymbolQuote["assetType"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
