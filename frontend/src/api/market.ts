import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "./client";
import type { DataStatusRecord, DataType, DataStatus as DataStatusValue } from "./types";

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

export type DataStatusParams = {
  symbol?: string;
  dataType?: DataType;
};

export const marketQueryKeys = {
  all: ["market"] as const,
  dataStatus: (params: DataStatusParams = {}) => ["market", "data-status", params] as const
};

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
