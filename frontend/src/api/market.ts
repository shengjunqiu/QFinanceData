import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "./client";
import { mapFetchJob, type BackendFetchJob } from "./jobs";
import type {
  DataStatusRecord,
  DataType,
  FetchJob,
  FreshnessByType,
  SymbolQuote,
  DataStatus as DataStatusValue
} from "./types";

type BackendDataStatusRecord = {
  symbol: string;
  data_type: DataType;
  status: DataStatusValue;
  last_data_at: string | null;
  last_fetch_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  updated_at: string | null;
};

type BackendMarketQuote = {
  symbol: string;
  name: string;
  exchange: string;
  asset_type: string;
  currency: string;
  group_name: string;
  enabled: boolean;
  status: DataStatusValue;
  last_data_at: string | null;
  last_fetch_at: string | null;
  created_at: string;
  updated_at: string;
  latest_data_at: string | null;
  latest_price: number | null;
  change: number | null;
  change_percent: number | null;
  volume: number | null;
};

type BackendMarketOverview = {
  last_update_at: string | null;
  indices: BackendMarketQuote[];
  watchlist: BackendMarketQuote[];
  top_gainers: BackendMarketQuote[];
  top_losers: BackendMarketQuote[];
  freshness: Record<DataStatusValue, number>;
  freshness_by_type: FreshnessByType;
  recent_jobs: BackendFetchJob[];
};

export type DataStatusParams = {
  symbol?: string;
  dataType?: DataType;
};

export type MarketOverview = {
  lastUpdateAt: string | null;
  marketIndices: SymbolQuote[];
  watchlist: SymbolQuote[];
  topGainers: SymbolQuote[];
  topLosers: SymbolQuote[];
  freshness: Record<DataStatusValue, number>;
  freshnessByType: FreshnessByType;
  recentJobs: FetchJob[];
};

export const marketQueryKeys = {
  all: ["market"] as const,
  overview: () => ["market", "overview"] as const,
  dataStatus: (params: DataStatusParams = {}) => ["market", "data-status", params] as const
};

export async function getMarketOverview(signal?: AbortSignal): Promise<MarketOverview> {
  const overview = await apiRequest<BackendMarketOverview>("/api/market/overview", {
    signal
  });

  return mapMarketOverview(overview);
}

export function useMarketOverviewQuery() {
  return useQuery({
    queryFn: ({ signal }) => getMarketOverview(signal),
    queryKey: marketQueryKeys.overview()
  });
}

export async function listDataStatus(params: DataStatusParams = {}, signal?: AbortSignal): Promise<DataStatusRecord[]> {
  const records = await apiRequest<BackendDataStatusRecord[]>("/api/data-status", {
    query: {
      symbol: params.symbol || undefined,
      data_type: params.dataType
    },
    signal
  });

  return records.map(mapDataStatusRecord);
}

export function useDataStatusQuery(params: DataStatusParams = {}) {
  return useQuery({
    queryFn: ({ signal }) => listDataStatus(params, signal),
    queryKey: marketQueryKeys.dataStatus(params)
  });
}

export function mapMarketOverview(overview: BackendMarketOverview): MarketOverview {
  return {
    lastUpdateAt: overview.last_update_at,
    marketIndices: overview.indices.map(mapMarketQuote),
    watchlist: overview.watchlist.map(mapMarketQuote),
    topGainers: overview.top_gainers.map(mapMarketQuote),
    topLosers: overview.top_losers.map(mapMarketQuote),
    freshness: overview.freshness,
    freshnessByType: overview.freshness_by_type,
    recentJobs: overview.recent_jobs.map(mapFetchJob)
  };
}

export function mapDataStatusRecord(record: BackendDataStatusRecord): DataStatusRecord {
  return {
    symbol: record.symbol,
    dataType: record.data_type,
    status: record.status,
    lastDataAt: record.last_data_at,
    lastFetchAt: record.last_fetch_at,
    lastSuccessAt: record.last_success_at,
    lastError: record.last_error,
    updatedAt: record.updated_at
  };
}

function mapMarketQuote(record: BackendMarketQuote): SymbolQuote {
  return {
    symbol: record.symbol,
    name: record.name,
    exchange: record.exchange,
    assetType: normalizeAssetType(record.asset_type),
    currency: record.currency,
    groupName: record.group_name,
    latestPrice: record.latest_price,
    change: record.change,
    changePct: record.change_percent,
    volume: record.volume,
    lastUpdate: record.latest_data_at ?? record.last_data_at ?? record.last_fetch_at,
    status: record.status,
    enabled: record.enabled,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

function normalizeAssetType(value: string): SymbolQuote["assetType"] {
  if (value === "equity" || value === "etf" || value === "index") {
    return value;
  }

  return "equity";
}
