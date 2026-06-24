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
import type { FetchJob, FetchJobItem, FetchJobItemStatus, FetchJobStatus } from "../../api/types";
import {
  formatDateTime,
  formatJobStatus,
  formatJobType,
  formatPercentComplete,
  formatSymbolCount,
  type AppCopy,
  type Locale,
  useI18n
} from "../../i18n";

type RunnableJobType = "prices" | "fundamentals" | "actions";

const statusFilters: Array<"all" | FetchJobStatus> = ["all", "queued", "running", "success", "partial_success", "failed"];

export function JobsPage() {
  const { copy, locale } = useI18n();
  const t = copy.jobs;
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
      setMessage(t.finishedMessage);
    }

    hadActiveJobsRef.current = hasActiveJobs;
  }, [queryClient, runningJobs.length, t.finishedMessage]);

  async function createFetchJob(jobType: RunnableJobType, symbols: string[]) {
    if (symbols.length === 0) {
      setMessage(formatNoEnabledTickerMessage(jobType, copy, locale));
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
      setMessage(formatQueuedUpdateMessage(jobType, symbols.length, copy, locale));
      void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all });
    } catch (error) {
      setMessage(formatErrorMessage(error, copy));
    }
  }

  function retryFailedItems(job: FetchJob) {
    const retrySymbols = job.items.filter((item) => item.status === "failed").map((item) => item.symbol);

    if (retrySymbols.length === 0) {
      setMessage(t.noFailedItems);
      return;
    }

    if (job.type === "prices" || job.type === "fundamentals" || job.type === "actions") {
      void createFetchJob(job.type, retrySymbols);
      return;
    }

    setMessage(formatRetryUnavailableMessage(job.type, copy, locale));
  }

  if (jobsQuery.isLoading || symbolsQuery.isLoading) {
    return (
      <section className="page">
        <EmptyState title={t.loadingTitle} description={t.loadingDescription} />
      </section>
    );
  }

  if (jobsQuery.error || symbolsQuery.error) {
    return (
      <section className="page">
        <EmptyState title={t.unavailableTitle} description={formatErrorMessage(jobsQuery.error ?? symbolsQuery.error, copy)} />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t.fetchOperations}</p>
          <h1>{t.title}</h1>
        </div>
      </div>

      <section className="jobs-actions" aria-label={t.createFetchJobs}>
        <button disabled={createPriceFetchJobMutation.isPending} onClick={() => void createFetchJob("prices", activeSymbols)} type="button">
          {createPriceFetchJobMutation.isPending ? t.queueingPrices : t.updatePrices}
        </button>
        <button disabled={createFundamentalsFetchJobMutation.isPending} onClick={() => void createFetchJob("fundamentals", activeSymbols)} type="button">
          {createFundamentalsFetchJobMutation.isPending ? t.queueingFundamentals : t.updateFundamentals}
        </button>
        <button disabled={createActionsFetchJobMutation.isPending} onClick={() => void createFetchJob("actions", activeSymbols)} type="button">
          {createActionsFetchJobMutation.isPending ? t.queueingActions : t.updateActions}
        </button>
        <span>{formatEnabledSymbolCount(activeSymbols.length, copy, locale)}</span>
      </section>

      {message ? <p className="inline-message">{message}</p> : null}
      {error ? <p className="inline-message inline-message-error">{formatErrorMessage(error, copy)}</p> : null}

      <div className="jobs-page-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>{t.jobQueue}</h2>
            <span>{runningJobs.length} {t.active}</span>
          </div>
          {runningJobs.length === 0 ? (
            <EmptyState compact title={t.noActiveTitle} description={t.noActiveDescription} />
          ) : (
            <div className="active-jobs-list">
              {runningJobs.map((job) => (
                <button className="active-job-card" key={job.id} onClick={() => setSelectedJobId(job.id)} type="button">
                  <span>
                    <strong>{formatJobType(job.type, copy)}</strong>
                    <small>{formatSymbolCount(job.symbols.length, locale)} · {formatDateTime(job.createdAt, locale)}</small>
                  </span>
                  <JobStatusBadge copy={copy} status={job.status} />
                  <ProgressMeter job={job} locale={locale} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel panel-wide">
          <div className="panel-heading">
            <h2>{t.jobDetail}</h2>
            {selectedJob ? (
              <button className="text-action" onClick={() => retryFailedItems(selectedJob)} type="button">
                {t.retryFailed}
              </button>
            ) : null}
          </div>
          {selectedJob ? (
            <JobDetail copy={copy} job={selectedJob} isRefreshing={selectedJobQuery.isFetching && isActiveJob(selectedJob)} locale={locale} />
          ) : (
            <EmptyState title={t.noJobSelectedTitle} description={t.noJobSelectedDescription} />
          )}
        </section>

        <section className="panel panel-full">
          <div className="panel-heading">
            <h2>{t.history}</h2>
            <div className="job-filter-tabs" aria-label={t.jobStatusFilter}>
              {statusFilters.map((status) => (
                <button
                  aria-pressed={statusFilter === status}
                  className={statusFilter === status ? "job-filter-tab job-filter-tab-active" : "job-filter-tab"}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {status === "all" ? copy.common.all : formatJobStatus(status, copy)}
                </button>
              ))}
            </div>
          </div>
          {filteredJobs.length === 0 ? (
            <EmptyState title={t.noJobsFoundTitle} description={t.noJobsFoundDescription} />
          ) : (
            <div className="job-history-table" role="table" aria-label={t.historyLabel}>
              <div className="job-history-row job-history-header" role="row">
                <span>{copy.common.time}</span>
                <span>{copy.common.type}</span>
                <span>{copy.common.symbols}</span>
                <span>{copy.common.status}</span>
                <span>{copy.common.error}</span>
              </div>
              {filteredJobs.map((job) => (
                <button className="job-history-row" key={job.id} onClick={() => setSelectedJobId(job.id)} role="row" type="button">
                  <span>{formatDateTime(job.createdAt, locale)}</span>
                  <span>{formatJobType(job.type, copy)}</span>
                  <span>{job.symbols.length}</span>
                  <span><JobStatusBadge copy={copy} status={job.status} /></span>
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

function JobDetail({ copy, isRefreshing, job, locale }: { copy: AppCopy; isRefreshing: boolean; job: FetchJob; locale: Locale }) {
  return (
    <div className="job-detail">
      <div className="job-detail-summary">
        <div>
          <span>{copy.common.type}</span>
          <strong>{formatJobType(job.type, copy)}</strong>
        </div>
        <div>
          <span>{copy.common.status}</span>
          <JobStatusBadge copy={copy} status={job.status} />
        </div>
        <div>
          <span>{copy.jobs.progress}</span>
          <strong>{job.progressDone}/{job.progressTotal}</strong>
        </div>
        <div>
          <span>{isRefreshing ? copy.common.polling : copy.common.created}</span>
          <strong>{formatDateTime(job.createdAt, locale)}</strong>
        </div>
      </div>
      <ProgressMeter job={job} locale={locale} />
      {job.items.length === 0 ? (
        <EmptyState compact title={copy.jobs.noItemTitle} description={copy.jobs.noItemDescription} />
      ) : (
        <div className="job-items-list">
          {job.items.map((item) => (
            <JobItemRow copy={copy} item={item} key={item.id} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobItemRow({ copy, item, locale }: { copy: AppCopy; item: FetchJobItem; locale: Locale }) {
  return (
    <div className="job-item-row">
      <span>
        <Link to={`/symbols/${item.symbol}`}>{item.symbol}</Link>
        {item.errorMessage ? <small>{item.errorMessage}</small> : null}
      </span>
      <JobStatusBadge copy={copy} status={item.status} />
      <span>{item.finishedAt ? formatDateTime(item.finishedAt, locale) : item.startedAt ? formatJobStatus("running", copy) : copy.jobs.waiting}</span>
    </div>
  );
}

function ProgressMeter({ job, locale }: { job: FetchJob; locale: Locale }) {
  const progress = job.progressTotal > 0 ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;

  return (
    <span className="progress-meter" aria-label={formatPercentComplete(progress, locale)}>
      <span style={{ width: `${progress}%` }} />
    </span>
  );
}

function JobStatusBadge({ copy, status }: { copy: AppCopy; status: FetchJobStatus | FetchJobItemStatus }) {
  return <span className={`job-status-badge job-status-${status}`}>{formatJobStatus(status, copy)}</span>;
}

function EmptyState({ compact = false, description, title }: { compact?: boolean; description: string; title: string }) {
  return (
    <div className={compact ? "empty-state empty-state-compact" : "empty-state"}>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function formatNoEnabledTickerMessage(jobType: RunnableJobType, copy: AppCopy, locale: Locale) {
  const jobLabel = formatJobType(jobType, copy);
  return locale === "zh"
    ? `${copy.jobs.noEnabledTickerPrefix}${jobLabel}。`
    : `${copy.jobs.noEnabledTickerPrefix} ${jobLabel.toLowerCase()} update.`;
}

function formatQueuedUpdateMessage(jobType: RunnableJobType, count: number, copy: AppCopy, locale: Locale) {
  const jobLabel = formatJobType(jobType, copy);
  return locale === "zh"
    ? `${copy.jobs.queuedUpdatePrefix}${jobLabel}更新任务：${count} 个标的。`
    : `${copy.jobs.queuedUpdatePrefix} ${jobLabel.toLowerCase()} update for ${count} ticker${count === 1 ? "" : "s"}.`;
}

function formatRetryUnavailableMessage(jobType: FetchJob["type"], copy: AppCopy, locale: Locale) {
  const jobLabel = formatJobType(jobType, copy);
  return locale === "zh"
    ? `${copy.jobs.retryUnavailablePrefix}${jobLabel}${copy.jobs.retryUnavailableSuffix}`
    : `${copy.jobs.retryUnavailablePrefix} ${jobLabel} ${copy.jobs.retryUnavailableSuffix}`;
}

function formatEnabledSymbolCount(count: number, copy: AppCopy, locale: Locale) {
  return locale === "zh" ? `${count} ${copy.jobs.enabledSymbols}` : `${count} ${copy.jobs.enabledSymbols}`;
}

function formatErrorMessage(error: unknown, copy: AppCopy) {
  if (isApiError(error)) {
    return error.status === 0 ? error.message : `${error.message} (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return copy.common.unknownRequestError;
}

function isActiveJob(job: FetchJob): boolean {
  return job.status === "queued" || job.status === "running";
}
