import { describe, expect, it } from "vitest";

import { mapFetchJob } from "./jobs";
import { mapDataStatusRecord } from "./market";
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
});
