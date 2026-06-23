export type AssetType = "equity" | "etf" | "index";

export type DataStatus = "fresh" | "stale" | "missing" | "failed" | "partial";

export type DataType = "prices" | "metadata" | "fundamentals" | "actions";

export type FetchJobStatus = "queued" | "running" | "success" | "partial_success" | "failed" | "cancelled";

export type FetchJobType = "prices" | "fundamentals" | "actions" | "metadata";

export type PriceInterval = "1d" | "1wk" | "1mo";

export type SymbolQuote = {
  symbol: string;
  name: string;
  exchange: string;
  assetType: AssetType;
  currency: string;
  groupName: string;
  latestPrice: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  lastUpdate: string | null;
  status: DataStatus;
};

export type PriceBar = {
  symbol: string;
  interval: PriceInterval;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
};

export type FetchJobItem = {
  id: string;
  jobId: string;
  symbol: string;
  status: FetchJobStatus;
  errorType?: string;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type FetchJob = {
  id: string;
  type: FetchJobType;
  symbols: string[];
  status: FetchJobStatus;
  progressTotal: number;
  progressDone: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorSummary?: string;
  items: FetchJobItem[];
};

export type DataStatusRecord = {
  symbol: string;
  dataType: DataType;
  status: DataStatus;
  lastDataAt: string | null;
  lastFetchAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type FundamentalSnapshot = {
  symbol: string;
  currency: string;
  metrics: {
    marketCap: number | null;
    trailingPe: number | null;
    priceToBook: number | null;
    dividendYield: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
  };
  financialSummary: {
    revenue: number | null;
    netIncome: number | null;
    freeCashFlow: number | null;
    debtRatio: number | null;
  };
  lastFetchAt: string | null;
  status: DataStatus;
};

export type CorporateAction = {
  symbol: string;
  actionType: "dividend" | "split";
  exDate: string;
  value: number;
};
