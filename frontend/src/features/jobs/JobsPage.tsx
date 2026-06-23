import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { mockJobs, mockWatchlist } from "../../api/mockData";
import type { FetchJob, FetchJobItem, FetchJobStatus, FetchJobType } from "../../api/types";

const jobStatusLabels: Record<FetchJobStatus, string> = {
  queued: "Queued",
  running: "Running",
  success: "Success",
  partial_success: "Partial",
  failed: "Failed",
  cancelled: "Cancelled"
};

const jobTypes: FetchJobType[] = ["prices", "fundamentals", "actions", "metadata"];
const statusFilters: Array<"all" | FetchJobStatus> = ["all", "queued", "running", "success", "partial_success", "failed"];

export function JobsPage() {
  const [jobs, setJobs] = useState<FetchJob[]>(mockJobs);
  const [selectedJobId, setSelectedJobId] = useState(mockJobs[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | FetchJobStatus>("all");
  const [message, setMessage] = useState<string | null>(null);

  const runningJobs = jobs.filter((job) => job.status === "running" || job.status === "queued");
  const filteredJobs = useMemo(
    () => jobs.filter((job) => statusFilter === "all" || job.status === statusFilter),
    [jobs, statusFilter]
  );
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];

  function createJob(type: FetchJobType) {
    const symbols = mockWatchlist.slice(0, type === "prices" ? 6 : 3).map((symbol) => symbol.symbol);
    const jobId = `job_${type}_${Date.now()}`;
    const job: FetchJob = {
      id: jobId,
      type,
      symbols,
      status: "queued",
      progressTotal: symbols.length,
      progressDone: 0,
      createdAt: new Date().toISOString(),
      items: symbols.map((symbol) => ({
        id: `item_${type}_${symbol}_${Date.now()}`,
        jobId,
        symbol,
        status: "queued"
      }))
    };

    setJobs((current) => [job, ...current]);
    setSelectedJobId(job.id);
    setMessage(`Queued ${type} update for ${symbols.length} symbols.`);
  }

  function retryFailedItems(job: FetchJob) {
    const retrySymbols = job.items.filter((item) => item.status === "failed" || item.status === "partial_success").map((item) => item.symbol);

    if (retrySymbols.length === 0) {
      setMessage("No failed items to retry for this job.");
      return;
    }

    const retryJobId = `job_retry_${job.type}_${Date.now()}`;
    const retryJob: FetchJob = {
      id: retryJobId,
      type: job.type,
      symbols: retrySymbols,
      status: "queued",
      progressTotal: retrySymbols.length,
      progressDone: 0,
      createdAt: new Date().toISOString(),
      items: retrySymbols.map((symbol) => ({
        id: `item_retry_${job.type}_${symbol}_${Date.now()}`,
        jobId: retryJobId,
        symbol,
        status: "queued"
      }))
    };

    setJobs((current) => [retryJob, ...current]);
    setSelectedJobId(retryJob.id);
    setMessage(`Queued retry for ${retrySymbols.length} failed item${retrySymbols.length > 1 ? "s" : ""}.`);
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
        {jobTypes.map((type) => (
          <button key={type} onClick={() => createJob(type)} type="button">
            Fetch {formatJobType(type)}
          </button>
        ))}
      </section>

      {message ? <p className="inline-message">{message}</p> : null}

      <div className="jobs-page-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Job Queue</h2>
            <span>{runningJobs.length} active</span>
          </div>
          {runningJobs.length === 0 ? (
            <div className="empty-state empty-state-compact">
              <strong>No active jobs</strong>
              <p>Start a fetch job to see progress.</p>
            </div>
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
            {selectedJob ? <button className="text-action" onClick={() => retryFailedItems(selectedJob)} type="button">Retry Failed</button> : null}
          </div>
          {selectedJob ? <JobDetail job={selectedJob} /> : <div className="empty-state"><strong>No job selected</strong><p>Select a job to inspect item-level status.</p></div>}
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
        </section>
      </div>
    </section>
  );
}

function JobDetail({ job }: { job: FetchJob }) {
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
          <span>Created</span>
          <strong>{formatDateTime(job.createdAt)}</strong>
        </div>
      </div>
      <ProgressMeter job={job} />
      <div className="job-items-list">
        {job.items.map((item) => (
          <JobItemRow item={item} key={item.id} />
        ))}
      </div>
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

function JobStatusBadge({ status }: { status: FetchJobStatus }) {
  return <span className={`job-status-badge job-status-${status}`}>{jobStatusLabels[status]}</span>;
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
