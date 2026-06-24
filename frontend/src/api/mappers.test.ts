import { describe, expect, it } from "vitest";

import { mapCorporateAction } from "./actions";
import { mapFundamentalSnapshot } from "./fundamentals";
import { mapFetchJob } from "./jobs";
import { mapDataStatusRecord, mapMarketOverview } from "./market";
import { mapLatestPrice, mapPriceSeries } from "./prices";
import { mapSymbol } from "./symbols";

describe("API mappers", () => {
  it("maps symbol records into dashboard-friendly quotes", () => {
    expect(
      mapSymbol({
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        asset_type: "equity",
        currency: "USD",
        group_name: "Core",
        enabled: true,
        status: "fresh",
        last_data_at: "2026-06-23T16:00:00Z",
        last_fetch_at: "2026-06-23T16:05:00Z",
        created_at: "2026-06-20T10:00:00Z",
        updated_at: "2026-06-23T16:05:00Z"
      })
    ).toMatchObject({
      assetType: "equity",
      groupName: "Core",
      lastUpdate: "2026-06-23T16:00:00Z",
      latestPrice: null,
      status: "fresh"
    });
  });

  it("maps price series bars and latest prices", () => {
    expect(
      mapPriceSeries({
        symbol: "MSFT",
        interval: "1d",
        range: "1mo",
        status: "ok",
        bars: [
          {
            timestamp: "2026-06-23T00:00:00Z",
            open: 100,
            high: 105,
            low: 99,
            close: 104,
            adj_close: 104,
            volume: 1200
          }
        ]
      }).bars[0]
    ).toMatchObject({
      adjClose: 104,
      interval: "1d",
      symbol: "MSFT"
    });

    expect(
      mapLatestPrice({
        symbol: "MSFT",
        interval: "1d",
        status: "ok",
        latest_data_at: "2026-06-23T00:00:00Z",
        latest_price: 104,
        change: 2,
        change_percent: 1.96,
        volume: 1200
      })
    ).toMatchObject({
      changePct: 1.96,
      latestDataAt: "2026-06-23T00:00:00Z",
      latestPrice: 104
    });
  });

  it("maps jobs and falls back to item symbols when params omit symbols", () => {
    expect(
      mapFetchJob({
        id: "job_1",
        job_type: "prices",
        status: "success",
        params: {},
        progress_total: 1,
        progress_done: 1,
        error_summary: null,
        created_at: "2026-06-23T10:00:00Z",
        started_at: "2026-06-23T10:00:01Z",
        finished_at: "2026-06-23T10:00:03Z",
        items: [
          {
            id: "item_1",
            job_id: "job_1",
            symbol: "NVDA",
            status: "skipped",
            error_type: null,
            error_message: null,
            started_at: null,
            finished_at: null
          }
        ]
      })
    ).toMatchObject({
      finishedAt: "2026-06-23T10:00:03Z",
      symbols: ["NVDA"],
      items: [{ jobId: "job_1", status: "skipped" }]
    });
  });

  it("maps fundamental snapshots", () => {
    expect(
      mapFundamentalSnapshot({
        symbol: "AAPL",
        currency: "USD",
        metrics: {
          market_cap: 3_000_000_000,
          trailing_pe: 30.5,
          price_to_book: 12.2,
          dividend_yield: 0.006,
          fifty_two_week_high: 199,
          fifty_two_week_low: 124
        },
        financial_summary: {
          revenue: 1000,
          net_income: 200,
          free_cash_flow: 220,
          debt_ratio: 0.24
        },
        missing_fields: ["price_to_book"],
        last_fetch_at: "2026-06-23T10:00:00Z",
        status: "fresh"
      })
    ).toMatchObject({
      currency: "USD",
      metrics: {
        marketCap: 3_000_000_000,
        trailingPe: 30.5
      },
      financialSummary: {
        freeCashFlow: 220,
        debtRatio: 0.24
      },
      missingFields: ["price_to_book"],
      lastFetchAt: "2026-06-23T10:00:00Z"
    });
  });

  it("maps corporate actions", () => {
    expect(
      mapCorporateAction({
        symbol: "AAPL",
        action_type: "dividend",
        ex_date: "2026-02-10",
        value: 0.26
      })
    ).toMatchObject({
      actionType: "dividend",
      exDate: "2026-02-10",
      symbol: "AAPL",
      value: 0.26
    });
  });

  it("maps data status records", () => {
    expect(
      mapDataStatusRecord({
        symbol: "SPY",
        data_type: "prices",
        status: "stale",
        last_data_at: "2026-06-20T00:00:00Z",
        last_fetch_at: "2026-06-23T00:00:00Z",
        last_success_at: "2026-06-23T00:00:00Z",
        last_error: null,
        updated_at: "2026-06-23T00:00:00Z"
      })
    ).toMatchObject({
      dataType: "prices",
      lastDataAt: "2026-06-20T00:00:00Z",
      status: "stale",
      updatedAt: "2026-06-23T00:00:00Z"
    });
  });

  it("maps market overview records", () => {
    expect(
      mapMarketOverview({
        last_update_at: "2026-06-23T20:00:00Z",
        indices: [],
        watchlist: [
          {
            symbol: "AAPL",
            name: "Apple Inc.",
            exchange: "NASDAQ",
            asset_type: "equity",
            currency: "USD",
            group_name: "Core",
            enabled: true,
            status: "fresh",
            last_data_at: "2026-06-23T00:00:00Z",
            last_fetch_at: "2026-06-23T20:00:00Z",
            created_at: "2026-06-20T00:00:00Z",
            updated_at: "2026-06-23T20:00:00Z",
            latest_data_at: "2026-06-23T00:00:00Z",
            latest_price: 210,
            change: 3,
            change_percent: 1.45,
            volume: 1000
          }
        ],
        top_gainers: [],
        top_losers: [],
        freshness: {
          fresh: 1,
          stale: 0,
          missing: 0,
          failed: 0,
          partial: 0
        },
        freshness_by_type: {
          prices: {
            fresh: 1,
            stale: 0,
            missing: 0,
            failed: 0,
            partial: 0
          },
          metadata: {
            fresh: 0,
            stale: 0,
            missing: 1,
            failed: 0,
            partial: 0
          },
          fundamentals: {
            fresh: 0,
            stale: 1,
            missing: 0,
            failed: 0,
            partial: 0
          },
          actions: {
            fresh: 0,
            stale: 0,
            missing: 0,
            failed: 1,
            partial: 0
          }
        },
        recent_jobs: []
      })
    ).toMatchObject({
      lastUpdateAt: "2026-06-23T20:00:00Z",
      freshness: { fresh: 1 },
      freshnessByType: {
        actions: { failed: 1 }
      },
      watchlist: [
        {
          changePct: 1.45,
          latestPrice: 210,
          symbol: "AAPL"
        }
      ]
    });
  });
});
