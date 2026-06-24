import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { actionsQueryKeys } from "../../api/actions";
import { isApiError } from "../../api/client";
import { fundamentalsQueryKeys } from "../../api/fundamentals";
import {
  jobsQueryKeys,
  useCreateActionsFetchJobMutation,
  useCreateFundamentalsFetchJobMutation,
  useCreatePriceFetchJobMutation,
  useJobQuery,
  useJobsQuery
} from "../../api/jobs";
import { marketQueryKeys } from "../../api/market";
import { pricesQueryKeys } from "../../api/prices";
import { symbolsQueryKeys, useSymbolsQuery } from "../../api/symbols";
import type { FetchJob, FetchJobItem, FetchJobItemStatus, FetchJobStatus, FetchJobType } from "../../api/types";

type RunnableJobType = "prices" | "fundamentals" | "actions";

const jobStatusLabels: Record<FetchJobStatus | FetchJobItemStatus, string> = {
  queued: "Queued",
  running: "Running",
  success: "Success",
  partial_success: "Partial",
  failed: "Failed",
  cancelled: "Cancelled",
  skipped: "Skipped"
};

const statusFilters: Array<"all" | FetchJobStatus> = ["all", "queued", "running", "success", "partial_success", "failed"];

export function JobsPage() {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FetchJobStatus>("all");
  const [message, setMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const jobsQuery = useJobsQuery({ limit: 50 });
  const symbolsQuery = useSymbolsQuery();
  const createPriceFetchJobMutation = useCreatePriceFetchJobMutation();
  const createFundamentalsFetchJobMutation = useCreateFundamentalsFetchJobMutation();
  const createActionsFetchJobMutation = useCreateActionsFetchJobMutation();
  const jobs = jobsQuery.data ?? [];
  const activeSymbols = symbolsQuery.data?.map((symbol) => symbol.symbol) ?? [];
  const runningJobs = jobs.filter(isActiveJob);
  const hadActiveJobsRef = useRef(false);
  const selectedJobFromList = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const selectedJobQuery = useJobQuery(selectedJobFromList?.id ?? "");
  const selectedJob = selectedJobQuery.data ?? selectedJobFromList;
  const filteredJobs = useMemo(
    () => jobs.filter((job) => statusFilter === "all" || job.status === statusFilter),
    [jobs, statusFilter]
  );
  const error =
    jobsQuery.error ??
    symbolsQuery.error ??
    selectedJobQuery.error ??
    createPriceFetchJobMutation.error ??
    createFundamentalsFetchJobMutation.error ??
    createActionsFetchJobMutation.error;

  useEffect(() => {
    if (!selectedJobId && jobs[0]) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    const hasActiveJobs = runningJobs.length > 0;

    if (hadActiveJobsRef.current && !hasActiveJobs) {
      void queryClient.invalidateQueries({ queryKey: marketQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: pricesQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: fundamentalsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: actionsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: symbolsQueryKeys.all });
      setMessage("Fetch jobs finished. Dashboard and detail data refreshed.");
    }

    hadActiveJobsRef.current = hasActiveJobs;
  }, [queryClient, runningJobs.length]);

  async function createFetchJob(jobType: RunnableJobType, symbols: string[]) {
    if (symbols.length === 0) {
      setMessage(`Add at least one enabled ticker before starting ${formatJobType(jobType).toLowerCase()} update.`);
      return;
    }

    try {
      const job =
        jobType === "prices"
          ? await createPriceFetchJobMutation.mutateAsync({
              interval: "1d",
              symbols
            })
          : jobType === "fundamentals"
            ? await createFundamentalsFetchJobMutation.mutateAsync({ symbols })
            : await createActionsFetchJobMutation.mutateAsync({ symbols });
      setSelectedJobId(job.id);
      setMessage(`Queued ${formatJobType(jobType).toLowerCase()} update for ${symbols.length} ticker${symbols.length > 1 ? "s" : ""}.`);
      void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all });
    } catch (error) {
      setMessage(formatErrorMessage(error));
    }
  }

  function retryFailedItems(job: FetchJob) {
    const retrySymbols = job.items.filter((item) => item.status === "failed").map((item) => item.symbol);

    if (retrySymbols.length === 0) {
      setMessage("No failed items to retry for this job.");
      return;
    }

    if (job.type === "prices" || job.type === "fundamentals" || job.type === "actions") {
      void createFetchJob(job.type, retrySymbols);
      return;
    }

    setMessage(`Retry is not available for ${formatJobType(job.type)} jobs yet.`);
  }

  if (jobsQuery.isLoading || symbolsQuery.isLoading) {
    return (
      <section className="page">
        <EmptyState title="Loading jobs" description="Fetching recent fetch jobs and enabled symbols." />
      </section>
    );
  }

  if (jobsQuery.error || symbolsQuery.error) {
    return (
      <section className="page">
        <EmptyState title="Jobs unavailable" description={formatErrorMessage(jobsQuery.error ?? symbolsQuery.error)} />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Fetch Operations</p>
          <h1>Jobs</h1>
        </div>
      </div>

      <section className="jobs-actions" aria-label="Create fetch jobs">
        <button disabled={createPriceFetchJobMutation.isPending} onClick={() => void createFetchJob("prices", activeSymbols)} type="button">
          {createPriceFetchJobMutation.isPending ? "Queueing Prices" : "Update Prices"}
        </button>
        <button disabled={createFundamentalsFetchJobMutation.isPending} onClick={() => void createFetchJob("fundamentals", activeSymbols)} type="button">
          {createFundamentalsFetchJobMutation.isPending ? "Queueing Fundamentals" : "Update Fundamentals"}
        </button>
        <button disabled={createActionsFetchJobMutation.isPending} onClick={() => void createFetchJob("actions", activeSymbols)} type="button">
          {createActionsFetchJobMutation.isPending ? "Queueing Actions" : "Update Actions"}
        </button>
        <span>{activeSymbols.length} enabled symbols</span>
      </section>

      {message ? <p className="inline-message">{message}</p> : null}
      {error ? <p className="inline-message inline-message-error">{formatErrorMessage(error)}</p> : null}

      <div className="jobs-page-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Job Queue</h2>
            <span>{runningJobs.length} active</span>
          </div>
          {runningJobs.length === 0 ? (
            <EmptyState compact title="No active jobs" description="Start a fetch job to see progress." />
          ) : (
            <div className="active-jobs-list">
              {runningJobs.map((job) => (
                <button className="active-job-card" key={job.id} onClick={() => setSelectedJobId(job.id)} type="button">
                  <span>
                    <strong>{formatJobType(job.type)}</strong>
                    <small>{job.symbols.length} symbols · {formatDateTime(job.createdAt)}</small>
                  </span>
                  <JobStatusBadge status={job.status} />
                  <ProgressMeter job={job} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel panel-wide">
          <div className="panel-heading">
            <h2>Job Detail</h2>
            {selectedJob ? (
              <button className="text-action" onClick={() => retryFailedItems(selectedJob)} type="button">
                Retry Failed
              </button>
            ) : null}
          </div>
          {selectedJob ? (
            <JobDetail job={selectedJob} isRefreshing={selectedJobQuery.isFetching && isActiveJob(selectedJob)} />
          ) : (
            <EmptyState title="No job selected" description="Start a price update to inspect item-level status." />
          )}
        </section>

        <section className="panel panel-full">
          <div className="panel-heading">
            <h2>History</h2>
            <div className="job-filter-tabs" aria-label="Job status filter">
              {statusFilters.map((status) => (
                <button
                  aria-pressed={statusFilter === status}
                  className={statusFilter === status ? "job-filter-tab job-filter-tab-active" : "job-filter-tab"}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {status === "all" ? "All" : jobStatusLabels[status]}
                </button>
              ))}
            </div>
          </div>
          {filteredJobs.length === 0 ? (
            <EmptyState title="No jobs found" description="No fetch jobs match this status filter." />
          ) : (
            <div className="job-history-table" role="table" aria-label="Job history">
              <div className="job-history-row job-history-header" role="row">
                <span>Time</span>
                <span>Type</span>
                <span>Symbols</span>
                <span>Status</span>
                <span>Error</span>
              </div>
              {filteredJobs.map((job) => (
                <button className="job-history-row" key={job.id} onClick={() => setSelectedJobId(job.id)} role="row" type="button">
                  <span>{formatDateTime(job.createdAt)}</span>
                  <span>{formatJobType(job.type)}</span>
                  <span>{job.symbols.length}</span>
                  <span><JobStatusBadge status={job.status} /></span>
                  <span>{job.errorSummary ?? "-"}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function JobDetail({ isRefreshing, job }: { isRefreshing: boolean; job: FetchJob }) {
  return (
    <div className="job-detail">
      <div className="job-detail-summary">
        <div>
          <span>Type</span>
          <strong>{formatJobType(job.type)}</strong>
        </div>
        <div>
          <span>Status</span>
          <JobStatusBadge status={job.status} />
        </div>
        <div>
          <span>Progress</span>
          <strong>{job.progressDone}/{job.progressTotal}</strong>
        </div>
        <div>
          <span>{isRefreshing ? "Polling" : "Created"}</span>
          <strong>{formatDateTime(job.createdAt)}</strong>
        </div>
      </div>
      <ProgressMeter job={job} />
      {job.items.length === 0 ? (
        <EmptyState compact title="No item detail" description="This job has not produced item-level status yet." />
      ) : (
        <div className="job-items-list">
          {job.items.map((item) => (
            <JobItemRow item={item} key={item.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobItemRow({ item }: { item: FetchJobItem }) {
  return (
    <div className="job-item-row">
      <span>
        <Link to={`/symbols/${item.symbol}`}>{item.symbol}</Link>
        {item.errorMessage ? <small>{item.errorMessage}</small> : null}
      </span>
      <JobStatusBadge status={item.status} />
      <span>{item.finishedAt ? formatDateTime(item.finishedAt) : item.startedAt ? "Running" : "Waiting"}</span>
    </div>
  );
}

function ProgressMeter({ job }: { job: FetchJob }) {
  const progress = job.progressTotal > 0 ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;

  return (
    <span className="progress-meter" aria-label={`${progress}% complete`}>
      <span style={{ width: `${progress}%` }} />
    </span>
  );
}

function JobStatusBadge({ status }: { status: FetchJobStatus | FetchJobItemStatus }) {
  return <span className={`job-status-badge job-status-${status}`}>{jobStatusLabels[status]}</span>;
}

function EmptyState({ compact = false, description, title }: { compact?: boolean; description: string; title: string }) {
  return (
    <div className={compact ? "empty-state empty-state-compact" : "empty-state"}>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function formatJobType(type: FetchJobType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function formatErrorMessage(error: unknown) {
  if (isApiError(error)) {
    return error.status === 0 ? error.message : `${error.message} (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The request could not be completed.";
}

function isActiveJob(job: FetchJob): boolean {
  return job.status === "queued" || job.status === "running";
}
