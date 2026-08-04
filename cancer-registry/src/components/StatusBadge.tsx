import { RECORD_STATUS_META, RecordStatus } from "@/lib/rowOverrides";

export function StatusBadge({ status }: { status?: RecordStatus }) {
  const meta = status ? RECORD_STATUS_META[status] : undefined;
  // Guards against stale localStorage values from before this status enum
  // existed (e.g. the old "complete" flag), which won't match any key here.
  if (!meta) return null;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}
