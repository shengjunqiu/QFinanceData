import { describe, expect, it } from "vitest";

import type { DataStatusRecord, FetchJob, LatestPrice, SymbolQuote } from "../../api/types";
import { buildDashboardSummary } from "./dashboardData";

const symbols: SymbolQuote[] = [
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF",
    exchange: "NYSE",
    assetType: "etf",
    currency: "USD",
    groupName: "Core",
    latestPrice: null,
    change: null,
    changePct: null,
    volume: null,
    lastUpdate: null,
    status: "missing"
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    exchange: "NASDAQ",
    assetType: "equity",
    currency: "USD",
    groupName: "Core",
    latestPrice: null,
    change: null,
    changePct: null,
    volume: null,
    lastUpdate: null,
    status: "missing"
  },
  {
    symbol: "AAPL",
    name: "Apple",
    exchange: "NASDAQ",
    assetType: "equity",
    currency: "USD",
    groupName: "Core",
    latestPrice: null,
    change: null,
    changePct: null,
    volume: null,
    lastUpdate: null,
    status: "missing"
  }
];

const latestPrices: LatestPrice[] = [
  {
    symbol: "SPY",
    interval: "1d",
    status: "ok",
    latestDataAt: "2026-06-23T20:00:00Z",
    latestPrice: 540,
    change: 2,
    changePct: 0.37,
    volume: 100
  },
  {
    symbol: "NVDA",
    interval: "1d",
    status: "ok",
    latestDataAt: "2026-06-23T20:05:00Z",
    latestPrice: 150,
    change: 6,
    changePct: 4.17,
    volume: 200
  },
  {
    symbol: "AAPL",
    interval: "1d",
    status: "ok",
    latestDataAt: "2026-06-23T19:55:00Z",
    latestPrice: 190,
    change: -3,
    changePct: -1.55,
    volume: 300
  }
];

describe("buildDashboardSummary", () => {
  it("merges latest prices and price data status into watchlist rows", () => {
    const dataStatusRecords: DataStatusRecord[] = [
      {
        symbol: "NVDA",
        dataType: "prices",
        status: "stale",
        lastDataAt: "2026-06-21T20:00:00Z",
        lastFetchAt: "2026-06-23T20:10:00Z",
        lastSuccessAt: "2026-06-21T20:00:00Z",
        lastError: "market closed"
      }
    ];

    const summary = buildDashboardSummary({
      symbols,
      latestPrices,
      dataStatusRecords,
      recentJobs: [],
      trendSeries: []
    });

    expect(summary.watchlist.find((quote) => quote.symbol === "NVDA")).toMatchObject({
      latestPrice: 150,
      changePct: 4.17,
      status: "stale"
    });
    expect(summary.topGainers[0].symbol).toBe("NVDA");
    expect(summary.topLosers[0].symbol).toBe("AAPL");
    expect(summary.marketIndices[0].symbol).toBe("SPY");
  });

  it("falls back to symbol status counts when no data status records exist", () => {
    const summary = buildDashboardSummary({
      symbols,
      latestPrices: [],
      dataStatusRecords: [],
      recentJobs: [buildJob("job_1", "2026-06-23T21:00:00Z")],
      trendSeries: []
    });

    expect(summary.freshness).toMatchObject({
      failed: 0,
      fresh: 0,
      missing: 3,
      partial: 0,
      stale: 0
    });
    expect(summary.lastUpdateAt).toBe("2026-06-23T21:00:00Z");
  });
});

function buildJob(id: string, createdAt: string): FetchJob {
  return {
    id,
    type: "prices",
    symbols: ["SPY"],
    status: "success",
    progressTotal: 1,
    progressDone: 1,
    createdAt,
    items: []
  };
}
