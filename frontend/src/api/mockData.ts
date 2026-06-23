import type {
  CorporateAction,
  DataStatusRecord,
  FetchJob,
  FetchJobItem,
  FundamentalSnapshot,
  PriceBar,
  PriceInterval,
  SymbolQuote
} from "./types";

const today = new Date("2026-06-23T00:00:00.000Z");

export const mockWatchlist: SymbolQuote[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    assetType: "equity",
    currency: "USD",
    groupName: "US Stocks",
    latestPrice: 213.4,
    change: 2.55,
    changePct: 1.21,
    volume: 61230000,
    lastUpdate: "2026-06-22",
    status: "fresh"
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    exchange: "NASDAQ",
    assetType: "equity",
    currency: "USD",
    groupName: "US Stocks",
    latestPrice: 487.2,
    change: -1.95,
    changePct: -0.4,
    volume: 24880000,
    lastUpdate: "2026-06-22",
    status: "fresh"
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    exchange: "NASDAQ",
    assetType: "equity",
    currency: "USD",
    groupName: "US Stocks",
    latestPrice: 154.8,
    change: 4.21,
    changePct: 2.8,
    volume: 221400000,
    lastUpdate: "2026-06-22",
    status: "partial"
  },
  {
    symbol: "0700.HK",
    name: "Tencent Holdings Ltd.",
    exchange: "HKEX",
    assetType: "equity",
    currency: "HKD",
    groupName: "HK Stocks",
    latestPrice: 392,
    change: 3.5,
    changePct: 0.9,
    volume: 18430000,
    lastUpdate: "2026-06-20",
    status: "stale"
  },
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    exchange: "NYSEARCA",
    assetType: "etf",
    currency: "USD",
    groupName: "ETF",
    latestPrice: 612.44,
    change: 2.57,
    changePct: 0.42,
    volume: 72110000,
    lastUpdate: "2026-06-22",
    status: "fresh"
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    exchange: "NASDAQ",
    assetType: "etf",
    currency: "USD",
    groupName: "ETF",
    latestPrice: 548.32,
    change: 3.87,
    changePct: 0.71,
    volume: 48790000,
    lastUpdate: "2026-06-22",
    status: "fresh"
  },
  {
    symbol: "^GSPC",
    name: "S&P 500 Index",
    exchange: "SNP",
    assetType: "index",
    currency: "USD",
    groupName: "Index",
    latestPrice: 6141.02,
    change: 23.31,
    changePct: 0.38,
    volume: null,
    lastUpdate: "2026-06-22",
    status: "missing"
  },
  {
    symbol: "^IXIC",
    name: "NASDAQ Composite",
    exchange: "NASDAQ",
    assetType: "index",
    currency: "USD",
    groupName: "Index",
    latestPrice: 20485.12,
    change: 132.41,
    changePct: 0.65,
    volume: null,
    lastUpdate: null,
    status: "failed"
  }
];

export const mockDataStatus: DataStatusRecord[] = [
  {
    symbol: "AAPL",
    dataType: "prices",
    status: "fresh",
    lastDataAt: "2026-06-22",
    lastFetchAt: "2026-06-23T16:30:00+08:00",
    lastSuccessAt: "2026-06-23T16:30:00+08:00",
    lastError: null
  },
  {
    symbol: "AAPL",
    dataType: "fundamentals",
    status: "stale",
    lastDataAt: "2026-03-29",
    lastFetchAt: "2026-06-19T16:10:00+08:00",
    lastSuccessAt: "2026-06-19T16:10:00+08:00",
    lastError: null
  },
  {
    symbol: "MSFT",
    dataType: "actions",
    status: "missing",
    lastDataAt: null,
    lastFetchAt: null,
    lastSuccessAt: null,
    lastError: null
  },
  {
    symbol: "NVDA",
    dataType: "fundamentals",
    status: "partial",
    lastDataAt: "2026-04-26",
    lastFetchAt: "2026-06-23T16:12:00+08:00",
    lastSuccessAt: "2026-06-23T16:12:00+08:00",
    lastError: "Free cash flow field is missing"
  },
  {
    symbol: "^IXIC",
    dataType: "prices",
    status: "failed",
    lastDataAt: null,
    lastFetchAt: "2026-06-23T16:10:00+08:00",
    lastSuccessAt: null,
    lastError: "timeout"
  }
];

const runningItems: FetchJobItem[] = [
  {
    id: "item_prices_1630_aapl",
    jobId: "job_prices_20260623_163000",
    symbol: "AAPL",
    status: "success",
    startedAt: "2026-06-23T16:30:02+08:00",
    finishedAt: "2026-06-23T16:30:05+08:00"
  },
  {
    id: "item_prices_1630_msft",
    jobId: "job_prices_20260623_163000",
    symbol: "MSFT",
    status: "success",
    startedAt: "2026-06-23T16:30:05+08:00",
    finishedAt: "2026-06-23T16:30:08+08:00"
  },
  {
    id: "item_prices_1630_nvda",
    jobId: "job_prices_20260623_163000",
    symbol: "NVDA",
    status: "running",
    startedAt: "2026-06-23T16:30:08+08:00"
  },
  {
    id: "item_prices_1630_0700hk",
    jobId: "job_prices_20260623_163000",
    symbol: "0700.HK",
    status: "queued"
  }
];

