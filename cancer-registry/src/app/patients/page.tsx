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
import { PATIENTS } from "@/data/patients";
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

const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/10tlI23LbJ4hiAZpeSygoxqtCu-XQrfxVLhgp7iqwkZc/edit?gid=188215245#gid=188215245";

type Row = Record<string, string>;

function buildFallbackRows(): Row[] {
  return PATIENTS.map((p) => ({
    NAMA: p.nama,
    "NO ERM": p.noErm,
    NIK: p.nik,
    JK: p.jk,
    USIA: String(p.usia),
  }));
}

export default function PatientsPage() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [csvUrl, setCsvUrl] = React.useState(DEFAULT_CSV_URL);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);

  async function loadFromUrl(url: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/csv?url=${encodeURIComponent(url)}`);
      const text = await res.text();
      if (!res.ok) {
        setError(text || "Failed to load registry data");
        return;
      }
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      cacheCsv(url, parsed.headers, parsed.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
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
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      cacheCsv(DEFAULT_CSV_URL, parsed.headers, parsed.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const visibleHeaders = React.useMemo<string[]>(() => {
    if (headers.length) return headers.slice(0, 10);
    return ["NAMA", "NO ERM", "NIK", "JK", "USIA"];
  }, [headers]);

  const fallbackRows = React.useMemo(() => buildFallbackRows(), []);

  const overridesRaw = useLocalStorageValue(LS_ROW_OVERRIDES);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when localStorage changes
  const overrides = React.useMemo(() => loadOverrides(), [overridesRaw]);

  const addedRowsRaw = useLocalStorageValue(ADDED_ROWS_STORAGE_KEYS.NHL);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when localStorage changes
  const addedRows = React.useMemo(() => loadAddedRows("NHL"), [addedRowsRaw]);

  const baseRows = React.useMemo<Row[]>(() => {
    const sourceRows: Row[] = rows.length ? rows : fallbackRows;
    const withoutEmpty = [...sourceRows, ...addedRows].filter(
      (row) => !isEmptyRow(row),
    );
    return withoutEmpty.filter((row) => !overrides[rowKey(row)]?.deleted);
  }, [fallbackRows, rows, addedRows, overrides]);

  const filteredRows = React.useMemo<Row[]>(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return baseRows;
    return baseRows.filter((row) => {
      const hay = Object.values(row).join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [q, baseRows]);

  const summaryCards = [
    { label: "Imported records", value: filteredRows.length },
    { label: "Loaded columns", value: visibleHeaders.length },
    {
      label: "Status",
      value: loading ? "Loading..." : error ? "Needs refresh" : "Ready",
    },
  ];

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6">
          <ModuleHeader
            title="NHL registry data"
            subtitle="Search, import, and manage Non-Hodgkin Lymphoma records from the registry spreadsheet."
            resultCount={filteredRows.length}
            summaryCards={summaryCards}
            onImportClick={() => setImportOpen(true)}
            onAddClick={() => setAddOpen(true)}
          />

          <div className="max-w-3xl">
            <SearchBar
              value={q}
              onChange={setQ}
              totalCount={baseRows.length}
              filteredCount={filteredRows.length}
            />
          </div>

          <div className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <Th>Status</Th>
                    {visibleHeaders.map((header) => (
                      <Th key={header}>{header}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr
                      key={`${row[visibleHeaders[0] as keyof typeof row] ?? "row"}-${index}`}
                      className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                      onClick={() =>
                        router.push(`/patients/${encodeURIComponent(rowKey(row))}`)
                      }
                    >
                      <Td>
                        {overrides[rowKey(row)]?.status === "complete" ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Selesai
                          </span>
                        ) : null}
                      </Td>
                      {visibleHeaders.map((header) => (
                        <Td key={`${header}-${index}`} className="whitespace-normal">
                          {row[header] ?? ""}
                        </Td>
                      ))}
                    </tr>
                  ))}
                  {filteredRows.length === 0 ? (
                    <tr className="border-t border-zinc-100">
                      <Td className="py-10 text-center text-zinc-500" colSpan={visibleHeaders.length + 1}>
                        Tidak ada data yang cocok.
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {importOpen ? (
          <ImportCsvModal
            csvUrl={csvUrl}
            setCsvUrl={setCsvUrl}
            loading={loading}
            errors={error ? [error] : []}
            onLoadFromUrl={loadFromUrl}
            onLoadFromFile={loadFromFile}
            onClose={() => setImportOpen(false)}
          />
        ) : null}

        {addOpen ? (
          <AddRecordModal
            headers={headers}
            onCreate={(row) => {
              addRow("NHL", row);
              setAddOpen(false);
              router.push(`/patients/${encodeURIComponent(rowKey(row))}`);
            }}
            onClose={() => setAddOpen(false)}
          />
        ) : null}
      </AppShell>
    </RequireAuth>
  );
}

function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-4 py-3 whitespace-nowrap", className)}
      {...props}
    />
  );
}

function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 whitespace-nowrap", className)} {...props} />
  );
}

