"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ADDED_ROWS_STORAGE_KEYS, addRow, loadAddedRows } from "@/lib/addedRows";
import { AddRecordModal } from "@/components/AddRecordModal";
import { AppShell } from "@/components/AppShell";
import { ImportCsvModal } from "@/components/ImportCsvModal";
import { ModuleHeader } from "@/components/ModuleHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/Button";
import { cacheCsv, readCsvCache } from "@/lib/csvCache";
import { cn } from "@/lib/cn";
import { parseCsv } from "@/lib/csv";
import {
  LS_ROW_OVERRIDES,
  isEmptyRow,
  loadOverrides,
  rowKey,
} from "@/lib/rowOverrides";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";

type Row = Record<string, string>;

const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/10tlI23LbJ4hiAZpeSygoxqtCu-XQrfxVLhgp7iqwkZc/edit?gid=188215245#gid=188215245";

export default function HlPage() {
  const router = useRouter();
  const [csvUrl, setCsvUrl] = React.useState(DEFAULT_CSV_URL);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [showAllCols, setShowAllCols] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);

  const overridesRaw = useLocalStorageValue(LS_ROW_OVERRIDES);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when localStorage changes
  const overrides = React.useMemo(() => loadOverrides(), [overridesRaw]);

  const addedRowsRaw = useLocalStorageValue(ADDED_ROWS_STORAGE_KEYS.HL);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when localStorage changes
  const addedRows = React.useMemo(() => loadAddedRows("HL"), [addedRowsRaw]);

  const visibleHeaders = React.useMemo(() => {
    if (showAllCols) return headers;
    return headers.slice(0, 10);
  }, [headers, showAllCols]);

  const baseRows = React.useMemo(() => {
    const withoutEmpty = [...rows, ...addedRows].filter((r) => !isEmptyRow(r));
    return withoutEmpty.filter((r) => !overrides[rowKey(r)]?.deleted);
  }, [rows, addedRows, overrides]);

  const filteredRows = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return baseRows;
    return baseRows.filter((r) => {
      const hay = headers.map((h) => r[h] ?? "").join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [q, baseRows, headers]);

  async function loadFromUrl(url: string) {
    setLoading(true);
    setErrors([]);
    try {
      const res = await fetch(`/api/csv?url=${encodeURIComponent(url)}`);
      const text = await res.text();
      if (!res.ok) {
        setErrors([text || "Failed to load CSV"]);
        return;
      }
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setErrors(parsed.errors);
      // Detail pages always look up the default sheet's cache entry, so
      // whatever dataset is currently on screen becomes that entry.
      cacheCsv(DEFAULT_CSV_URL, parsed.headers, parsed.rows);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Unknown error"]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    const cached = readCsvCache(DEFAULT_CSV_URL);
    if (cached) {
      setHeaders(cached.headers);
      setRows(cached.rows);
      return;
    }
    void loadFromUrl(DEFAULT_CSV_URL);
  }, []);

  async function loadFromFile(file: File) {
    setLoading(true);
    setErrors([]);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setErrors(parsed.errors);
      cacheCsv(DEFAULT_CSV_URL, parsed.headers, parsed.rows);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Unknown error"]);
    } finally {
      setLoading(false);
    }
  }

  const summaryCards = [
    { label: "Imported records", value: filteredRows.length },
    { label: "Loaded columns", value: visibleHeaders.length },
    {
      label: "Status",
      value: loading ? "Loading..." : errors.length ? "Needs refresh" : "Ready",
    },
  ];

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6">
          <ModuleHeader
            title="HL registry data"
            subtitle="Search, import, and manage Hodgkin Lymphoma records from the registry spreadsheet."
            resultCount={filteredRows.length}
            summaryCards={summaryCards}
            onImportClick={() => setImportOpen(true)}
            onAddClick={() => setAddOpen(true)}
          />
        </div>

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl flex-1">
            <SearchBar
              value={q}
              onChange={setQ}
              totalCount={baseRows.length}
              filteredCount={filteredRows.length}
            />
          </div>
          {headers.length ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowAllCols((v) => !v)}
              >
                {showAllCols ? "Show fewer columns" : "Show all columns"}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  {visibleHeaders.map((h) => (
                    <th key={h} className="px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 500).map((r, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                    onClick={() =>
                      router.push(`/hl/${encodeURIComponent(rowKey(r))}`)
                    }
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {overrides[rowKey(r)]?.status === "complete" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Selesai
                        </span>
                      ) : null}
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
                      Muat data HL dari URL public atau upload CSV.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {headers.length && filteredRows.length > 500 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Menampilkan 500 baris pertama (gunakan search untuk memperkecil hasil).
          </p>
        ) : null}

        {importOpen ? (
          <ImportCsvModal
            csvUrl={csvUrl}
            setCsvUrl={setCsvUrl}
            loading={loading}
            errors={errors}
            onLoadFromUrl={loadFromUrl}
            onLoadFromFile={loadFromFile}
            onClose={() => setImportOpen(false)}
          />
        ) : null}

        {addOpen ? (
          <AddRecordModal
            headers={headers}
            onCreate={(row) => {
              addRow("HL", row);
              setAddOpen(false);
              router.push(`/hl/${encodeURIComponent(rowKey(row))}`);
            }}
            onClose={() => setAddOpen(false)}
          />
        ) : null}
      </AppShell>
    </RequireAuth>
  );
}

