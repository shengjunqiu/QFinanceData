export type AssetType = "equity" | "etf" | "index";

export type DataStatus = "fresh" | "stale" | "missing" | "failed" | "partial";

export type DataType = "prices" | "metadata" | "fundamentals" | "actions";

export type FetchJobStatus = "queued" | "running" | "success" | "partial_success" | "failed" | "cancelled";

export type FetchJobItemStatus = FetchJobStatus | "skipped";

export type FetchJobType = "prices" | "fundamentals" | "actions" | "metadata";

export type PriceInterval = "1d" | "1wk" | "1mo";

export type PriceSeriesStatus = "ok" | "missing";

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
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export type PriceSeries = {
  symbol: string;
  interval: PriceInterval;
  range: string;
  status: PriceSeriesStatus;
  bars: PriceBar[];
};

export type LatestPrice = {
  symbol: string;
  interval: PriceInterval;
  status: PriceSeriesStatus;
  latestDataAt: string | null;
  latestPrice: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
};

export type FetchJobItem = {
  id: string;
  jobId: string;
  symbol: string;
  status: FetchJobItemStatus;
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
  updatedAt?: string | null;
};

export type SymbolCreateInput = {
  symbol: string;
  name?: string;
  exchange?: string;
  assetType?: AssetType;
  currency?: string;
  groupName?: string;
  enabled?: boolean;
};

export type SymbolUpdateInput = Partial<Omit<SymbolCreateInput, "symbol">>;

export type PriceFetchRequest = {
  symbols?: string[];
  start?: string | Date;
  end?: string | Date;
  interval?: PriceInterval;
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
