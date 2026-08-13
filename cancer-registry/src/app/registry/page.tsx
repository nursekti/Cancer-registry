"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addRow, addedRowsStorageKey, loadAddedRows } from "@/lib/addedRows";
import { AddRecordModal } from "@/components/AddRecordModal";
import { AppShell } from "@/components/AppShell";
import { ExportMenu } from "@/components/ExportMenu";
import { ExportStatus, ExportStatusToast } from "@/components/ExportStatusToast";
import { FilterModal } from "@/components/FilterModal";
import { ImportCsvModal } from "@/components/ImportCsvModal";
import { ModuleHeader } from "@/components/ModuleHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { SearchBar } from "@/components/SearchBar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  CancerTypeConfig,
  loadCancerTypes,
  updateCancerTypeCsvUrl,
} from "@/lib/cancerTypes";
import { cacheCsv, readCsvCache } from "@/lib/csvCache";
import { cn } from "@/lib/cn";
import { parseCsv } from "@/lib/csv";
import { fetchGoogleCsv } from "@/lib/fetchGoogleCsv";
import {
  LS_ROW_OVERRIDES,
  RECORD_STATUS_META,
  findExactHeaderValue,
  findHeaderValue,
  isEmptyRow,
  loadOverrides,
  mapKesimpulanToStatus,
  rowKey,
} from "@/lib/rowOverrides";
import { exportToCsv, exportToPdf, exportToXlsx } from "@/lib/exportTable";
import {
  ColumnType,
  FilterCombinator,
  FilterRule,
  SortState,
  activeRules,
  inferColumnType,
  matchesRules,
  operatorLabel,
  sortRows,
} from "@/lib/columnFilters";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";

type Row = Record<string, string>;

const DEFAULT_VISIBLE_HEADERS = ["NAMA", "NO ERM", "NIK"];

export default function RegistryListPage() {
  return (
    <React.Suspense
      fallback={
        <RequireAuth>
          <AppShell>
            <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
              Memuat...
            </div>
          </AppShell>
        </RequireAuth>
      }
    >
      <RegistryListPageInner />
    </React.Suspense>
  );
}

