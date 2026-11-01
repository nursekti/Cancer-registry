"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  DatedEntry,
  formatDmy,
  parseDatedEntries,
  serializeDatedEntries,
} from "@/lib/datedEntries";

const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
const inputClass =
  "w-full rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500";

// Multi-line text that keeps its line breaks, clamped to 4 lines with a
// toggle when it runs longer.
export function LongText({ text }: { text: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    // Measured only while clamped; once expanded it no longer overflows.
    if (!el || expanded) return;
    const observer = new ResizeObserver(() =>
      setOverflows(el.scrollHeight > el.clientHeight + 1),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  if (!text.trim()) return <div className="text-sm text-zinc-400">-</div>;

  return (
    <div>
      <div
        ref={ref}
        className={cn(
          "whitespace-pre-wrap break-words text-sm text-zinc-900",
          !expanded && "line-clamp-4",
        )}
      >
        {text}
      </div>
      {overflows ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-primary-700 hover:text-primary-600"
        >
          {expanded ? "Tampilkan lebih sedikit" : "Tampilkan semua"}
        </button>
      ) : null}
    </div>
  );
}

export function LongTextInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className={cn(inputClass, "resize-y py-2 placeholder:text-zinc-400", className)}
    />
  );
}

// A labelled long-text field: clamped text when viewing, a textarea when
// editing.
export function LongTextField({
  label,
  value,
  onChange,
  isEditing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      <div className="mt-1">
        {isEditing ? (
          <LongTextInput value={value} onChange={onChange} />
        ) : (
          <LongText text={value} />
        )}
      </div>
    </div>
  );
}

// A sheet cell holding several dated reports (Hasil PA, Hasil IHK), shown and
// edited as a list of tanggal + isi entries. The cell text stays the source of
// truth; edits are written back to it as text.
export function DatedEntriesField({
  label,
  value,
  onChange,
  isEditing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
}) {
  // Entries are kept in state while editing rather than re-parsed from the
  // text on every keystroke, so a half-typed entry (no date yet, or a line
  // that looks like a date) doesn't get merged into its neighbour.
  const [source, setSource] = React.useState(value);
  const [entries, setEntries] = React.useState(() => parseDatedEntries(value));
  if (value !== source) {
    setSource(value);
    setEntries(parseDatedEntries(value));
  }

  function commit(next: DatedEntry[]) {
    const text = serializeDatedEntries(next);
    setEntries(next);
    setSource(text);
    onChange(text);
  }

  function update(index: number, patch: Partial<DatedEntry>) {
    commit(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      <div className="mt-2 space-y-3">
        {entries.map((entry, idx) =>
          isEditing ? (
            <div key={idx} className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={entry.tanggal}
                  onChange={(e) => update(idx, { tanggal: e.target.value })}
                  className={cn(inputClass, "h-9 w-44")}
                />
                <button
                  type="button"
                  onClick={() => commit(entries.filter((_, i) => i !== idx))}
                  className="ml-auto text-xs font-medium text-red-600 hover:text-red-500"
                >
                  Hapus
                </button>
              </div>
              <LongTextInput
                value={entry.isi}
                onChange={(v) => update(idx, { isi: v })}
                placeholder="Isi hasil"
              />
            </div>
          ) : (
            <div key={idx} className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-3.5 py-3">
              <div className="mb-1 text-xs font-semibold text-zinc-500">
                {entry.tanggal ? formatDmy(entry.tanggal) : "Tanpa tanggal"}
              </div>
              <LongText text={entry.isi} />
            </div>
          ),
        )}
        {entries.length === 0 && !isEditing ? (
          <div className="text-sm text-zinc-400">-</div>
        ) : null}
        {isEditing ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEntries([...entries, { tanggal: "", isi: "" }])}
          >
            + Tambah hasil
          </Button>
        ) : null}
      </div>
    </div>
  );
}
