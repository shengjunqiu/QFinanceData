import type { DataStatus } from "../api/types";

export const dataStatusLabels: Record<DataStatus, string> = {
  fresh: "Fresh",
  stale: "Stale",
  missing: "Missing",
  failed: "Failed",
  partial: "Partial"
};

type StatusBadgeProps = {
  label?: string;
  status: DataStatus;
};

export function StatusBadge({ label, status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status}`}>{label ?? dataStatusLabels[status]}</span>;
}