function RegistryListPageInner() {
  const searchParams = useSearchParams();
  const typeId = decodeURIComponent(searchParams.get("typeId") ?? "");
  const router = useRouter();

  const [config, setConfig] = React.useState<CancerTypeConfig | null | undefined>(
    undefined,
  );
  React.useEffect(() => {
    setConfig(loadCancerTypes().find((t) => t.id === typeId) ?? null);
  }, [typeId]);

  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [showAllCols, setShowAllCols] = React.useState(false);
  const [filterRules, setFilterRules] = React.useState<FilterRule[]>([]);
  const [filterCombinator, setFilterCombinator] = React.useState<FilterCombinator>("AND");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [sort, setSort] = React.useState<SortState | null>(null);
  const [exportStatus, setExportStatus] = React.useState<ExportStatus | null>(null);
  const exportStatusTimeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [importOpen, setImportOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [csvUrlDraft, setCsvUrlDraft] = React.useState("");

  React.useEffect(() => {
    return () => clearTimeout(exportStatusTimeout.current);
  }, []);

  async function loadFromUrl(url: string) {
    if (!config) return;
    setLoading(true);
    setErrors([]);
    try {
      const text = await fetchGoogleCsv(url);
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setErrors(parsed.errors ?? []);
      // Detail pages always look up this type's canonical URL, so whatever
      // dataset is currently on screen becomes that cache entry.
      cacheCsv(config.csvUrl || url, parsed.headers, parsed.rows);
      if (url !== config.csvUrl) {
        updateCancerTypeCsvUrl(typeId, url);
        setConfig((c) => (c ? { ...c, csvUrl: url } : c));
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Unknown error"]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFromFile(file: File) {
    if (!config) return;
    setLoading(true);
    setErrors([]);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setErrors(parsed.errors ?? []);
      cacheCsv(config.csvUrl, parsed.headers, parsed.rows);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Unknown error"]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!config) return;
    if (!config.csvUrl) return;
    const cached = readCsvCache(config.csvUrl);
    if (cached) {
      setHeaders(cached.headers);
      setRows(cached.rows);
      return;
    }
    void loadFromUrl(config.csvUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the type/url actually changes
  }, [config?.id, config?.csvUrl]);

  const overridesRaw = useLocalStorageValue(LS_ROW_OVERRIDES);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when localStorage changes
  const overrides = React.useMemo(() => loadOverrides(), [overridesRaw]);

  const addedRowsRaw = useLocalStorageValue(addedRowsStorageKey(typeId));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when localStorage changes
  const addedRows = React.useMemo(() => loadAddedRows(typeId), [addedRowsRaw, typeId]);

  const visibleHeaders = React.useMemo<string[]>(() => {
    if (showAllCols && headers.length) return headers;
    if (!headers.length) return DEFAULT_VISIBLE_HEADERS;
    return DEFAULT_VISIBLE_HEADERS.map((wanted) =>
      headers.find((h) => h.toLowerCase() === wanted.toLowerCase()),
    ).filter((h): h is string => Boolean(h));
  }, [headers, showAllCols]);

  const baseRows = React.useMemo<Row[]>(() => {
    // Newly added records show first.
    const withoutEmpty = [...addedRows, ...rows].filter((r) => !isEmptyRow(r));
    return withoutEmpty.filter((r) => !overrides[rowKey(r)]?.deleted);
  }, [rows, addedRows, overrides]);

  const columnTypes = React.useMemo<Record<string, ColumnType>>(() => {
    const map: Record<string, ColumnType> = {};
    for (const h of headers) {
      map[h] = inferColumnType(baseRows.map((r) => r[h] ?? ""));
    }
    return map;
  }, [headers, baseRows]);

  const visibleFilterRules = React.useMemo(() => activeRules(filterRules), [filterRules]);

  const filteredRows = React.useMemo<Row[]>(() => {
    const qq = q.trim().toLowerCase();
    return baseRows.filter((r) => {
      if (qq) {
        const hay = [
          findExactHeaderValue(r, headers, "nama"),
          r["NO ERM"],
          r["NIK"],
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return matchesRules(r, filterRules, filterCombinator);
    });
  }, [q, baseRows, headers, filterRules, filterCombinator]);

  const sortedRows = React.useMemo<Row[]>(() => {
    return sortRows(filteredRows, sort, sort ? columnTypes[sort.column] ?? "text" : "text");
  }, [filteredRows, sort, columnTypes]);

  function removeFilterRule(id: string) {
    setFilterRules((prev) => prev.filter((r) => r.id !== id));
  }

  function handleHeaderClick(header: string) {
    setSort((prev) => {
      if (!prev || prev.column !== header) return { column: header, direction: "asc" };
      if (prev.direction === "asc") return { column: header, direction: "desc" };
      return null;
    });
  }

  function detailHref(key: string) {
    return `/registry/detail?typeId=${encodeURIComponent(typeId)}&key=${encodeURIComponent(key)}`;
  }

  const exportHeaders = React.useMemo(() => ["Status", ...visibleHeaders], [visibleHeaders]);

  const exportRows = React.useMemo<Row[]>(() => {
    return sortedRows.map((r) => {
      const status =
        overrides[rowKey(r)]?.status ??
        mapKesimpulanToStatus(findHeaderValue(r, headers, "kesimpulan"));
      const out: Row = { Status: status ? RECORD_STATUS_META[status].label : "" };
      for (const h of visibleHeaders) out[h] = r[h] ?? "";
      return out;
    });
  }, [sortedRows, overrides, headers, visibleHeaders]);

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    const base = (config?.label ?? typeId).replace(/\s+/g, "-");
    const filename = `${base}-registry.${format}`;
    clearTimeout(exportStatusTimeout.current);
    setExportStatus({ format, filename, state: "exporting" });
    try {
      if (format === "csv") {
        exportToCsv(exportHeaders, exportRows, filename);
      } else if (format === "xlsx") {
        await exportToXlsx(exportHeaders, exportRows, filename);
      } else {
        await exportToPdf(exportHeaders, exportRows, filename, `${config?.label ?? typeId} registry data`);
      }
      setExportStatus({ format, filename, state: "done" });
    } catch (e) {
      setExportStatus({
        format,
        filename,
        state: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      exportStatusTimeout.current = setTimeout(() => setExportStatus(null), 3000);
    }
  }

  if (config === undefined) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
            Memuat...
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  if (config === null) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
            <div className="text-sm font-semibold text-zinc-900">
              Modul tidak ditemukan.
            </div>
            <Link
              href="/type"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary-700 px-4 text-sm font-medium text-white hover:bg-primary-600"
            >
              &larr; Kembali ke homepage
            </Link>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6">
          <ModuleHeader
            title={`${config.label} registry data`}
            subtitle={
              config.description
                ? `Search, import, and manage ${config.description} records from the registry spreadsheet.`
                : "Search, import, and manage records from the registry spreadsheet."
            }
            resultCount={filteredRows.length}
            onImportClick={() => {
              setCsvUrlDraft(config.csvUrl);
              setImportOpen(true);
            }}
            onAddClick={() => setAddOpen(true)}
          />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl flex-1">
              <SearchBar
                value={q}
                onChange={setQ}
                totalCount={baseRows.length}
                filteredCount={filteredRows.length}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setFilterOpen(true)}
                disabled={!headers.length}
              >
                Filter{visibleFilterRules.length ? ` (${visibleFilterRules.length})` : ""}
              </Button>
              {headers.length ? (
                <Button variant="secondary" onClick={() => setShowAllCols((v) => !v)}>
                  {showAllCols ? "Show fewer columns" : "Show all columns"}
                </Button>
              ) : null}
              <ExportMenu disabled={!filteredRows.length} onExport={handleExport} />
            </div>
          </div>

          {visibleFilterRules.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {visibleFilterRules.map((rule, idx) => (
                <React.Fragment key={rule.id}>
                  {idx > 0 ? (
                    <span className="text-xs font-semibold uppercase text-zinc-400">
                      {filterCombinator}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-primary-700 ring-1 ring-inset ring-accent-200">
                    {rule.column} {operatorLabel(rule).toLowerCase()} &ldquo;{rule.value}&rdquo;
                    <button
                      type="button"
                      onClick={() => removeFilterRule(rule.id)}
                      className="text-primary-700/60 hover:text-primary-700"
                      aria-label={`Remove filter on ${rule.column}`}
                    >
                      &times;
                    </button>
                  </span>
                </React.Fragment>
              ))}
              <button
                type="button"
                onClick={() => setFilterRules([])}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
              >
                Clear all filters
              </button>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    {visibleHeaders.map((h) => (
                      <th key={h} className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleHeaderClick(h)}
                          className="inline-flex items-center gap-1 hover:text-zinc-900"
                        >
                          <span>{h}</span>
                          <span
                            className={cn(
                              "text-[10px]",
                              sort?.column === h ? "text-accent-600" : "text-zinc-300",
                            )}
                          >
                            {sort?.column === h ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.slice(0, 500).map((r, idx) => (
                    <tr
                      key={idx}
                      className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                      onClick={() => router.push(detailHref(rowKey(r)))}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge
                          status={
                            overrides[rowKey(r)]?.status ??
                            mapKesimpulanToStatus(findHeaderValue(r, headers, "kesimpulan"))
                          }
                        />
                      </td>
                      {visibleHeaders.map((h) => (
                        <td
                          key={h}
                          className={cn(
                            "px-4 py-3 whitespace-nowrap",
                            (r[h] ?? "").length > 40 ? "max-w-[340px] truncate" : "",
                          )}
                          title={r[h] ?? ""}
                        >
                          {r[h] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {headers.length && filteredRows.length === 0 ? (
                    <tr className="border-t border-zinc-100">
                      <td
                        className="px-4 py-10 text-center text-zinc-500"
                        colSpan={visibleHeaders.length + 1}
                      >
                        Tidak ada data yang cocok.
                      </td>
                    </tr>
                  ) : null}
                  {!headers.length ? (
                    <tr className="border-t border-zinc-100">
                      <td className="px-4 py-10 text-center text-zinc-500">
                        Muat data {config.label} dari URL public atau upload CSV.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {headers.length && filteredRows.length > 500 ? (
            <p className="text-xs text-zinc-500">
              Menampilkan 500 baris pertama (gunakan search untuk memperkecil hasil).
            </p>
          ) : null}
        </div>

        {importOpen ? (
          <ImportCsvModal
            csvUrl={csvUrlDraft}
            setCsvUrl={setCsvUrlDraft}
            loading={loading}
            errors={errors}
            onLoadFromUrl={loadFromUrl}
            onLoadFromFile={loadFromFile}
            onClose={() => setImportOpen(false)}
          />
        ) : null}

        {filterOpen ? (
          <FilterModal
            headers={headers}
            columnTypes={columnTypes}
            rules={filterRules}
            combinator={filterCombinator}
            onApply={(rules, combinator) => {
              setFilterRules(rules);
              setFilterCombinator(combinator);
            }}
            onClose={() => setFilterOpen(false)}
          />
        ) : null}

        {exportStatus ? (
          <ExportStatusToast status={exportStatus} onDismiss={() => setExportStatus(null)} />
        ) : null}

        {addOpen ? (
          <AddRecordModal
            headers={headers}
            onCreate={(row) => {
              addRow(typeId, row);
              setAddOpen(false);
              router.push(detailHref(rowKey(row)));
            }}
            onClose={() => setAddOpen(false)}
          />
        ) : null}
      </AppShell>
    </RequireAuth>
  );
}
