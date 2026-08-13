"use client";

export type ExportStatus = {
  format: "csv" | "xlsx" | "pdf";
  filename: string;
  state: "exporting" | "done" | "error";
  message?: string;
};

const FORMAT_LABEL: Record<ExportStatus["format"], string> = {
  csv: "CSV",
  xlsx: "Excel",
  pdf: "PDF",
};

export function ExportStatusToast({
  status,
  onDismiss,
}: {
  status: ExportStatus;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-4 left-4 z-40 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-900">
          {status.state === "exporting"
            ? `Exporting ${FORMAT_LABEL[status.format]}…`
            : status.state === "done"
              ? "Export complete"
              : "Export failed"}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-zinc-400 hover:text-zinc-600"
        >
          &times;
        </button>
      </div>

      {status.state === "exporting" ? (
        <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="absolute inset-y-0 w-2/5 rounded-full bg-accent-500"
            style={{ animation: "export-progress-slide 1.1s ease-in-out infinite" }}
          />
        </div>
      ) : status.state === "done" ? (
        <p className="mt-1 truncate text-xs text-zinc-500" title={status.filename}>
          {status.filename} downloaded
        </p>
      ) : (
        <p className="mt-1 text-xs text-red-600">{status.message ?? "Something went wrong."}</p>
      )}
    </div>
  );
}
