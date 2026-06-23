import type { DataStatus } from "../api/types";

export const dataStatusLabels: Record<DataStatus, string> = {
  fresh: "Fresh",
  stale: "Stale",
  missing: "Missing",
  failed: "Failed",
  partial: "Partial"
};

type StatusBadgeProps = {
  status: DataStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status}`}>{dataStatusLabels[status]}</span>;
}
