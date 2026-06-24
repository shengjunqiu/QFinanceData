import type { DataStatus } from "../api/types";
import { useOptionalI18n } from "../i18n";

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
  const i18n = useOptionalI18n();

  return <span className={`status-badge status-${status}`}>{label ?? i18n?.copy.common.statusLabels[status] ?? dataStatusLabels[status]}</span>;
}