export const mockJobs: FetchJob[] = [
  {
    id: "job_prices_20260623_163000",
    type: "prices",
    symbols: ["AAPL", "MSFT", "NVDA", "0700.HK"],
    status: "running",
    progressTotal: 4,
    progressDone: 2,
    createdAt: "2026-06-23T16:30:00+08:00",
    startedAt: "2026-06-23T16:30:02+08:00",
    items: runningItems
  },
  {
    id: "job_metadata_20260623_162500",
    type: "metadata",
    symbols: ["SPY", "QQQ"],
    status: "queued",
    progressTotal: 2,
    progressDone: 0,
    createdAt: "2026-06-23T16:25:00+08:00",
    items: [
      { id: "item_metadata_1625_spy", jobId: "job_metadata_20260623_162500", symbol: "SPY", status: "queued" },
      { id: "item_metadata_1625_qqq", jobId: "job_metadata_20260623_162500", symbol: "QQQ", status: "queued" }
    ]
  },
  {
    id: "job_prices_20260623_160000",
    type: "prices",
    symbols: ["AAPL", "MSFT", "SPY", "QQQ"],
    status: "success",
    progressTotal: 4,
    progressDone: 4,
    createdAt: "2026-06-23T16:00:00+08:00",
    startedAt: "2026-06-23T16:00:02+08:00",
    finishedAt: "2026-06-23T16:00:22+08:00",
    items: ["AAPL", "MSFT", "SPY", "QQQ"].map((symbol) => ({
      id: `item_prices_1600_${symbol.toLowerCase().replace(/\W/g, "")}`,
      jobId: "job_prices_20260623_160000",
      symbol,
      status: "success",
      startedAt: "2026-06-23T16:00:02+08:00",
      finishedAt: "2026-06-23T16:00:22+08:00"
    }))
  },
  {
    id: "job_fundamentals_20260623_151000",
    type: "fundamentals",
    symbols: ["AAPL", "NVDA", "0700.HK"],
    status: "partial_success",
    progressTotal: 3,
    progressDone: 3,
    createdAt: "2026-06-23T15:10:00+08:00",
    startedAt: "2026-06-23T15:10:02+08:00",
    finishedAt: "2026-06-23T15:11:10+08:00",
    errorSummary: "1 of 3 symbols returned missing fields",
    items: [
      {
        id: "item_fund_1510_aapl",
        jobId: "job_fundamentals_20260623_151000",
        symbol: "AAPL",
        status: "success",
        startedAt: "2026-06-23T15:10:02+08:00",
        finishedAt: "2026-06-23T15:10:20+08:00"
      },
      {
        id: "item_fund_1510_nvda",
        jobId: "job_fundamentals_20260623_151000",
        symbol: "NVDA",
        status: "partial_success",
        errorType: "schema_changed",
        errorMessage: "Free cash flow field is missing",
        startedAt: "2026-06-23T15:10:21+08:00",
        finishedAt: "2026-06-23T15:10:48+08:00"
      },
      {
        id: "item_fund_1510_0700hk",
        jobId: "job_fundamentals_20260623_151000",
        symbol: "0700.HK",
        status: "success",
        startedAt: "2026-06-23T15:10:49+08:00",
        finishedAt: "2026-06-23T15:11:10+08:00"
      }
    ]
  },
  {
    id: "job_actions_20260623_145800",
    type: "actions",
    symbols: ["^IXIC"],
    status: "failed",
    progressTotal: 1,
    progressDone: 1,
    createdAt: "2026-06-23T14:58:00+08:00",
    startedAt: "2026-06-23T14:58:01+08:00",
    finishedAt: "2026-06-23T14:58:31+08:00",
    errorSummary: "timeout ^IXIC",
    items: [
      {
        id: "item_actions_1458_ixic",
        jobId: "job_actions_20260623_145800",
        symbol: "^IXIC",
        status: "failed",
        errorType: "timeout",
        errorMessage: "Request timed out after 30 seconds",
        startedAt: "2026-06-23T14:58:01+08:00",
        finishedAt: "2026-06-23T14:58:31+08:00"
      }
    ]
  }
];

