import { describe, expect, it } from "vitest";

import { mockDashboardSummary, mockDataStatus, mockJobs, mockPriceBars, mockWatchlist } from "./mockData";

describe("mockData", () => {
  it("covers all user-visible data statuses", () => {
    const statuses = new Set([
      ...mockWatchlist.map((symbol) => symbol.status),
      ...mockDataStatus.map((record) => record.status)
    ]);

    expect(statuses).toEqual(new Set(["fresh", "stale", "missing", "failed", "partial"]));
  });

  it("covers core fetch job statuses used by the Jobs page", () => {
    const statuses = new Set(mockJobs.map((job) => job.status));

    expect(statuses).toEqual(new Set(["queued", "running", "success", "partial_success", "failed"]));
  });

  it("generates more than one year of daily price bars", () => {
    expect(mockPriceBars.length).toBeGreaterThan(252);
  });

  it("derives dashboard movers in sorted order", () => {
    const gainers = mockDashboardSummary.topGainers.map((quote) => quote.changePct ?? 0);
    const losers = mockDashboardSummary.topLosers.map((quote) => quote.changePct ?? 0);

    expect(gainers).toEqual([...gainers].sort((a, b) => b - a));
    expect(losers).toEqual([...losers].sort((a, b) => a - b));
  });

  it("counts freshness statuses from data status records", () => {
    const expectedCounts = mockDataStatus.reduce(
      (counts, record) => ({
        ...counts,
        [record.status]: counts[record.status] + 1
      }),
      {
        fresh: 0,
        stale: 0,
        missing: 0,
        failed: 0,
        partial: 0
      }
    );

    expect(mockDashboardSummary.freshness).toEqual(expectedCounts);
  });
});
