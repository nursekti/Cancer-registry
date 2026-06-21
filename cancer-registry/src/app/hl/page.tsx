"use client";

import * as React from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { parseCsv } from "@/lib/csv";

type Row = Record<string, string>;

export default function HlPage() {
  const [csvUrl, setCsvUrl] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [showAllCols, setShowAllCols] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<Row | null>(null);

  const visibleHeaders = React.useMemo(() => {
    if (showAllCols) return headers;
    return headers.slice(0, 10);
  }, [headers, showAllCols]);

  const filteredRows = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => {
      const hay = headers.map((h) => r[h] ?? "").join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [q, rows, headers]);

  async function loadFromUrl(url: string) {
    setLoading(true);
    setErrors([]);
    setSelectedRow(null);
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
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Unknown error"]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFromFile(file: File) {
    setLoading(true);
    setErrors([]);
    setSelectedRow(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setErrors(parsed.errors);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Unknown error"]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">DATA HL</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Halaman ini menampilkan semua kolom yang ada di file <b>CSV</b>{" "}
            (termasuk kolom yang tidak terlihat di layar spreadsheet).
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Catatan: link Google Sheet yang butuh login tidak bisa dibaca langsung.
            Gunakan “Publish to web” atau download CSV lalu upload di sini.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-0">
              <div className="text-sm font-semibold text-zinc-900">
                Load dari URL (public CSV)
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Contoh: link “published CSV” atau export CSV yang public.
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="CSV URL"
                    placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=..."
                    value={csvUrl}
                    onChange={(e) => setCsvUrl(e.target.value)}
                  />
                </div>
                <Button
                  className="h-11"
                  disabled={loading || !csvUrl.trim()}
                  onClick={() => loadFromUrl(csvUrl.trim())}
                >
                  {loading ? "Loading..." : "Load"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <div className="text-sm font-semibold text-zinc-900">
                Upload CSV
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Download dari Google Sheets: File → Download → Comma-separated
                values (.csv)
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void loadFromFile(f);
                }}
              />
            </CardContent>
          </Card>
        </div>

        {errors.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-semibold">Parsing / load warnings</div>
            <ul className="mt-2 list-disc pl-5">
              {errors.slice(0, 6).map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl flex-1">
            <Input
              label="search..."
              placeholder="Cari apapun (nama, no ERM, regimen, dll) ..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              hint={
                headers.length
                  ? `${filteredRows.length} / ${rows.length} rows`
                  : "Belum ada data yang dimuat"
              }
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
                    onClick={() => setSelectedRow(r)}
                  >
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
                      colSpan={visibleHeaders.length || 1}
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

        {selectedRow ? (
          <RowDetails
            headers={headers}
            row={selectedRow}
            onClose={() => setSelectedRow(null)}
          />
        ) : null}
      </AppShell>
    </RequireAuth>
  );
}

function RowDetails({
  headers,
  row,
  onClose,
}: {
  headers: string[];
  row: Row;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 bg-black/30 p-4 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Detail row (HL)
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              Menampilkan seluruh kolom yang ada di spreadsheet.
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="max-h-[75vh] overflow-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {headers.map((h) => (
              <div key={h} className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {h}
                </div>
                <div className="mt-1 break-words text-sm text-zinc-900">
                  {row[h] || <span className="text-zinc-400">(empty)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

