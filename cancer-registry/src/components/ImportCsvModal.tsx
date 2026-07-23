"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function ImportCsvModal({
  csvUrl,
  setCsvUrl,
  loading,
  errors,
  onLoadFromUrl,
  onLoadFromFile,
  onClose,
}: {
  csvUrl: string;
  setCsvUrl: (value: string) => void;
  loading: boolean;
  errors: string[];
  onLoadFromUrl: (url: string) => void;
  onLoadFromFile: (file: File) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 bg-black/30 p-4 backdrop-blur-sm">
      <div className="mx-auto max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Import data
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              Muat data dari link Google Sheet publik atau unggah file CSV.
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 p-6">
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
                  onClick={() => onLoadFromUrl(csvUrl.trim())}
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
                  onLoadFromFile(f);
                }}
              />
            </CardContent>
          </Card>

          {errors.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold">Parsing / load warnings</div>
              <ul className="mt-2 list-disc pl-5">
                {errors.slice(0, 6).map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
