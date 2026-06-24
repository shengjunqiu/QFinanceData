import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { actionsQueryKeys } from "./actions";
import { apiRequest, type ApiRequestOptions } from "./client";
import { fundamentalsQueryKeys } from "./fundamentals";
import { marketQueryKeys } from "./market";
import { pricesQueryKeys } from "./prices";
import { symbolsQueryKeys } from "./symbols";
import type {
  FetchJob,
  FetchJobItem,
  FetchJobItemStatus,
  FetchJobStatus,
  FetchJobType,
  PriceFetchRequest,
  SymbolFetchRequest
} from "./types";

export type BackendFetchJobItem = {
  id: string;
  job_id: string;
  symbol: string;
  status: FetchJobItemStatus;
  error_type: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type BackendFetchJob = {
  id: string;
  job_type: FetchJobType;
  status: FetchJobStatus;
  params: Record<string, unknown>;
  progress_total: number;
  progress_done: number;
  error_summary: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  items: BackendFetchJobItem[];
};

type BackendPriceFetchRequest = {
  symbols?: string[];
  start?: string;
  end?: string;
  interval?: string;
};

type BackendSymbolFetchRequest = {
  symbols?: string[];
};

export type ListJobsParams = {
  limit?: number;
};

export const jobsQueryKeys = {
  all: ["jobs"] as const,
  list: (params: ListJobsParams = {}) => ["jobs", "list", params] as const,
  detail: (jobId: string) => ["jobs", "detail", jobId] as const
};

export async function createPriceFetchJob(
  input: PriceFetchRequest = {},
  options: Pick<ApiRequestOptions, "signal"> = {}
): Promise<FetchJob> {
  const job = await apiRequest<BackendFetchJob>("/api/fetch/prices", {
    ...options,
    body: toPriceFetchPayload(input),
    method: "POST"
  });

  return mapFetchJob(job);
}

export function useCreatePriceFetchJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PriceFetchRequest) => createPriceFetchJob(input),
    onSuccess: (job) => {
      queryClient.setQueryData(jobsQueryKeys.detail(job.id), job);
      invalidateAfterJob(queryClient);
    }
  });
}

export async function createFundamentalsFetchJob(
  input: SymbolFetchRequest = {},
  options: Pick<ApiRequestOptions, "signal"> = {}
): Promise<FetchJob> {
  const job = await apiRequest<BackendFetchJob>("/api/fetch/fundamentals", {
    ...options,
    body: toSymbolFetchPayload(input),
    method: "POST"
  });

  return mapFetchJob(job);
}

export function useCreateFundamentalsFetchJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SymbolFetchRequest) => createFundamentalsFetchJob(input),
    onSuccess: (job) => {
      queryClient.setQueryData(jobsQueryKeys.detail(job.id), job);
      invalidateAfterJob(queryClient);
    }
  });
}

export async function createActionsFetchJob(
  input: SymbolFetchRequest = {},
  options: Pick<ApiRequestOptions, "signal"> = {}
): Promise<FetchJob> {
  const job = await apiRequest<BackendFetchJob>("/api/fetch/actions", {
    ...options,
    body: toSymbolFetchPayload(input),
    method: "POST"
  });

  return mapFetchJob(job);
}

export function useCreateActionsFetchJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SymbolFetchRequest) => createActionsFetchJob(input),
    onSuccess: (job) => {
      queryClient.setQueryData(jobsQueryKeys.detail(job.id), job);
      invalidateAfterJob(queryClient);
    }
  });
}

export async function listJobs(params: ListJobsParams = {}, signal?: AbortSignal): Promise<FetchJob[]> {
  const jobs = await apiRequest<BackendFetchJob[]>("/api/jobs", {
    query: {
      limit: params.limit
    },
    signal
  });

  return jobs.map(mapFetchJob);
}

export function useJobsQuery(params: ListJobsParams = {}) {
  return useQuery({
    queryFn: ({ signal }) => listJobs(params, signal),
    queryKey: jobsQueryKeys.list(params),
    refetchInterval: (query) => {
      const jobs = query.state.data;
      return Array.isArray(jobs) && jobs.some(isActiveJob) ? 2000 : false;
    }
  });
}

export async function getJob(jobId: string, signal?: AbortSignal): Promise<FetchJob> {
  const job = await apiRequest<BackendFetchJob>(`/api/jobs/${encodeURIComponent(jobId)}`, {
    signal
  });

  return mapFetchJob(job);
}

export function useJobQuery(jobId: string) {
  return useQuery({
    enabled: Boolean(jobId),
    queryFn: ({ signal }) => getJob(jobId, signal),
    queryKey: jobsQueryKeys.detail(jobId),
    refetchInterval: (query) => {
      const job = query.state.data;
      return job && isActiveJob(job) ? 2000 : false;
    }
  });
}

export function mapFetchJob(job: BackendFetchJob): FetchJob {
  const items = job.items.map(mapFetchJobItem);

  return {
    id: job.id,
    type: job.job_type,
    symbols: readSymbols(job.params.symbols, items),
    status: job.status,
    progressTotal: job.progress_total,
    progressDone: job.progress_done,
    createdAt: job.created_at,
    startedAt: job.started_at ?? undefined,
    finishedAt: job.finished_at ?? undefined,
    errorSummary: job.error_summary ?? undefined,
    items
  };
}

function mapFetchJobItem(item: BackendFetchJobItem): FetchJobItem {
  return {
    id: item.id,
    jobId: item.job_id,
    symbol: item.symbol,
    status: item.status,
    errorType: item.error_type ?? undefined,
    errorMessage: item.error_message ?? undefined,
    startedAt: item.started_at ?? undefined,
    finishedAt: item.finished_at ?? undefined
  };
}

function toPriceFetchPayload(input: PriceFetchRequest): BackendPriceFetchRequest {
  return {
    symbols: input.symbols,
    start: formatDateParam(input.start),
    end: formatDateParam(input.end),
    interval: input.interval
  };
}

function toSymbolFetchPayload(input: SymbolFetchRequest): BackendSymbolFetchRequest {
  return {
    symbols: input.symbols
  };
}

function readSymbols(value: unknown, items: FetchJobItem[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return items.map((item) => item.symbol);
}

function formatDateParam(value: string | Date | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function isActiveJob(job: FetchJob): boolean {
  return job.status === "queued" || job.status === "running";
}

function invalidateAfterJob(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: pricesQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: fundamentalsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: actionsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: symbolsQueryKeys.all });
}