export const mockFundamentals: FundamentalSnapshot[] = [
  {
    symbol: "AAPL",
    currency: "USD",
    metrics: {
      marketCap: 3200000000000,
      trailingPe: 32.1,
      priceToBook: 45.2,
      dividendYield: 0.0045,
      fiftyTwoWeekHigh: 238.1,
      fiftyTwoWeekLow: 164.2
    },
    financialSummary: {
      revenue: 391000000000,
      netIncome: 93736000000,
      freeCashFlow: 108800000000,
      debtRatio: 0.31
    },
    lastFetchAt: "2026-06-23T15:10:20+08:00",
    status: "fresh"
  },
  {
    symbol: "NVDA",
    currency: "USD",
    metrics: {
      marketCap: 3800000000000,
      trailingPe: 44.7,
      priceToBook: 52.8,
      dividendYield: 0.0002,
      fiftyTwoWeekHigh: 168.4,
      fiftyTwoWeekLow: 92.3
    },
    financialSummary: {
      revenue: 130500000000,
      netIncome: 72880000000,
      freeCashFlow: null,
      debtRatio: 0.18
    },
    lastFetchAt: "2026-06-23T15:10:48+08:00",
    status: "partial"
  },
  {
    symbol: "0700.HK",
    currency: "HKD",
    metrics: {
      marketCap: 3650000000000,
      trailingPe: 21.4,
      priceToBook: 4.9,
      dividendYield: 0.009,
      fiftyTwoWeekHigh: 431.5,
      fiftyTwoWeekLow: 282.4
    },
    financialSummary: {
      revenue: 660000000000,
      netIncome: 194000000000,
      freeCashFlow: 178000000000,
      debtRatio: 0.24
    },
    lastFetchAt: "2026-06-23T15:11:10+08:00",
    status: "fresh"
  }
];

export const mockCorporateActions: CorporateAction[] = [
  { symbol: "AAPL", actionType: "dividend", exDate: "2026-05-12", value: 0.26 },
  { symbol: "AAPL", actionType: "dividend", exDate: "2026-02-10", value: 0.25 },
  { symbol: "NVDA", actionType: "split", exDate: "2024-06-10", value: 10 },
  { symbol: "0700.HK", actionType: "dividend", exDate: "2026-05-20", value: 4.5 }
];

export const mockMarketIndices = mockWatchlist.filter((item) => item.assetType === "index" || item.symbol === "SPY" || item.symbol === "QQQ");

export const mockPriceBarsBySymbol: Record<string, PriceBar[]> = Object.fromEntries(
  mockWatchlist.map((symbol, index) => [
    symbol.symbol,
    generatePriceBars({
      symbol: symbol.symbol,
      interval: "1d",
      seed: index + 1,
      startPrice: symbol.latestPrice ?? 100
    })
  ])
);

export const mockPriceBars = mockPriceBarsBySymbol.AAPL;

export const mockDashboardSummary = {
  lastUpdateAt: "2026-06-23T16:30:00+08:00",
  marketIndices: mockMarketIndices,
  watchlist: mockWatchlist,
  topGainers: [...mockWatchlist]
    .filter((item) => item.changePct !== null)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, 3),
  topLosers: [...mockWatchlist]
    .filter((item) => item.changePct !== null)
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))
    .slice(0, 3),
  freshness: countStatuses(mockDataStatus),
  recentJobs: mockJobs.slice(0, 4)
};

type GeneratePriceBarsParams = {
  symbol: string;
  interval: PriceInterval;
  seed: number;
  startPrice: number;
};

function generatePriceBars({ symbol, interval, seed, startPrice }: GeneratePriceBarsParams): PriceBar[] {
  const bars: PriceBar[] = [];
  let close = startPrice * 0.82;
  let cursor = subtractCalendarDays(today, 390);

  while (cursor <= today) {
    if (isTradingDay(cursor)) {
      const index = bars.length;
      const wave = Math.sin((index + seed) / 8) * 0.012;
      const drift = 0.0009 + seed * 0.00008;
      const shock = Math.cos((index + seed * 3) / 17) * 0.006;
      const open = close;

      close = Math.max(1, open * (1 + drift + wave + shock));

      const high = Math.max(open, close) * (1 + 0.004 + Math.abs(Math.sin(index + seed)) * 0.01);
      const low = Math.min(open, close) * (1 - 0.004 - Math.abs(Math.cos(index + seed)) * 0.01);
      const volume = Math.round(12000000 + seed * 8500000 + Math.abs(Math.sin(index / 5)) * 42000000);

      bars.push({
        symbol,
        interval,
        timestamp: toDateString(cursor),
        open: roundPrice(open),
        high: roundPrice(high),
        low: roundPrice(low),
        close: roundPrice(close),
        adjClose: roundPrice(close * (1 - seed * 0.0003)),
        volume
      });
    }

    cursor = addCalendarDays(cursor, 1);
  }

  return bars;
}

function countStatuses(records: DataStatusRecord[]) {
  return records.reduce(
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
}

function isTradingDay(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function subtractCalendarDays(date: Date, days: number) {
  return addCalendarDays(date, -days);
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}
