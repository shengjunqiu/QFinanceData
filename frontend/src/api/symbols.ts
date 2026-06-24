import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRequest, type ApiRequestOptions } from "./client";
import type { AssetType, DataStatus, SymbolCreateInput, SymbolQuote, SymbolUpdateInput } from "./types";

type BackendSymbol = {
  symbol: string;
  name: string;
  exchange: string;
  asset_type: string;
  currency: string;
  group_name: string;
  enabled: boolean;
  status: DataStatus;
  last_data_at: string | null;
  last_fetch_at: string | null;
  created_at: string;
  updated_at: string;
};

type BackendSymbolCreate = {
  symbol: string;
  name?: string;
  exchange?: string;
  asset_type?: string;
  currency?: string;
  group_name?: string;
  enabled?: boolean;
};

type BackendSymbolUpdate = Partial<Omit<BackendSymbolCreate, "symbol">>;

export type ListSymbolsParams = {
  includeDisabled?: boolean;
  groupName?: string;
};

export const symbolsQueryKeys = {
  all: ["symbols"] as const,
  list: (params: ListSymbolsParams = {}) => ["symbols", "list", params] as const
};

export async function listSymbols(params: ListSymbolsParams = {}, signal?: AbortSignal): Promise<SymbolQuote[]> {
  const records = await apiRequest<BackendSymbol[]>("/api/symbols", {
    query: {
      include_disabled: params.includeDisabled,
      group_name: params.groupName || undefined
    },
    signal
  });

  return records.map(mapSymbol);
}

export function useSymbolsQuery(params: ListSymbolsParams = {}) {
  return useQuery({
    queryFn: ({ signal }) => listSymbols(params, signal),
    queryKey: symbolsQueryKeys.list(params)
  });
}

export async function createSymbol(input: SymbolCreateInput, options: Pick<ApiRequestOptions, "signal"> = {}): Promise<SymbolQuote> {
  const record = await apiRequest<BackendSymbol>("/api/symbols", {
    ...options,
    body: toSymbolCreatePayload(input),
    method: "POST"
  });

  return mapSymbol(record);
}

export function useCreateSymbolMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SymbolCreateInput) => createSymbol(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: symbolsQueryKeys.all })
  });
}

export async function updateSymbol(
  symbol: string,
  input: SymbolUpdateInput,
  options: Pick<ApiRequestOptions, "signal"> = {}
): Promise<SymbolQuote> {
  const record = await apiRequest<BackendSymbol>(`/api/symbols/${encodeURIComponent(symbol)}`, {
    ...options,
    body: toSymbolUpdatePayload(input),
    method: "PATCH"
  });

  return mapSymbol(record);
}

export function useUpdateSymbolMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, symbol }: { symbol: string; input: SymbolUpdateInput }) => updateSymbol(symbol, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: symbolsQueryKeys.all })
  });
}

export async function deleteSymbol(symbol: string, options: Pick<ApiRequestOptions, "signal"> = {}): Promise<void> {
  await apiRequest<void>(`/api/symbols/${encodeURIComponent(symbol)}`, {
    ...options,
    method: "DELETE"
  });
}

export function useDeleteSymbolMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (symbol: string) => deleteSymbol(symbol),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: symbolsQueryKeys.all })
  });
}

export function mapSymbol(record: BackendSymbol): SymbolQuote {
  return {
    symbol: record.symbol,
    name: record.name,
    exchange: record.exchange,
    assetType: normalizeAssetType(record.asset_type),
    currency: record.currency,
    groupName: record.group_name,
    latestPrice: null,
    change: null,
    changePct: null,
    volume: null,
    lastUpdate: record.last_data_at ?? record.last_fetch_at,
    status: record.status,
    enabled: record.enabled,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

function toSymbolCreatePayload(input: SymbolCreateInput): BackendSymbolCreate {
  return {
    symbol: input.symbol,
    name: input.name,
    exchange: input.exchange,
    asset_type: input.assetType,
    currency: input.currency,
    group_name: input.groupName,
    enabled: input.enabled
  };
}

function toSymbolUpdatePayload(input: SymbolUpdateInput): BackendSymbolUpdate {
  return {
    name: input.name,
    exchange: input.exchange,
    asset_type: input.assetType,
    currency: input.currency,
    group_name: input.groupName,
    enabled: input.enabled
  };
}

function normalizeAssetType(value: string): AssetType {
  if (value === "equity" || value === "etf" || value === "index") {
    return value;
  }

  return "equity";
}
