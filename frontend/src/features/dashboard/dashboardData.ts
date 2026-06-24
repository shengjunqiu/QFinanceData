import type { DataStatus, DataStatusRecord, FetchJob, LatestPrice, PriceBar, SymbolQuote } from "../../api/types";

const freshnessStatuses: DataStatus[] = ["fresh", "stale", "missing", "failed", "partial"];
const marketSymbols = new Set(["SPY", "QQQ", "DIA", "^GSPC", "^IXIC", "^DJI"]);

export type DashboardSummary = {
  lastUpdateAt: string | null;
  marketIndices: SymbolQuote[];
  watchlist: SymbolQuote[];
  topGainers: SymbolQuote[];
  topLosers: SymbolQuote[];
  freshness: Record<DataStatus, number>;
  recentJobs: FetchJob[];
  trendSeries: PriceBar[][];
};

export type BuildDashboardSummaryParams = {
  symbols: SymbolQuote[];
  latestPrices: LatestPrice[];
  dataStatusRecords: DataStatusRecord[];
  recentJobs: FetchJob[];
  trendSeries: PriceBar[][];
};

export function buildDashboardSummary({
  dataStatusRecords,
  latestPrices,
  recentJobs,
  symbols,
  trendSeries
}: BuildDashboardSummaryParams): DashboardSummary {
  const latestBySymbol = new Map(latestPrices.map((price) => [price.symbol, price]));
  const priceStatusBySymbol = new Map(dataStatusRecords.filter((record) => record.dataType === "prices").map((record) => [record.symbol, record]));
  const watchlist = symbols.map((symbol) => enrichSymbol(symbol, latestBySymbol.get(symbol.symbol), priceStatusBySymbol.get(symbol.symbol)));
  const movers = watchlist.filter((quote) => quote.changePct !== null);

  return {
    lastUpdateAt: getLatestTimestamp(watchlist, dataStatusRecords, recentJobs),
    marketIndices: getMarketIndices(watchlist),
    watchlist,
    topGainers: [...movers].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 3),
    topLosers: [...movers].sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0)).slice(0, 3),
    freshness: countFreshness(dataStatusRecords, watchlist),
    recentJobs,
    trendSeries
  };
}

function enrichSymbol(symbol: SymbolQuote, latest: LatestPrice | undefined, statusRecord: DataStatusRecord | undefined): SymbolQuote {
  return {
    ...symbol,
    latestPrice: latest?.latestPrice ?? symbol.latestPrice,
    change: latest?.change ?? symbol.change,
    changePct: latest?.changePct ?? symbol.changePct,
    volume: latest?.volume ?? symbol.volume,
    lastUpdate: latest?.latestDataAt ?? statusRecord?.lastDataAt ?? symbol.lastUpdate,
    status: statusRecord?.status ?? symbol.status
  };
}

function getMarketIndices(watchlist: SymbolQuote[]): SymbolQuote[] {
  const indices = watchlist.filter((quote) => quote.assetType === "index" || marketSymbols.has(quote.symbol));
  return indices.length > 0 ? indices.slice(0, 4) : watchlist.slice(0, 4);
}

function countFreshness(dataStatusRecords: DataStatusRecord[], watchlist: SymbolQuote[]): Record<DataStatus, number> {
  const counts = Object.fromEntries(freshnessStatuses.map((status) => [status, 0])) as Record<DataStatus, number>;

  if (dataStatusRecords.length === 0) {
    watchlist.forEach((quote) => {
      counts[quote.status] += 1;
    });
    return counts;
  }

  dataStatusRecords.forEach((record) => {
    counts[record.status] += 1;
  });

  return counts;
}

function getLatestTimestamp(watchlist: SymbolQuote[], dataStatusRecords: DataStatusRecord[], recentJobs: FetchJob[]): string | null {
  const timestamps = [
    ...watchlist.map((quote) => quote.lastUpdate),
    ...dataStatusRecords.flatMap((record) => [record.lastDataAt, record.lastFetchAt, record.lastSuccessAt, record.updatedAt ?? null]),
    ...recentJobs.flatMap((job) => [job.createdAt, job.startedAt ?? null, job.finishedAt ?? null])
  ];

  return timestamps
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}
